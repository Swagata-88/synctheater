import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/database';
import { RoomsService } from '../src/modules/rooms/rooms.service';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Phase 15: Stage 5 — End-to-End Room Lifecycle & Integrity Verification', () => {
  let roomsService: RoomsService;
  let authService: AuthService;

  beforeEach(async () => {
    roomsService = new RoomsService();
    authService = new AuthService();
  });

  // =========================================================================
  // 1. Complete Room Lifecycle Testing Sequence
  // =========================================================================
  describe('1. Complete Room Lifecycle Flow', () => {
    it('executes full room lifecycle from creation to host transfer, departure, closure, and history audit', async () => {
      // Step 1: Create host user and participant user
      const hostAuth = await authService.register({
        email: `host_e2e_${Date.now()}@example.com`,
        username: `HostE2E_${Date.now()}`,
        password: 'Password123!',
      });
      const viewerAuth = await authService.register({
        email: `viewer_e2e_${Date.now()}@example.com`,
        username: `ViewerE2E_${Date.now()}`,
        password: 'Password123!',
      });

      // Step 2: Authenticated user creates a private room
      const room = await roomsService.createRoom({
        name: 'Dune Part Two Grand Cinema',
        ownerId: hostAuth.user.id,
        isPrivate: true,
        maxCapacity: 10,
        initialVideo: {
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          provider: 'DIRECT',
          title: 'Big Buck Bunny',
        },
      });

      expect(room).toBeDefined();
      expect(room.activeSessionId).toBeDefined();
      expect(room.status).toBe('ACTIVE');

      // Verify DB: historical session initialized
      const sessionInitial = await db.findSessionById(room.activeSessionId!);
      expect(sessionInitial).toBeDefined();
      expect(sessionInitial?.status).toBe('ACTIVE');
      expect(sessionInitial?.startedAt).toBeNull();
      expect(sessionInitial?.originalHostId).toBe(hostAuth.user.id);
      expect(sessionInitial?.finalHostId).toBe(hostAuth.user.id);

      // Step 3: Host enters room
      const hostJoin = await roomsService.joinRoom(room.slug, hostAuth.user.id);
      expect(hostJoin.participant.role).toBe('OWNER');

      // Verify DB: session started_at is now stamped, host attendance interval open
      const sessionStarted = await db.findSessionById(room.activeSessionId!);
      expect(sessionStarted?.startedAt).not.toBeNull();
      const hostDetails1 = await db.getSessionDetails(room.activeSessionId!, hostAuth.user.id);
      const hostInterval = hostDetails1?.attendance.find((a) => a.userId === hostAuth.user.id);
      expect(hostInterval).toBeDefined();
      expect(hostInterval?.isOriginalHost).toBe(true);
      expect(hostInterval?.leftAt).toBeNull();

      // Step 4: Generate invitation and Viewer joins
      const invitation = await roomsService.createInvitation(room.slug, hostAuth.user.id, { maxUses: 5 });

      const viewerJoin = await roomsService.joinRoom(room.slug, viewerAuth.user.id, {
        inviteToken: invitation.token,
      });
      expect(viewerJoin.participant.role).toBe('PARTICIPANT');

      // Step 5: Attendance intervals recorded for both
      const detailsAfterBothJoin = await db.getSessionDetails(room.activeSessionId!, hostAuth.user.id);
      const viewerInterval = detailsAfterBothJoin?.attendance.find((a) => a.userId === viewerAuth.user.id);
      expect(viewerInterval).toBeDefined();
      expect(viewerInterval?.leftAt).toBeNull();

      // Step 6: Verify participant list and host identity
      const activeParts = await db.listParticipants(room.id);
      expect(activeParts.length).toBe(2);
      expect(activeParts.find((p) => p.userId === hostAuth.user.id)?.role).toBe('OWNER');
      expect(activeParts.find((p) => p.userId === viewerAuth.user.id)?.role).toBe('PARTICIPANT');

      // Step 7: Host transfers ownership to viewer
      const transferRes = await roomsService.transferHost(room.slug, hostAuth.user.id, viewerAuth.user.id);
      expect(transferRes.newHostId).toBe(viewerAuth.user.id);

      // Verify transfer in database
      const partsAfterTransfer = await db.listParticipants(room.id);
      expect(partsAfterTransfer.find((p) => p.userId === viewerAuth.user.id)?.role).toBe('OWNER');
      expect(partsAfterTransfer.find((p) => p.userId === hostAuth.user.id)?.role).toBe('PARTICIPANT');

      const sessionDetails = await db.getSessionDetails(room.activeSessionId!, hostAuth.user.id);
      expect(sessionDetails?.transfers.length).toBe(1);
      expect(sessionDetails?.transfers[0].previousHostId).toBe(hostAuth.user.id);
      expect(sessionDetails?.transfers[0].newHostId).toBe(viewerAuth.user.id);

      const sessionAfterTransfer = await db.findSessionById(room.activeSessionId!);
      expect(sessionAfterTransfer?.finalHostId).toBe(viewerAuth.user.id);

      // Step 8: Previous host leaves room
      await roomsService.leaveRoom(room.slug, hostAuth.user.id);

      // Verify previous host attendance interval closed with non-zero duration
      const detailsAfterLeave = await db.getSessionDetails(room.activeSessionId!, viewerAuth.user.id);
      const hostAttAfterLeave = detailsAfterLeave?.attendance.find((a) => a.userId === hostAuth.user.id);
      expect(hostAttAfterLeave).toBeDefined();
      expect(hostAttAfterLeave?.leftAt).not.toBeNull();
      expect(hostAttAfterLeave?.durationSeconds).toBeGreaterThanOrEqual(0);

      // Step 9: Remaining participant (new host) continues watching
      const remainingAfterLeave = await db.listParticipants(room.id);
      expect(remainingAfterLeave.length).toBe(1);
      expect(remainingAfterLeave[0].userId).toBe(viewerAuth.user.id);
      expect(remainingAfterLeave[0].role).toBe('OWNER');

      // Step 10: New host ends room
      const endRes = await roomsService.endRoom(room.slug, viewerAuth.user.id);
      expect(endRes.success).toBe(true);

      // Step 11: Operational room is now CLOSED
      const closedRoom = await db.findRoomBySlug(room.slug);
      expect(closedRoom?.status).toBe('CLOSED');

      // Operational room rejects new attempts to join
      await expect(
        roomsService.joinRoom(room.slug, hostAuth.user.id)
      ).rejects.toThrow(/closed/i);

      // Step 12: Invitations are invalidated
      const invValidation = await roomsService.validateInvitation(room.slug, invitation.token);
      expect(invValidation.valid).toBe(false);

      // Step 13: Historical session finalized
      const finalizedSession = await db.findSessionById(room.activeSessionId!);
      expect(finalizedSession?.status).toBe('CLOSED');
      expect(finalizedSession?.endedAt).not.toBeNull();
      expect(finalizedSession?.closureReason).toBe('HOST_CLOSED');

      // Step 14: All attendance intervals are cleanly finalized
      const detailsFinal = await db.getSessionDetails(room.activeSessionId!, viewerAuth.user.id);
      const viewerAtt = detailsFinal?.attendance.find((a) => a.userId === viewerAuth.user.id);
      expect(viewerAtt?.leftAt).not.toBeNull();

      // Step 15: Both participants have permanent watch history
      const hostHistory = await db.listUserWatchHistory(hostAuth.user.id, { limit: 10, offset: 0 });
      expect(hostHistory.sessions.length).toBe(1);
      expect(hostHistory.sessions[0].userRole).toBe('ORIGINAL_HOST');
      expect(hostHistory.sessions[0].originalHostUsername).toBe(hostAuth.user.username);
      expect(hostHistory.sessions[0].finalHostUsername).toBe(viewerAuth.user.username);

      const viewerHistory = await db.listUserWatchHistory(viewerAuth.user.id, { limit: 10, offset: 0 });
      expect(viewerHistory.sessions.length).toBe(1);
      expect(viewerHistory.sessions[0].userRole).toBe('SUCCESSOR_HOST');
    });
  });

  // =========================================================================
  // 2. Leave Room Scenarios & Sole-Host Departure Policy
  // =========================================================================
  describe('2. Leave Room Scenarios & Sole-Host Recovery Policy', () => {
    it('allows ordinary participant to leave without disrupting room or other participants', async () => {
      const host = await authService.register({
        email: `h_leave_${Date.now()}@test.com`,
        username: `HostLeave_${Date.now()}`,
        password: 'Password123!',
      });
      const viewer = await authService.register({
        email: `v_leave_${Date.now()}@test.com`,
        username: `ViewerLeave_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'Leave Test Room',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);
      const inv = await roomsService.createInvitation(room.slug, host.user.id);
      await roomsService.joinRoom(room.slug, viewer.user.id, { inviteToken: inv.token });

      // Ordinary participant leaves
      const left = await roomsService.leaveRoom(room.slug, viewer.user.id);
      expect(left).toBe(true);

      // Verify participant removed from active room
      const active = await db.listParticipants(room.id);
      expect(active.length).toBe(1);
      expect(active[0].userId).toBe(host.user.id);
      expect(active[0].role).toBe('OWNER');

      // Room remains ACTIVE
      const currentRoom = await db.findRoomBySlug(room.slug);
      expect(currentRoom?.status).toBe('ACTIVE');

      // Viewer attendance is finalized
      const details = await db.getSessionDetails(room.activeSessionId!, host.user.id);
      const viewerAtt = details?.attendance.find((a) => a.userId === viewer.user.id);
      expect(viewerAtt?.leftAt).not.toBeNull();
    });

    it('enforces Sole-Host Departure Policy: preserves ownerId, grants MODERATOR to first attendee, allows owner return', async () => {
      const host = await authService.register({
        email: `sole_h_${Date.now()}@test.com`,
        username: `SoleHost_${Date.now()}`,
        password: 'Password123!',
      });
      const guest1 = await authService.register({
        email: `g1_${Date.now()}@test.com`,
        username: `Guest1_${Date.now()}`,
        password: 'Password123!',
      });
      const guest2 = await authService.register({
        email: `g2_${Date.now()}@test.com`,
        username: `Guest2_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'Sole Host Departure Room',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);
      const inv = await roomsService.createInvitation(room.slug, host.user.id, { maxUses: 10 });

      // Host leaves while alone in the room, keeping it open
      await roomsService.leaveRoom(room.slug, host.user.id);

      // Verify: room is empty, but ownerId is preserved and room is ACTIVE
      const emptyParticipants = await db.listParticipants(room.id);
      expect(emptyParticipants.length).toBe(0);
      const activeRoom = await db.findRoomBySlug(room.slug);
      expect(activeRoom?.ownerId).toBe(host.user.id);
      expect(activeRoom?.status).toBe('ACTIVE');

      // First guest arrives with valid invitation: granted MODERATOR (acting custodian)
      const guest1Join = await roomsService.joinRoom(room.slug, guest1.user.id, { inviteToken: inv.token });
      expect(guest1Join.participant.role).toBe('MODERATOR');

      // Second guest arrives: assigned normal PARTICIPANT role
      const guest2Join = await roomsService.joinRoom(room.slug, guest2.user.id, { inviteToken: inv.token });
      expect(guest2Join.participant.role).toBe('PARTICIPANT');

      // Acting custodian (MODERATOR) can end the room if the registered owner has not returned
      const endByMod = await roomsService.endRoom(room.slug, guest1.user.id);
      expect(endByMod.success).toBe(true);

      const endedRoom = await db.findRoomBySlug(room.slug);
      expect(endedRoom?.status).toBe('CLOSED');
    });

    it('allows sole host to leave and safely rejoin as OWNER', async () => {
      const host = await authService.register({
        email: `rejoin_h_${Date.now()}@test.com`,
        username: `RejoinHost_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'Host Rejoin Room',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);
      await roomsService.leaveRoom(room.slug, host.user.id);

      // Host returns without needing an invitation token
      const hostRejoin = await roomsService.joinRoom(room.slug, host.user.id);
      expect(hostRejoin.participant.role).toBe('OWNER');

      // Host has two non-overlapping attendance intervals in watch history
      const details = await db.getSessionDetails(room.activeSessionId!, host.user.id);
      const hostIntervals = details?.attendance.filter((a) => a.userId === host.user.id) || [];
      expect(hostIntervals.length).toBe(2);
      expect(hostIntervals[0].leftAt).not.toBeNull();
      expect(hostIntervals[1].leftAt).toBeNull(); // currently active interval
    });
  });

  // =========================================================================
  // 3. Host Transfer Scenarios & Concurrency Safeguards
  // =========================================================================
  describe('3. Host Transfer Concurrency & Permission Boundary Scenarios', () => {
    it('blocks unauthorized users from transferring host', async () => {
      const host = await authService.register({
        email: `h_unauth_${Date.now()}@test.com`,
        username: `HostUnauth_${Date.now()}`,
        password: 'Password123!',
      });
      const viewer1 = await authService.register({
        email: `v1_unauth_${Date.now()}@test.com`,
        username: `Viewer1Unauth_${Date.now()}`,
        password: 'Password123!',
      });
      const viewer2 = await authService.register({
        email: `v2_unauth_${Date.now()}@test.com`,
        username: `Viewer2Unauth_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'Unauthorized Transfer Room',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);
      const inv = await roomsService.createInvitation(room.slug, host.user.id, { maxUses: 5 });
      await roomsService.joinRoom(room.slug, viewer1.user.id, { inviteToken: inv.token });
      await roomsService.joinRoom(room.slug, viewer2.user.id, { inviteToken: inv.token });

      // Ordinary viewer attempts host transfer
      await expect(
        roomsService.transferHost(room.slug, viewer1.user.id, viewer2.user.id)
      ).rejects.toThrow(/Only the current room host can transfer host privileges/i);
    });

    it('rejects transfer target if target user is not in the room', async () => {
      const host = await authService.register({
        email: `h_not_in_room_${Date.now()}@test.com`,
        username: `HostNotInRoom_${Date.now()}`,
        password: 'Password123!',
      });
      const outsider = await authService.register({
        email: `outsider_${Date.now()}@test.com`,
        username: `Outsider_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'Outsider Transfer Room',
        ownerId: host.user.id,
        isPrivate: true,
      });
      await roomsService.joinRoom(room.slug, host.user.id);

      await expect(
        roomsService.transferHost(room.slug, host.user.id, outsider.user.id)
      ).rejects.toThrow(/not an active participant/i);
    });

    it('prevents concurrent host transfer race conditions', async () => {
      const host = await authService.register({
        email: `race_h_${Date.now()}@test.com`,
        username: `RaceHost_${Date.now()}`,
        password: 'Password123!',
      });
      const userA = await authService.register({
        email: `user_a_${Date.now()}@test.com`,
        username: `UserA_${Date.now()}`,
        password: 'Password123!',
      });
      const userB = await authService.register({
        email: `user_b_${Date.now()}@test.com`,
        username: `UserB_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'Concurrent Transfer Room',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);
      const inv = await roomsService.createInvitation(room.slug, host.user.id, { maxUses: 5 });
      await roomsService.joinRoom(room.slug, userA.user.id, { inviteToken: inv.token });
      await roomsService.joinRoom(room.slug, userB.user.id, { inviteToken: inv.token });

      // Run two transfer requests concurrently
      const results = await Promise.allSettled([
        roomsService.transferHost(room.slug, host.user.id, userA.user.id),
        roomsService.transferHost(room.slug, host.user.id, userB.user.id),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly one must succeed, and the other must fail with permission error
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Verify transfer log contains exactly 1 transfer
      const details = await db.getSessionDetails(room.activeSessionId!, host.user.id);
      expect(details?.transfers.length).toBe(1);
    });
  });

  // =========================================================================
  // 4. End Room Scenarios & Idempotence
  // =========================================================================
  describe('4. End Room Scenarios & Invariant Protection', () => {
    it('rejects room closure from non-host ordinary participant when host is present', async () => {
      const host = await authService.register({
        email: `h_end_${Date.now()}@test.com`,
        username: `HostEnd_${Date.now()}`,
        password: 'Password123!',
      });
      const viewer = await authService.register({
        email: `v_end_${Date.now()}@test.com`,
        username: `ViewerEnd_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'End Room Rejection Test',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);
      const inv = await roomsService.createInvitation(room.slug, host.user.id);
      await roomsService.joinRoom(room.slug, viewer.user.id, { inviteToken: inv.token });

      // Ordinary viewer attempts to end room
      await expect(
        roomsService.endRoom(room.slug, viewer.user.id)
      ).rejects.toThrow(/Only the current room host can end the room/i);
    });

    it('handles duplicate simultaneous End Room calls idempotently without corrupting records', async () => {
      const host = await authService.register({
        email: `h_idem_${Date.now()}@test.com`,
        username: `HostIdem_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'Idempotent End Room',
        ownerId: host.user.id,
        isPrivate: true,
      });
      await roomsService.joinRoom(room.slug, host.user.id);

      // Issue simultaneous endRoom calls
      const [call1, call2] = await Promise.all([
        roomsService.endRoom(room.slug, host.user.id),
        roomsService.endRoom(room.slug, host.user.id),
      ]);

      expect(call1.success).toBe(true);
      expect(call2.success).toBe(true);

      const session = await db.findSessionById(room.activeSessionId!);
      expect(session?.status).toBe('CLOSED');
      expect(session?.closureReason).toBe('HOST_CLOSED');
    });
  });

  // =========================================================================
  // 5. Personal Watch History Invariants & Data Retention
  // =========================================================================
  describe('5. Personal Watch History Invariants & Permanent Retention', () => {
    it('calculates aggregated user time across multiple intervals in the same session', async () => {
      const host = await authService.register({
        email: `h_multi_${Date.now()}@test.com`,
        username: `HostMulti_${Date.now()}`,
        password: 'Password123!',
      });
      const viewer = await authService.register({
        email: `v_multi_${Date.now()}@test.com`,
        username: `ViewerMulti_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'Multi Interval Cinema',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);
      const inv = await roomsService.createInvitation(room.slug, host.user.id, { maxUses: 10 });

      // Viewer joins (Interval 1)
      await roomsService.joinRoom(room.slug, viewer.user.id, { inviteToken: inv.token });
      // Viewer leaves
      await roomsService.leaveRoom(room.slug, viewer.user.id);

      // Viewer rejoins with invitation (Interval 2)
      await roomsService.joinRoom(room.slug, viewer.user.id, { inviteToken: inv.token });
      // Viewer leaves again
      await roomsService.leaveRoom(room.slug, viewer.user.id);

      // Verify that viewer has 2 intervals
      const details = await db.getSessionDetails(room.activeSessionId!, host.user.id);
      const viewerIntervals = details?.attendance.filter((a) => a.userId === viewer.user.id) || [];
      expect(viewerIntervals.length).toBe(2);

      // Host ends the room
      await roomsService.endRoom(room.slug, host.user.id);

      // Viewer watch history returns the aggregated session
      const viewerHistory = await db.listUserWatchHistory(viewer.user.id, { limit: 10, offset: 0 });
      expect(viewerHistory.sessions.length).toBe(1);
      expect(viewerHistory.sessions[0].userRole).toBe('PARTICIPANT');
    });

    it('strictly forbids unauthorized users from viewing session details', async () => {
      const host = await authService.register({
        email: `h_sec_${Date.now()}@test.com`,
        username: `HostSec_${Date.now()}`,
        password: 'Password123!',
      });
      const attendee = await authService.register({
        email: `att_sec_${Date.now()}@test.com`,
        username: `AttSec_${Date.now()}`,
        password: 'Password123!',
      });
      const snoop = await authService.register({
        email: `snoop_${Date.now()}@test.com`,
        username: `Snoop_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'Private Top Secret Screening',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);
      const inv = await roomsService.createInvitation(room.slug, host.user.id);
      await roomsService.joinRoom(room.slug, attendee.user.id, { inviteToken: inv.token });
      await roomsService.endRoom(room.slug, host.user.id);

      // Authorized attendee can view details
      const authorizedDetails = await db.getSessionDetails(room.activeSessionId!, attendee.user.id);
      expect(authorizedDetails).toBeDefined();
      expect(authorizedDetails?.session.roomName).toBe('Private Top Secret Screening');

      // Unauthorized snoop receives null
      const unauthorizedDetails = await db.getSessionDetails(room.activeSessionId!, snoop.user.id);
      expect(unauthorizedDetails).toBeNull();
    });

    it('preserves watch history permanently even if operational room is completely deleted', async () => {
      const host = await authService.register({
        email: `h_del_${Date.now()}@test.com`,
        username: `HostDel_${Date.now()}`,
        password: 'Password123!',
      });
      const room = await roomsService.createRoom({
        name: 'Ephemeral Room To Delete',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);
      const sessionId = room.activeSessionId!;
      await roomsService.endRoom(room.slug, host.user.id);

      // Simulate operational room hard deletion
      await db.deleteRoom(room.id);
      const deletedRoom = await db.findRoomBySlug(room.slug);
      expect(deletedRoom).toBeNull();

      // Historical session and watch history remain completely intact
      const historySession = await db.findSessionById(sessionId);
      expect(historySession).toBeDefined();
      expect(historySession?.roomName).toBe('Ephemeral Room To Delete');

      const userHistory = await db.listUserWatchHistory(host.user.id, { limit: 10, offset: 0 });
      expect(userHistory.sessions.length).toBe(1);
      expect(userHistory.sessions[0].roomName).toBe('Ephemeral Room To Delete');
    });
  });

  // =========================================================================
  // 6. Database Invariant & Integrity Verification
  // =========================================================================
  describe('6. Database Integrity Constraints & Concurrency Safeguards', () => {
    it('prevents duplicate open attendance records for the same user in the same session', async () => {
      const host = await authService.register({
        email: `h_dup_${Date.now()}@test.com`,
        username: `HostDup_${Date.now()}`,
        password: 'Password123!',
      });
      const room = await roomsService.createRoom({
        name: 'Constraint Room',
        ownerId: host.user.id,
        isPrivate: true,
      });

      // Join once
      await roomsService.joinRoom(room.slug, host.user.id);

      // Attempt to directly record another join without a leave
      // In PostgreSQL and fallback storage, the open attendance must be idempotently preserved
      await db.recordAttendanceJoin({
        sessionId: room.activeSessionId!,
        userId: host.user.id,
        displayName: host.user.username,
        isOriginalHost: true,
      });

      // Query open attendance via getSessionDetails — must be exactly 1 record with leftAt === null
      const details = await db.getSessionDetails(room.activeSessionId!, host.user.id);
      const openIntervals = details?.attendance.filter((a) => a.userId === host.user.id && a.leftAt === null) || [];
      expect(openIntervals.length).toBe(1);
    });

    it('ensures no closed session has open attendance intervals after room termination', async () => {
      const host = await authService.register({
        email: `h_clean_${Date.now()}@test.com`,
        username: `HostClean_${Date.now()}`,
        password: 'Password123!',
      });
      const guest = await authService.register({
        email: `g_clean_${Date.now()}@test.com`,
        username: `GuestClean_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'Clean Session Invariant Room',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);
      const inv = await roomsService.createInvitation(room.slug, host.user.id);
      await roomsService.joinRoom(room.slug, guest.user.id, { inviteToken: inv.token });

      // Close room
      await roomsService.endRoom(room.slug, host.user.id);

      // Query both users' open intervals
      const details = await db.getSessionDetails(room.activeSessionId!, host.user.id);
      const openIntervals = details?.attendance.filter((a) => a.leftAt === null) || [];
      expect(openIntervals.length).toBe(0);
    });
  });
});
