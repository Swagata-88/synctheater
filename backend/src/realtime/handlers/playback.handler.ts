import { Server } from 'socket.io';
import { db } from '../../database';
import { BroadcastStatus, PlaybackMode } from '../../database/types';
import { stateManager } from '../state.manager';
import { videoService } from '../../modules/video/video.service';
import { AuthenticatedSocket } from '../types';

const VALID_PLAYBACK_MODES = new Set<PlaybackMode>(['VOD', 'LIVE']);
const VALID_BROADCAST_STATUSES = new Set<BroadcastStatus>([
  'UNKNOWN_UNVERIFIED',
  'ACTIVE_LIVE',
  'SCHEDULED_OR_WAITING',
  'ENDED',
  'RESTRICTED_OR_UNAVAILABLE',
  'ORDINARY_VOD',
]);

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
        playbackMode: resolved.playbackMode,
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

  // 7. NOTIFY_PLAYBACK_MODE_CONFIRMED
  socket.on(
    'NOTIFY_PLAYBACK_MODE_CONFIRMED',
    async (
      payload: {
        videoId?: unknown;
        mode?: unknown;
        broadcastStatus?: unknown;
        sequenceNumber?: unknown;
      },
      callback?: (res: { success: boolean; changed?: boolean; code?: string }) => void
    ) => {
      try {
        // Step 1: Authenticated socket
        if (!socket.user?.userId) {
          socket.emit('ERROR', { code: 'UNAUTHENTICATED', message: 'Authentication required.' });
          callback?.({ success: false, code: 'UNAUTHENTICATED' });
          return;
        }

        // Step 2: Room membership context
        if (!socket.roomId || !socket.roomSlug) {
          socket.emit('ERROR', { code: 'NOT_IN_ROOM', message: 'You must join a room first.' });
          callback?.({ success: false, code: 'NOT_IN_ROOM' });
          return;
        }

        // Step 3: Payload schema validation
        if (
          !payload ||
          typeof payload !== 'object' ||
          typeof payload.videoId !== 'string' ||
          !payload.videoId.trim() ||
          typeof payload.mode !== 'string' ||
          !VALID_PLAYBACK_MODES.has(payload.mode as PlaybackMode) ||
          typeof payload.broadcastStatus !== 'string' ||
          !VALID_BROADCAST_STATUSES.has(payload.broadcastStatus as BroadcastStatus) ||
          (payload.sequenceNumber !== undefined &&
            (typeof payload.sequenceNumber !== 'number' || !Number.isFinite(payload.sequenceNumber)))
        ) {
          socket.emit('ERROR', {
            code: 'INVALID_PAYLOAD',
            message: 'Invalid playback mode confirmation payload.',
          });
          callback?.({ success: false, code: 'INVALID_PAYLOAD' });
          return;
        }

        // Step 4: Active room lifecycle & membership check
        const room = await db.findRoomById(socket.roomId);
        if (!room) {
          socket.emit('ERROR', { code: 'NOT_FOUND', message: 'Watch room not found.' });
          callback?.({ success: false, code: 'NOT_FOUND' });
          return;
        }

        if (room.status === 'CLOSED') {
          socket.emit('ERROR', {
            code: 'ROOM_CLOSED',
            message: 'This watch room has been closed by the host.',
          });
          callback?.({ success: false, code: 'ROOM_CLOSED' });
          return;
        }

        const isOwner = room.ownerId === socket.user.userId;
        const participant = isOwner ? null : await db.findParticipant(room.id, socket.user.userId);
        if (!isOwner && !participant) {
          socket.emit('ERROR', { code: 'FORBIDDEN', message: 'Room membership required.' });
          callback?.({ success: false, code: 'FORBIDDEN' });
          return;
        }

        // Step 5: Controller authorization (Owner or Acting Custodian / Moderator only)
        const hasPermission = await checkControlPermission(socket.roomId, socket.user.userId);
        if (!hasPermission) {
          socket.emit('ERROR', {
            code: 'FORBIDDEN',
            message: 'Only the room host or moderators can confirm playback mode.',
          });
          callback?.({ success: false, code: 'FORBIDDEN' });
          return;
        }

        // Step 6: Current video ID pinning (reject stale video confirmations)
        const currentState = await stateManager.getOrCreateRoomState(socket.roomId, socket.roomSlug);
        if (payload.videoId !== room.currentVideoId || payload.videoId !== currentState.videoId) {
          socket.emit('ERROR', {
            code: 'STALE_VIDEO_CONFIRMATION',
            message: 'Confirmation video ID does not match active room video.',
          });
          callback?.({ success: false, code: 'STALE_VIDEO_CONFIRMATION' });
          return;
        }

        // Step 7: Stale sequence rejection
        if (
          payload.sequenceNumber !== undefined &&
          (payload.sequenceNumber as number) < currentState.sequenceNumber
        ) {
          socket.emit('ERROR', {
            code: 'STALE_SEQUENCE',
            message: 'Stale playback mode confirmation ignored.',
          });
          callback?.({ success: false, code: 'STALE_SEQUENCE' });
          return;
        }

        // Step 8: Atomic state update (preserves isEmergencyPaused & room status)
        const { state: updatedState, changed } = stateManager.confirmPlaybackMode(socket.roomId, {
          videoId: payload.videoId,
          mode: payload.mode as PlaybackMode,
          broadcastStatus: payload.broadcastStatus as BroadcastStatus,
          sequenceNumber: payload.sequenceNumber as number | undefined,
        });

        if (changed) {
          const snapshot = stateManager.getSnapshot(updatedState);
          io.to(`room:${socket.roomSlug}`).emit('SYNC_STATE', snapshot);
          io.to(`room:${socket.roomSlug}`).emit('PLAYBACK_MODE_CHANGED', {
            mode: updatedState.playbackMode,
            broadcastStatus: updatedState.broadcastStatus,
            videoId: updatedState.videoId,
          });
        }

        callback?.({ success: true, changed });
      } catch (err: any) {
        const code =
          err.message === 'STALE_VIDEO_CONFIRMATION' || err.message === 'STALE_SEQUENCE'
            ? err.message
            : 'INTERNAL_ERROR';
        socket.emit('ERROR', { code, message: err.message });
        callback?.({ success: false, code });
      }
    }
  );
}
