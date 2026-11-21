import { Server } from 'socket.io';
import { db } from '../../database';
import { stateManager } from '../state.manager';
import { videoService } from '../../modules/video/video.service';
import { AuthenticatedSocket } from '../types';

export async function checkControlPermission(roomId: string, userId?: string): Promise<boolean> {
  if (!userId) return false;
  const room = await db.findRoomById(roomId);
  if (!room) return false;
  if (room.ownerId === userId) return true;
  const part = await db.findParticipant(roomId, userId);
  return part?.role === 'OWNER' || part?.role === 'MODERATOR';
}

export function registerPlaybackHandlers(io: Server, socket: AuthenticatedSocket) {
  // 1. PLAY
  socket.on('PLAY', async (data: { reportedPosition?: number }) => {
    try {
      if (!socket.roomId || !socket.roomSlug) return;
      const hasPermission = await checkControlPermission(socket.roomId, socket.user?.userId);
      if (!hasPermission) {
        return socket.emit('ERROR', { message: 'Only the room host or moderators can control playback.' });
      }

      const updatedState = stateManager.play(socket.roomId, data?.reportedPosition);
      const snapshot = stateManager.getSnapshot(updatedState);
      io.to(`room:${socket.roomSlug}`).emit('SYNC_STATE', snapshot);
    } catch (err: any) {
      socket.emit('ERROR', { message: err.message });
    }
  });

  // 2. PAUSE
  socket.on('PAUSE', async (data: { reportedPosition?: number }) => {
    try {
      if (!socket.roomId || !socket.roomSlug) return;
      const hasPermission = await checkControlPermission(socket.roomId, socket.user?.userId);
      if (!hasPermission) {
        return socket.emit('ERROR', { message: 'Only the room host or moderators can control playback.' });
      }

      const updatedState = stateManager.pause(socket.roomId, data?.reportedPosition);
      const snapshot = stateManager.getSnapshot(updatedState);
      io.to(`room:${socket.roomSlug}`).emit('SYNC_STATE', snapshot);
    } catch (err: any) {
      socket.emit('ERROR', { message: err.message });
    }
  });

  // 3. SEEK
  socket.on('SEEK', async (data: { targetPosition: number }) => {
    try {
      if (!socket.roomId || !socket.roomSlug) return;
      const hasPermission = await checkControlPermission(socket.roomId, socket.user?.userId);
      if (!hasPermission) {
        return socket.emit('ERROR', { message: 'Only the room host or moderators can seek playback.' });
      }

      const updatedState = stateManager.seek(socket.roomId, data.targetPosition);
      const snapshot = stateManager.getSnapshot(updatedState);
      io.to(`room:${socket.roomSlug}`).emit('SYNC_STATE', snapshot);
    } catch (err: any) {
      socket.emit('ERROR', { message: err.message });
    }
  });

  // 4. CHANGE_VIDEO
  socket.on('CHANGE_VIDEO', async (data: { videoUrl: string }) => {
    try {
      if (!socket.roomId || !socket.roomSlug) return;
      const hasPermission = await checkControlPermission(socket.roomId, socket.user?.userId);
      if (!hasPermission) {
        return socket.emit('ERROR', { message: 'Only the room host or moderators can change the video.' });
      }

      const resolved = videoService.resolveUrl(data.videoUrl);
      if (!resolved.isSupported) {
        return socket.emit('ERROR', { message: resolved.notes || 'Unsupported video URL.' });
      }

      const updatedState = stateManager.changeVideo(socket.roomId, {
        provider: resolved.provider,
        videoId: resolved.videoId,
        videoUrl: resolved.originalUrl,
      });

      const snapshot = stateManager.getSnapshot(updatedState);
      io.to(`room:${socket.roomSlug}`).emit('SYNC_STATE', snapshot);

      // System message announcement
      const username = socket.user?.username || 'Host';
      const sysMsg = await db.createChatMessage({
        roomId: socket.roomId,
        userId: socket.user?.userId || 'system',
        username: 'System',
        content: `🎬 ${username} changed the video to: ${resolved.title}`,
        isSystem: true,
      });
      io.to(`room:${socket.roomSlug}`).emit('NEW_CHAT_MESSAGE', sysMsg);
    } catch (err: any) {
      socket.emit('ERROR', { message: err.message });
    }
  });

  // 5. CHANGE_PLAYBACK_RATE
  socket.on('CHANGE_PLAYBACK_RATE', async (data: { rate: number }) => {
    try {
      if (!socket.roomId || !socket.roomSlug) return;
      const hasPermission = await checkControlPermission(socket.roomId, socket.user?.userId);
      if (!hasPermission) {
        return socket.emit('ERROR', { message: 'Only the room host or moderators can change playback rate.' });
      }

      const updatedState = stateManager.setPlaybackRate(socket.roomId, data.rate);
      const snapshot = stateManager.getSnapshot(updatedState);
      io.to(`room:${socket.roomSlug}`).emit('SYNC_STATE', snapshot);
    } catch (err: any) {
      socket.emit('ERROR', { message: err.message });
    }
  });

  // 6. REQUEST_SYNC
  socket.on('REQUEST_SYNC', async () => {
    try {
      if (!socket.roomId) return;
      const state = await stateManager.getOrCreateRoomState(socket.roomId, socket.roomSlug || '');
      const snapshot = stateManager.getSnapshot(state);
      socket.emit('SYNC_STATE', snapshot);
    } catch (e) {}
  });
}
