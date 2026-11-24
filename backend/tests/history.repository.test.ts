import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/database';

describe('Phase 15: Room Lifecycle, Host Transfer & Watch History Foundation', () => {
  let hostUser: any;
  let viewerUser1: any;
  let viewerUser2: any;
  let outsiderUser: any;

  beforeEach(async () => {
    // Generate fresh users for each test
    const timestamp = Date.now() + Math.random().toString(36).substring(2, 6);
    hostUser = await db.createUser({
      email: `host_${timestamp}@synctheater.com`,
      username: `Host_${timestamp}`,
      passwordHash: 'hashed_pw',
    });

    viewerUser1 = await db.createUser({
      email: `viewer1_${timestamp}@synctheater.com`,
      username: `Viewer1_${timestamp}`,
      passwordHash: 'hashed_pw',
    });

    viewerUser2 = await db.createUser({
      email: `viewer2_${timestamp}@synctheater.com`,
      username: `Viewer2_${timestamp}`,
      passwordHash: 'hashed_pw',
    });

    outsiderUser = await db.createUser({
      email: `outsider_${timestamp}@synctheater.com`,
      username: `Outsider_${timestamp}`,
      passwordHash: 'hashed_pw',
    });
  });

  it('keeps room creation and session start separate (startedAt is null until first join)', async () => {
    const room = await db.createRoom({
      name: 'Indie Film Premiere',
      ownerId: hostUser.id,
    });

    const session = await db.createRoomSession({
      roomId: room.id,
      roomSlug: room.slug,
      roomName: room.name,
      originalHostId: hostUser.id,
      originalHostUsername: hostUser.username,
    });

    expect(session.id).toBeDefined();
    expect(session.status).toBe('ACTIVE');
    expect(session.startedAt).toBeNull();
    expect(session.endedAt).toBeNull();
    expect(session.totalDurationSeconds).toBe(0);
    expect(session.originalHostId).toBe(hostUser.id);
    expect(session.originalHostUsername).toBe(hostUser.username);
  });

  it('records session start timestamp and initial attendance interval upon first participant join', async () => {
    const room = await db.createRoom({
      name: 'Sci-Fi Classic Night',
      ownerId: hostUser.id,
    });

    const session = await db.createRoomSession({
      roomId: room.id,
      roomSlug: room.slug,
      roomName: room.name,
      originalHostId: hostUser.id,
      originalHostUsername: hostUser.username,
    });

    const joinTime = new Date();
    const attendance = await db.recordAttendanceJoin({
      sessionId: session.id,
      userId: hostUser.id,
      displayName: hostUser.username,
      isOriginalHost: true,
      joinedAt: joinTime,
    });

    expect(attendance.sessionId).toBe(session.id);
    expect(attendance.userId).toBe(hostUser.id);
    expect(attendance.displayName).toBe(hostUser.username);
    expect(attendance.leftAt).toBeNull();
    expect(attendance.isOriginalHost).toBe(true);

    const updatedSession = await db.findSessionById(session.id);
    expect(updatedSession?.startedAt).toBeDefined();
    expect(updatedSession?.startedAt).not.toBeNull();
  });

  it('prevents duplicate open attendance intervals on rapid socket reconnect', async () => {
    const room = await db.createRoom({
      name: 'Reconnect Test Room',
      ownerId: hostUser.id,
    });

    const session = await db.createRoomSession({
      roomId: room.id,
      roomSlug: room.slug,
      roomName: room.name,
      originalHostId: hostUser.id,
      originalHostUsername: hostUser.username,
    });

    // First join
    const att1 = await db.recordAttendanceJoin({
      sessionId: session.id,
      userId: viewerUser1.id,
      displayName: viewerUser1.username,
      isOriginalHost: false,
    });

    // Rapid reconnect while interval is still open
    const att2 = await db.recordAttendanceJoin({
      sessionId: session.id,
      userId: viewerUser1.id,
      displayName: viewerUser1.username,
      isOriginalHost: false,
    });

    // Must return the exact same open attendance record without creating a second entry
    expect(att1.id).toBe(att2.id);
    expect(att2.leftAt).toBeNull();
  });

  it('accurately preserves multiple attendance intervals when a participant rejoins after leaving', async () => {
    const room = await db.createRoom({
      name: 'Interval History Room',
      ownerId: hostUser.id,
    });

    const session = await db.createRoomSession({
      roomId: room.id,
      roomSlug: room.slug,
      roomName: room.name,
      originalHostId: hostUser.id,
      originalHostUsername: hostUser.username,
    });

    const t1 = new Date(Date.now() - 3600 * 1000); // 1 hour ago
    const t2 = new Date(Date.now() - 1800 * 1000); // 30 mins ago
    const t3 = new Date(Date.now() - 900 * 1000);  // 15 mins ago

    // Join at t1
    await db.recordAttendanceJoin({
      sessionId: session.id,
      userId: viewerUser1.id,
      displayName: viewerUser1.username,
      isOriginalHost: false,
      joinedAt: t1,
    });

    // Leave at t2 (30 minutes of watch time)
    const leave1 = await db.recordAttendanceLeave(session.id, viewerUser1.id, t2);
    expect(leave1).not.toBeNull();
    expect(leave1?.durationSeconds).toBe(1800); // 30 minutes in seconds

    // Rejoin at t3 (15 minutes ago)
    const rejoinAtt = await db.recordAttendanceJoin({
      sessionId: session.id,
      userId: viewerUser1.id,
      displayName: viewerUser1.username,
      isOriginalHost: false,
      joinedAt: t3,
    });

    expect(rejoinAtt.id).not.toBe(leave1?.id);
    expect(rejoinAtt.leftAt).toBeNull();

    // Check user history: total duration must sum all attendance intervals
    const details = await db.getSessionDetails(session.id, viewerUser1.id);
    expect(details?.attendance).toHaveLength(2);
    expect(details?.attendance[0].durationSeconds).toBe(1800);
    expect(details?.attendance[1].leftAt).toBeNull();
  });

  it('atomically records host transfer in session history and updates participant roles', async () => {
    const room = await db.createRoom({
      name: 'Host Succession Room',
      ownerId: hostUser.id,
    });

    const session = await db.createRoomSession({
      roomId: room.id,
      roomSlug: room.slug,
      roomName: room.name,
      originalHostId: hostUser.id,
      originalHostUsername: hostUser.username,
    });

    // Join successor
    await db.recordAttendanceJoin({
      sessionId: session.id,
      userId: viewerUser1.id,
      displayName: viewerUser1.username,
      isOriginalHost: false,
    });

    // Transfer host to viewerUser1
    const transfer = await db.recordHostTransfer({
      sessionId: session.id,
      previousHostId: hostUser.id,
      previousHostUsername: hostUser.username,
      newHostId: viewerUser1.id,
      newHostUsername: viewerUser1.username,
      reason: 'Host left the session peacefully',
      transferType: 'VOLUNTARY',
    });

    expect(transfer.id).toBeDefined();
    expect(transfer.previousHostId).toBe(hostUser.id);
    expect(transfer.newHostId).toBe(viewerUser1.id);

    // Verify session was updated with final host
    const updatedSession = await db.findSessionById(session.id);
    expect(updatedSession?.originalHostId).toBe(hostUser.id);
    expect(updatedSession?.finalHostId).toBe(viewerUser1.id);
    expect(updatedSession?.finalHostUsername).toBe(viewerUser1.username);

    // Verify successor's attendance has becameHost = true
    const details = await db.getSessionDetails(session.id, viewerUser1.id);
    const successorAtt = details?.attendance.find((a) => a.userId === viewerUser1.id);
    expect(successorAtt?.becameHost).toBe(true);
    expect(details?.transfers).toHaveLength(1);
    expect(details?.transfers[0].transferType).toBe('VOLUNTARY');
  });

  it('finalizes room session, computes duration, and closes all open attendances upon room closure', async () => {
    const room = await db.createRoom({
      name: 'Ending Room Test',
      ownerId: hostUser.id,
    });

    const session = await db.createRoomSession({
      roomId: room.id,
      roomSlug: room.slug,
      roomName: room.name,
      originalHostId: hostUser.id,
      originalHostUsername: hostUser.username,
    });

    const startTime = new Date(Date.now() - 3600 * 1000); // 1 hour ago
    await db.recordAttendanceJoin({
      sessionId: session.id,
      userId: hostUser.id,
      displayName: hostUser.username,
      isOriginalHost: true,
      joinedAt: startTime,
    });

    await db.recordAttendanceJoin({
      sessionId: session.id,
      userId: viewerUser1.id,
      displayName: viewerUser1.username,
      isOriginalHost: false,
      joinedAt: startTime,
    });

    const endTime = new Date();
    const closedSession = await db.finalizeRoomSession(session.id, 'HOST_ENDED', endTime);

    expect(closedSession?.status).toBe('CLOSED');
    expect(closedSession?.closureReason).toBe('HOST_ENDED');
    expect(closedSession?.endedAt).toBeDefined();
    expect(closedSession?.totalDurationSeconds).toBeGreaterThanOrEqual(3599);

    // Verify all attendances are now closed
    const details = await db.getSessionDetails(session.id, hostUser.id);
    expect(details?.attendance.every((a) => a.leftAt !== null)).toBe(true);
    expect(details?.attendance.every((a) => a.durationSeconds > 0)).toBe(true);
  });

  it('preserves historical sessions and attendance records even if the operational room is deleted', async () => {
    const room = await db.createRoom({
      name: 'Temporary Room',
      ownerId: hostUser.id,
    });

    const session = await db.createRoomSession({
      roomId: room.id,
      roomSlug: room.slug,
      roomName: room.name,
      originalHostId: hostUser.id,
      originalHostUsername: hostUser.username,
    });

    await db.recordAttendanceJoin({
      sessionId: session.id,
      userId: hostUser.id,
      displayName: hostUser.username,
      isOriginalHost: true,
    });

    // Delete the temporary operational room (active room cleanup simulation)
    await db.rooms.deleteRoom(room.id);

    // Operational room is gone
    const fetchedRoom = await db.rooms.findRoomById(room.id);
    expect(fetchedRoom).toBeNull();

    // But historical session and personal attendance record permanently survive!
    const historicalSession = await db.findSessionById(session.id);
    expect(historicalSession).not.toBeNull();
    expect(historicalSession?.roomName).toBe('Temporary Room');

    const details = await db.getSessionDetails(session.id, hostUser.id);
    expect(details).not.toBeNull();
    expect(details?.session.id).toBe(session.id);
    expect(details?.attendance).toHaveLength(1);
  });

  it('strictly restricts watch history access to authorized attendees and hosts', async () => {
    const room = await db.createRoom({
      name: 'Secret Cinema Club',
      ownerId: hostUser.id,
    });

    const session = await db.createRoomSession({
      roomId: room.id,
      roomSlug: room.slug,
      roomName: room.name,
      originalHostId: hostUser.id,
      originalHostUsername: hostUser.username,
    });

    await db.recordAttendanceJoin({
      sessionId: session.id,
      userId: viewerUser1.id,
      displayName: viewerUser1.username,
      isOriginalHost: false,
    });

    // Host can view details
    const hostView = await db.getSessionDetails(session.id, hostUser.id);
    expect(hostView).not.toBeNull();

    // Attendee can view details
    const viewerView = await db.getSessionDetails(session.id, viewerUser1.id);
    expect(viewerView).not.toBeNull();

    // Non-attendee outsider is strictly denied (returns null)
    const outsiderView = await db.getSessionDetails(session.id, outsiderUser.id);
    expect(outsiderView).toBeNull();
  });

  it('returns personal watch history list with correct role badges and total counts', async () => {
    // Session 1: hostUser is ORIGINAL_HOST, viewerUser1 is PARTICIPANT
    const room1 = await db.createRoom({ name: 'Session One', ownerId: hostUser.id });
    const s1 = await db.createRoomSession({
      roomId: room1.id,
      roomSlug: room1.slug,
      roomName: room1.name,
      originalHostId: hostUser.id,
      originalHostUsername: hostUser.username,
    });
    await db.recordAttendanceJoin({
      sessionId: s1.id,
      userId: hostUser.id,
      displayName: hostUser.username,
      isOriginalHost: true,
    });
    await db.recordAttendanceJoin({
      sessionId: s1.id,
      userId: viewerUser1.id,
      displayName: viewerUser1.username,
      isOriginalHost: false,
    });

    // Session 2: viewerUser2 is ORIGINAL_HOST, viewerUser1 joined and became SUCCESSOR_HOST
    const room2 = await db.createRoom({ name: 'Session Two', ownerId: viewerUser2.id });
    const s2 = await db.createRoomSession({
      roomId: room2.id,
      roomSlug: room2.slug,
      roomName: room2.name,
      originalHostId: viewerUser2.id,
      originalHostUsername: viewerUser2.username,
    });
    await db.recordAttendanceJoin({
      sessionId: s2.id,
      userId: viewerUser1.id,
      displayName: viewerUser1.username,
      isOriginalHost: false,
    });
    await db.recordHostTransfer({
      sessionId: s2.id,
      previousHostId: viewerUser2.id,
      previousHostUsername: viewerUser2.username,
      newHostId: viewerUser1.id,
      newHostUsername: viewerUser1.username,
    });

    // Query viewerUser1's history
    const viewerHistory = await db.listUserWatchHistory(viewerUser1.id);
    expect(viewerHistory.total).toBe(2);
    expect(viewerHistory.sessions).toHaveLength(2);

    const s1Record = viewerHistory.sessions.find((s) => s.id === s1.id);
    expect(s1Record?.userRole).toBe('PARTICIPANT');

    const s2Record = viewerHistory.sessions.find((s) => s.id === s2.id);
    expect(s2Record?.userRole).toBe('SUCCESSOR_HOST');

    // Query outsiderUser: has 0 historical sessions
    const outsiderHistory = await db.listUserWatchHistory(outsiderUser.id);
    expect(outsiderHistory.total).toBe(0);
    expect(outsiderHistory.sessions).toHaveLength(0);
  });
});
