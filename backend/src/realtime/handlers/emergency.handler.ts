import { Server } from 'socket.io';
import { db } from '../../database';
import { stateManager } from '../state.manager';
import { AuthenticatedSocket } from '../types';
import { checkControlPermission } from './playback.handler';

export function registerEmergencyHandlers(io: Server, socket: AuthenticatedSocket) {
  // 1. EMERGENCY_PAUSE (Accessible to ANY authenticated participant of the room)
  socket.on(
    'EMERGENCY_PAUSE',
    async (
      data?: { roomSlug?: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        // 1. Enforce authentication
        if (!socket.user || !socket.user.userId) {
          const errorMsg = 'Authentication required to trigger emergency pause.';
          socket.emit('ERROR', { code: 'UNAUTHENTICATED', message: errorMsg });
          callback?.({ success: false, error: errorMsg });
          return;
        }

        // 2. Resolve room context
        const roomSlug = socket.roomSlug || data?.roomSlug;
        if (!roomSlug && !socket.roomId) {
          const errorMsg = 'No active room specified for emergency pause.';
          socket.emit('ERROR', { code: 'NOT_IN_ROOM', message: errorMsg });
          callback?.({ success: false, error: errorMsg });
          return;
        }

        let room = socket.roomId ? await db.findRoomById(socket.roomId) : null;
        if (!room && roomSlug) {
          room = await db.findRoomBySlug(roomSlug);
        }

        if (!room) {
          const errorMsg = 'Watch room not found.';
          socket.emit('ERROR', { code: 'NOT_FOUND', message: errorMsg });
          callback?.({ success: false, error: errorMsg });
          return;
        }

        // 3. Enforce room membership: sender must be room owner or authenticated participant
        const userId = socket.user.userId;
        const isOwner = room.ownerId === userId;
        const participant = await db.findParticipant(room.id, userId);

        if (!isOwner && !participant) {
          const errorMsg = 'Access denied: You must be an authorized member of this room to trigger an emergency pause.';
          socket.emit('ERROR', { code: 'FORBIDDEN', message: errorMsg });
          callback?.({ success: false, error: errorMsg });
          return;
        }

        // Ensure socket has room context cached only after authorization passes
        socket.roomId = room.id;
        socket.roomSlug = room.slug;

        const caller = {
          userId,
          username: socket.user.username || 'A participant',
        };

        // 4. Update server-authoritative playback state
        const state = await stateManager.getOrCreateRoomState(room.id, room.slug);

        // If already emergency paused, safely acknowledge without duplicate broadcasts
        if (state.isEmergencyPaused) {
          callback?.({ success: true });
          return;
        }

        const updatedState = stateManager.emergencyPause(room.id, caller);
        const snapshot = stateManager.getSnapshot(updatedState);
        const roomChannel = `room:${room.slug}`;

        // 5. Broadcast pause state to every connected participant in the room
        io.to(roomChannel).emit('EMERGENCY_PAUSE_TRIGGERED', {
          triggeredBy: caller,
          playbackState: snapshot,
        });
        io.to(roomChannel).emit('EMERGENCY_PAUSED', {
          triggeredBy: caller,
          pausedBy: caller,
          playbackState: snapshot,
        });
        io.to(roomChannel).emit('SYNC_STATE', snapshot);

        // 6. System announcement in room chat
        const sysMsg = await db.createChatMessage({
          roomId: room.id,
          userId: caller.userId,
          username: 'System Alert',
          content: `🛑 EMERGENCY PAUSE activated by @${caller.username}! Playback stopped. Only the room host can resume.`,
          isSystem: true,
        });
        io.to(roomChannel).emit('NEW_CHAT_MESSAGE', sysMsg);

        // 7. Successful acknowledgment
        callback?.({ success: true });
      } catch (err: any) {
        console.error('[EmergencyHandler] Error triggering emergency pause:', err);
        const message = err.message || 'Failed to activate emergency pause.';
        socket.emit('ERROR', { code: 'EMERGENCY_PAUSE_FAILED', message });
        callback?.({ success: false, error: message });
      }
    }
  );

  // 2. RESUME_FROM_EMERGENCY (Only Owner / Moderator)
  socket.on(
    'RESUME_FROM_EMERGENCY',
    async (
      data?: { roomSlug?: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        if (!socket.user || !socket.user.userId) {
          const errorMsg = 'Authentication required to resume playback.';
          socket.emit('ERROR', { code: 'UNAUTHENTICATED', message: errorMsg });
          callback?.({ success: false, error: errorMsg });
          return;
        }

        const roomSlug = socket.roomSlug || data?.roomSlug;
        let room = socket.roomId ? await db.findRoomById(socket.roomId) : null;
        if (!room && roomSlug) {
          room = await db.findRoomBySlug(roomSlug);
        }

        if (!room) {
          const errorMsg = 'Watch room not found.';
          socket.emit('ERROR', { code: 'NOT_FOUND', message: errorMsg });
          callback?.({ success: false, error: errorMsg });
          return;
        }

        const hasPermission = await checkControlPermission(room.id, socket.user.userId);
        if (!hasPermission) {
          const errorMsg = 'Only the room host can clear an Emergency Pause and resume.';
          socket.emit('ERROR', { code: 'FORBIDDEN', message: errorMsg });
          callback?.({ success: false, error: errorMsg });
          return;
        }

        socket.roomId = room.id;
        socket.roomSlug = room.slug;

        const updatedState = stateManager.resumeFromEmergency(room.id);
        const snapshot = stateManager.getSnapshot(updatedState);
        const roomChannel = `room:${room.slug}`;

        io.to(roomChannel).emit('SYNC_STATE', snapshot);

        const username = socket.user.username || 'Host';
        const sysMsg = await db.createChatMessage({
          roomId: room.id,
          userId: socket.user.userId,
          username: 'System Alert',
          content: `▶️ Emergency Pause cleared by @${username}. Playback resumed!`,
          isSystem: true,
        });
        io.to(roomChannel).emit('NEW_CHAT_MESSAGE', sysMsg);

        callback?.({ success: true });
      } catch (err: any) {
        console.error('[EmergencyHandler] Error resuming from emergency pause:', err);
        const message = err.message || 'Failed to resume playback.';
        socket.emit('ERROR', { code: 'RESUME_FAILED', message });
        callback?.({ success: false, error: message });
      }
    }
  );
}
