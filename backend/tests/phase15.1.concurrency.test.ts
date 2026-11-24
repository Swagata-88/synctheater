import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/database';
import { RoomsService } from '../src/modules/rooms/rooms.service';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Phase 15.1: Database-Level Concurrency & Idempotency Hardening', () => {
  let roomsService: RoomsService;
  let authService: AuthService;

  beforeEach(async () => {
    roomsService = new RoomsService();
    authService = new AuthService();
  });

  // =========================================================================
  // 1. Atomic Host Transfer (Database Transaction & Mutex Hardening)
  // =========================================================================
  describe('1. Atomic Host Transfer Under Concurrency', () => {
    it('prevents conflicting concurrent host transfers even when issued from separate service instances', async () => {
      // Simulate two separate backend service instances
      const serviceInstance1 = new RoomsService();
      const serviceInstance2 = new RoomsService();

      const host = await authService.register({
        email: `h_atomic_${Date.now()}@test.com`,
        username: `HostAtomic_${Date.now()}`,
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
        name: 'Atomic Transfer Cinema',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);
      const inv = await roomsService.createInvitation(room.slug, host.user.id, { maxUses: 10 });
      await roomsService.joinRoom(room.slug, userA.user.id, { inviteToken: inv.token });
      await roomsService.joinRoom(room.slug, userB.user.id, { inviteToken: inv.token });

      // Run two transfers concurrently from the two distinct service instances
      const results = await Promise.allSettled([
        serviceInstance1.transferHost(room.slug, host.user.id, userA.user.id),
        serviceInstance2.transferHost(room.slug, host.user.id, userB.user.id),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly one must succeed, and the other must be rejected
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Verify database state: room owner matches the winning transfer
      const updatedRoom = await db.findRoomBySlug(room.slug);
      const winningHostId = (fulfilled[0] as PromiseFulfilledResult<any>).value.newHostId;
      expect(updatedRoom?.ownerId).toBe(winningHostId);

      // Verify participant roles in database
      const participants = await db.listParticipants(room.id);
      const winningParticipant = participants.find((p) => p.userId === winningHostId);
      const previousHostParticipant = participants.find((p) => p.userId === host.user.id);
      expect(winningParticipant?.role).toBe('OWNER');
      expect(previousHostParticipant?.role).toBe('PARTICIPANT');

      // Verify host transfer history contains exactly 1 record
      const sessionDetails = await db.getSessionDetails(room.activeSessionId!, winningHostId);
      expect(sessionDetails?.transfers.length).toBe(1);
      expect(sessionDetails?.transfers[0].previousHostId).toBe(host.user.id);
      expect(sessionDetails?.transfers[0].newHostId).toBe(winningHostId);
    });

    it('rolls back completely if a host transfer fails halfway through', async () => {
      const host = await authService.register({
        email: `h_fail_${Date.now()}@test.com`,
        username: `HostFail_${Date.now()}`,
        password: 'Password123!',
      });
      const room = await roomsService.createRoom({
        name: 'Rollback Transfer Cinema',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);

      // Attempt to transfer host to a user who is NOT in the room
      const nonexistentUserId = 'nonexistent_user_' + Date.now();
      await expect(
        db.executeAtomicHostTransfer({
          roomId: room.id,
          roomSlug: room.slug,
          currentHostId: host.user.id,
          newHostId: nonexistentUserId,
          newHostUsername: 'Nonexistent',
          currentHostUsername: host.user.username,
          sessionId: room.activeSessionId,
        })
      ).rejects.toThrow(/not an active participant/i);

      // Verify room owner remains unchanged
      const currentRoom = await db.findRoomBySlug(room.slug);
      expect(currentRoom?.ownerId).toBe(host.user.id);

      // Verify host role remains unchanged
      const participants = await db.listParticipants(room.id);
      expect(participants.find((p) => p.userId === host.user.id)?.role).toBe('OWNER');

      // Verify no transfer record was inserted
      const sessionDetails = await db.getSessionDetails(room.activeSessionId!, host.user.id);
      expect(sessionDetails?.transfers.length).toBe(0);
    });
  });

  // =========================================================================
  // 2. Atomic Acting Custodian Assignment & Permission Boundaries
  // =========================================================================
  describe('2. Atomic Acting Custodian Assignment', () => {
    it('serializes simultaneous joins so that only ONE eligible attendee becomes Acting Custodian', async () => {
      const host = await authService.register({
        email: `h_cust_${Date.now()}@test.com`,
        username: `HostCust_${Date.now()}`,
        password: 'Password123!',
      });
      const attendee1 = await authService.register({
        email: `att1_${Date.now()}@test.com`,
        username: `Attendee1_${Date.now()}`,
        password: 'Password123!',
      });
      const attendee2 = await authService.register({
        email: `att2_${Date.now()}@test.com`,
        username: `Attendee2_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'Custodian Concurrency Room',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);
      const inv = await roomsService.createInvitation(room.slug, host.user.id, { maxUses: 10 });

      // Host leaves alone, keeping room open
      await roomsService.leaveRoom(room.slug, host.user.id);

      // Verify room has 0 participants
      const emptyParts = await db.listParticipants(room.id);
      expect(emptyParts.length).toBe(0);

      // Two attendees join simultaneously
      const [join1, join2] = await Promise.all([
        roomsService.joinRoom(room.slug, attendee1.user.id, { inviteToken: inv.token }),
        roomsService.joinRoom(room.slug, attendee2.user.id, { inviteToken: inv.token }),
      ]);

      const roles = [join1.participant.role, join2.participant.role];

      // Exactly ONE must be MODERATOR and the other must be PARTICIPANT
      expect(roles).toContain('MODERATOR');
      expect(roles).toContain('PARTICIPANT');

      const parts = await db.listParticipants(room.id);
      const modCount = parts.filter((p) => p.role === 'MODERATOR').length;
      expect(modCount).toBe(1);
    });

    it('allows registered owner to reclaim ownership without needing invitation or losing OWNER status', async () => {
      const host = await authService.register({
        email: `reclaim_h_${Date.now()}@test.com`,
        username: `ReclaimHost_${Date.now()}`,
        password: 'Password123!',
      });
      const guest = await authService.register({
        email: `reclaim_g_${Date.now()}@test.com`,
        username: `ReclaimGuest_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'Reclaim Owner Room',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);
      const inv = await roomsService.createInvitation(room.slug, host.user.id, { maxUses: 10 });
      await roomsService.leaveRoom(room.slug, host.user.id);

      // Guest joins and becomes Acting Custodian (MODERATOR)
      const guestJoin = await roomsService.joinRoom(room.slug, guest.user.id, { inviteToken: inv.token });
      expect(guestJoin.participant.role).toBe('MODERATOR');

      // Original owner returns
      const hostReturn = await roomsService.joinRoom(room.slug, host.user.id);
      expect(hostReturn.participant.role).toBe('OWNER');

      // Verify roles in room: Host is OWNER, guest remains MODERATOR
      const parts = await db.listParticipants(room.id);
      expect(parts.find((p) => p.userId === host.user.id)?.role).toBe('OWNER');
      expect(parts.find((p) => p.userId === guest.user.id)?.role).toBe('MODERATOR');
    });

    it('enforces strict permission boundaries for Acting Custodian (MODERATOR)', async () => {
      const host = await authService.register({
        email: `bound_h_${Date.now()}@test.com`,
        username: `BoundHost_${Date.now()}`,
        password: 'Password123!',
      });
      const modUser = await authService.register({
        email: `bound_m_${Date.now()}@test.com`,
        username: `BoundMod_${Date.now()}`,
        password: 'Password123!',
      });
      const normalUser = await authService.register({
        email: `bound_v_${Date.now()}@test.com`,
        username: `BoundViewer_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'Boundaries Room',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);
      const inv = await roomsService.createInvitation(room.slug, host.user.id, { maxUses: 10 });
      await roomsService.joinRoom(room.slug, modUser.user.id, { inviteToken: inv.token });
      await roomsService.joinRoom(room.slug, normalUser.user.id, { inviteToken: inv.token });

      // Promote modUser to MODERATOR
      await db.updateParticipantRole(room.id, modUser.user.id, 'MODERATOR');

      // 1. Moderator CANNOT transfer host
      await expect(
        roomsService.transferHost(room.slug, modUser.user.id, normalUser.user.id)
      ).rejects.toThrow(/Only the current room host can transfer host privileges/i);

      // 2. Moderator CANNOT kick the room owner
      await expect(
        roomsService.kickParticipant(room.slug, modUser.user.id, host.user.id)
      ).rejects.toThrow(/The room owner cannot be kicked/i);

      // 3. Moderator CANNOT end the room while registered owner is present
      await expect(
        roomsService.endRoom(room.slug, modUser.user.id)
      ).rejects.toThrow(/Only the current room host can end the room/i);

      // 4. Moderator CAN kick a normal participant
      const kicked = await roomsService.kickParticipant(room.slug, modUser.user.id, normalUser.user.id);
      expect(kicked).toBe(true);

      // 5. If host leaves, Moderator CAN end the room
      await roomsService.leaveRoom(room.slug, host.user.id);
      const endedByMod = await roomsService.endRoom(room.slug, modUser.user.id);
      expect(endedByMod.success).toBe(true);
    });
  });

  // =========================================================================
  // 3. Idempotent Session Finalization
  // =========================================================================
  describe('3. Idempotent Session Finalization', () => {
    it('handles simultaneous finalization calls and preserves original ended_at timestamp', async () => {
      const host = await authService.register({
        email: `h_idem_fin_${Date.now()}@test.com`,
        username: `HostIdemFin_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'Idempotent Finalization Room',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);

      // Simultaneous finalization calls
      const [final1, final2] = await Promise.all([
        db.finalizeRoomSession(room.activeSessionId!, 'HOST_CLOSED'),
        db.finalizeRoomSession(room.activeSessionId!, 'HOST_CLOSED'),
      ]);

      expect(final1).toBeDefined();
      expect(final2).toBeDefined();
      expect(final1?.endedAt).toBeDefined();
      expect(final2?.endedAt).toBeDefined();

      // Timestamps must be identical
      expect(new Date(final1!.endedAt!).getTime()).toBe(new Date(final2!.endedAt!).getTime());
    });

    it('strictly preserves original ended_at and closure_reason when called repeatedly later', async () => {
      const host = await authService.register({
        email: `h_repeat_${Date.now()}@test.com`,
        username: `HostRepeat_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'Repeat Finalization Room',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);
      const sessionId = room.activeSessionId!;

      const originalTime = new Date(Date.now() - 60000); // 1 minute ago
      const firstFinal = await db.finalizeRoomSession(sessionId, 'HOST_CLOSED', originalTime);
      expect(firstFinal?.status).toBe('CLOSED');
      expect(firstFinal?.closureReason).toBe('HOST_CLOSED');
      expect(new Date(firstFinal!.endedAt!).getTime()).toBe(originalTime.getTime());

      // Attempt repeated finalization with a newer timestamp and different closure reason
      const laterTime = new Date();
      const repeatedFinal = await db.finalizeRoomSession(sessionId, 'ABANDONED', laterTime);

      // Must preserve original endedAt and original closureReason
      expect(repeatedFinal?.status).toBe('CLOSED');
      expect(repeatedFinal?.closureReason).toBe('HOST_CLOSED'); // NOT overwritten to ABANDONED
      expect(new Date(repeatedFinal!.endedAt!).getTime()).toBe(originalTime.getTime()); // NOT overwritten to laterTime
    });

    it('ensures all open attendance intervals are cleanly finalized upon session closure', async () => {
      const host = await authService.register({
        email: `h_att_fin_${Date.now()}@test.com`,
        username: `HostAttFin_${Date.now()}`,
        password: 'Password123!',
      });
      const guest = await authService.register({
        email: `g_att_fin_${Date.now()}@test.com`,
        username: `GuestAttFin_${Date.now()}`,
        password: 'Password123!',
      });

      const room = await roomsService.createRoom({
        name: 'Attendance Finalize Room',
        ownerId: host.user.id,
        isPrivate: true,
      });

      await roomsService.joinRoom(room.slug, host.user.id);
      const inv = await roomsService.createInvitation(room.slug, host.user.id);
      await roomsService.joinRoom(room.slug, guest.user.id, { inviteToken: inv.token });

      const sessionId = room.activeSessionId!;

      // Finalize session
      await db.finalizeRoomSession(sessionId, 'HOST_CLOSED');

      // Verify no open attendance intervals remain
      const details = await db.getSessionDetails(sessionId, host.user.id);
      const openIntervals = details?.attendance.filter((a) => a.leftAt === null) || [];
      expect(openIntervals.length).toBe(0);

      // All attendees have leftAt stamped
      for (const att of details?.attendance || []) {
        expect(att.leftAt).not.toBeNull();
        expect(att.durationSeconds).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
