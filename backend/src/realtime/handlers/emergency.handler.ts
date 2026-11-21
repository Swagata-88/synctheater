import { Server } from 'socket.io';
import { db } from '../../database';
import { stateManager } from '../state.manager';
import { AuthenticatedSocket } from '../types';
import { checkControlPermission } from './playback.handler';

export function registerEmergencyHandlers(io: Server, socket: AuthenticatedSocket) {
  // 1. EMERGENCY_PAUSE (Accessible to ANY participant)
  socket.on('EMERGENCY_PAUSE', async () => {
    try {
      if (!socket.roomId || !socket.roomSlug) return;

      const caller = {
        userId: socket.user?.userId || socket.id,
        username: socket.user?.username || 'A participant',
      };

      const updatedState = stateManager.emergencyPause(socket.roomId, caller);
      const snapshot = stateManager.getSnapshot(updatedState);

      // Broadcast to everyone in room
      io.to(`room:${socket.roomSlug}`).emit('EMERGENCY_PAUSE_TRIGGERED', {
        triggeredBy: caller,
        playbackState: snapshot,
      });
      io.to(`room:${socket.roomSlug}`).emit('SYNC_STATE', snapshot);

      // Announce in chat
      const sysMsg = await db.createChatMessage({
        roomId: socket.roomId,
        userId: caller.userId,
        username: 'System Alert',
        content: `🛑 EMERGENCY PAUSE activated by @${caller.username}! Playback stopped. Only the room host can resume.`,
        isSystem: true,
      });
      io.to(`room:${socket.roomSlug}`).emit('NEW_CHAT_MESSAGE', sysMsg);
    } catch (err: any) {
      socket.emit('ERROR', { message: err.message });
    }
  });

  // 2. RESUME_FROM_EMERGENCY (Only Owner / Moderator)
  socket.on('RESUME_FROM_EMERGENCY', async () => {
    try {
      if (!socket.roomId || !socket.roomSlug) return;
      const hasPermission = await checkControlPermission(socket.roomId, socket.user?.userId);
      if (!hasPermission) {
        return socket.emit('ERROR', { message: 'Only the room host can clear an Emergency Pause and resume.' });
      }

      const updatedState = stateManager.resumeFromEmergency(socket.roomId);
      const snapshot = stateManager.getSnapshot(updatedState);

      io.to(`room:${socket.roomSlug}`).emit('SYNC_STATE', snapshot);

      const username = socket.user?.username || 'Host';
      const sysMsg = await db.createChatMessage({
        roomId: socket.roomId,
        userId: socket.user?.userId || 'system',
        username: 'System Alert',
        content: `▶️ Emergency Pause cleared by @${username}. Playback resumed!`,
        isSystem: true,
      });
      io.to(`room:${socket.roomSlug}`).emit('NEW_CHAT_MESSAGE', sysMsg);
    } catch (err: any) {
      socket.emit('ERROR', { message: err.message });
    }
  });
}
