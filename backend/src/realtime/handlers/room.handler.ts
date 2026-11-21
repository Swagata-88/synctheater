import { Server } from 'socket.io';
import { db } from '../../database';
import { stateManager } from '../state.manager';
import { AuthenticatedSocket } from '../types';
import { activePresence, getOrCreatePresence, kickUserFromRoom } from './presence.manager';
import { checkControlPermission } from './playback.handler';

export function registerRoomHandlers(io: Server, socket: AuthenticatedSocket) {
  // Helper for joining or reconnecting to a room
  const handleJoinOrReconnect = async (roomSlug: string, inviteToken?: string) => {
    // 1. Enforce authentication: All rooms are private
    if (!socket.user) {
      return socket.emit('ERROR', {
        message: 'Authentication required. Please sign in to access private watch rooms.',
        code: 'UNAUTHENTICATED',
      });
    }

    const room = await db.findRoomBySlug(roomSlug);
    if (!room) {
      return socket.emit('ERROR', { message: 'Watch room not found.', code: 'NOT_FOUND' });
    }

    const userId = socket.user.userId;
    const isOwner = room.ownerId === userId;
    const existingParticipant = await db.findParticipant(room.id, userId);

    // 2. Enforce private room membership or invitation authorization
    if (!isOwner && !existingParticipant) {
      if (!inviteToken) {
        return socket.emit('ERROR', {
          message: 'Access denied: This room is private. A valid invitation link is required.',
          code: 'INVITE_REQUIRED',
        });
      }

      const validation = await db.findInvitationByToken(inviteToken);
      if (!validation || validation.roomId !== room.id) {
        return socket.emit('ERROR', {
          message: 'Access denied: Invalid invitation token.',
          code: 'INVALID_INVITE',
        });
      }

      if (validation.isRevoked) {
        return socket.emit('ERROR', {
          message: 'Access denied: This invitation has been revoked.',
          code: 'INVITE_REVOKED',
        });
      }

      if (validation.expiresAt && new Date(validation.expiresAt).getTime() < Date.now()) {
        return socket.emit('ERROR', {
          message: 'Access denied: This invitation has expired.',
          code: 'INVITE_EXPIRED',
        });
      }

      if (validation.maxUses && validation.usesCount >= validation.maxUses) {
        return socket.emit('ERROR', {
          message: 'Access denied: This invitation has reached its maximum uses.',
          code: 'INVITE_MAX_USES',
        });
      }

      // Check room capacity
      const currentParticipants = await db.listParticipants(room.id);
      if (currentParticipants.length >= room.maxCapacity) {
        return socket.emit('ERROR', {
          message: 'Room has reached its maximum participant capacity.',
          code: 'CAPACITY_REACHED',
        });
      }

      // Atomically claim invitation use and add as authorized participant
      const claimed = await db.incrementInvitationUse(inviteToken);
      if (!claimed) {
        return socket.emit('ERROR', {
          message: 'Access denied: This invitation has reached its maximum uses or has expired.',
          code: 'INVITE_MAX_USES',
        });
      }
      await db.addParticipant(room.id, userId, 'PARTICIPANT');
    }

    socket.roomSlug = roomSlug;
    socket.roomId = room.id;
    const roomChannel = `room:${roomSlug}`;

    await socket.join(roomChannel);

    const presence = getOrCreatePresence(room.id);
    let isReconnection = false;

    const pendingTimeout = presence.disconnectTimeouts.get(userId);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      presence.disconnectTimeouts.delete(userId);
      isReconnection = true;
    } else if (presence.userSockets.has(userId) && presence.userSockets.get(userId)!.size > 0) {
      isReconnection = true;
    }

    let userSet = presence.userSockets.get(userId);
    if (!userSet) {
      userSet = new Set();
      presence.userSockets.set(userId, userSet);
    }
    userSet.add(socket.id);

    // Ensure participant record exists
    await db.addParticipant(room.id, userId, isOwner ? 'OWNER' : 'PARTICIPANT');

    // Authoritative state snapshot
    const state = await stateManager.getOrCreateRoomState(room.id, roomSlug);
    const snapshot = stateManager.getSnapshot(state);

    const participants = await db.listParticipants(room.id);
    const messages = await db.listChatMessages(room.id, 50);

    // Emit complete state to the socket
    socket.emit('INITIAL_ROOM_STATE', {
      room,
      playbackState: snapshot,
      participants,
      messages,
      isReconnection,
    });

    // Synchronize player position immediately
    socket.emit('SYNC_STATE', snapshot);

    // Broadcast USER_JOINED only on fresh arrival, preventing duplicate join spam
    if (!isReconnection) {
      const sysMsg = await db.createChatMessage({
        roomId: room.id,
        userId: socket.user.userId,
        username: socket.user.username,
        content: `${socket.user.username} joined the theater.`,
        isSystem: true,
      });

      io.to(roomChannel).emit('USER_JOINED', {
        user: socket.user,
        participants,
        systemMessage: sysMsg,
      });
    }
  };

  // 1. JOIN_ROOM
  socket.on('JOIN_ROOM', async (data: { roomSlug: string; inviteToken?: string }) => {
    try {
      await handleJoinOrReconnect(data.roomSlug, data.inviteToken);
    } catch (err: any) {
      socket.emit('ERROR', { message: err.message || 'Failed to join room.' });
    }
  });

  // 2. RECONNECT_ROOM
  socket.on('RECONNECT_ROOM', async (data: { roomSlug: string; inviteToken?: string }) => {
    try {
      await handleJoinOrReconnect(data.roomSlug, data.inviteToken);
    } catch (err: any) {
      socket.emit('ERROR', { message: err.message || 'Failed to reconnect to room.' });
    }
  });

  // 3. LEAVE_ROOM
  socket.on('LEAVE_ROOM', async () => {
    const roomId = socket.roomId;
    const roomSlug = socket.roomSlug;
    if (!roomId || !roomSlug) return;

    await socket.leave(`room:${roomSlug}`);
    const presence = activePresence.get(roomId);

    if (socket.user && presence) {
      const userId = socket.user.userId;
      const userSet = presence.userSockets.get(userId);
      if (userSet) {
        userSet.delete(socket.id);
        if (userSet.size === 0) {
          presence.userSockets.delete(userId);
          const pendingTimeout = presence.disconnectTimeouts.get(userId);
          if (pendingTimeout) {
            clearTimeout(pendingTimeout);
            presence.disconnectTimeouts.delete(userId);
          }

          await db.removeParticipant(roomId, userId);
          const updatedParticipants = await db.listParticipants(roomId);

          io.to(`room:${roomSlug}`).emit('USER_LEFT', {
            userId,
            username: socket.user.username,
            participants: updatedParticipants,
          });

          const sysMsg = await db.createChatMessage({
            roomId,
            userId,
            username: socket.user.username,
            content: `${socket.user.username} left the theater.`,
            isSystem: true,
          });
          io.to(`room:${roomSlug}`).emit('NEW_CHAT_MESSAGE', sysMsg);

          if (presence.userSockets.size === 0 && presence.guestSockets.size === 0) {
            activePresence.delete(roomId);
          }
        }
      }
    }
    socket.roomId = undefined;
    socket.roomSlug = undefined;
  });

  // 4. KICK_USER
  socket.on('KICK_USER', async (data: { targetUserId: string; reason?: string }) => {
    try {
      if (!socket.roomId || !socket.roomSlug) return;
      const hasPermission = await checkControlPermission(socket.roomId, socket.user?.userId);
      if (!hasPermission) {
        return socket.emit('ERROR', { message: 'Only the room host or moderators can kick participants.' });
      }
      await kickUserFromRoom(socket.roomSlug, data.targetUserId, data.reason);
    } catch (err: any) {
      socket.emit('ERROR', { message: err.message });
    }
  });

  // 5. disconnect
  socket.on('disconnect', async () => {
    console.log(`[Socket] Disconnected: ${socket.id} (User: ${socket.user?.username || 'Guest'})`);
    const roomId = socket.roomId;
    const roomSlug = socket.roomSlug;
    if (!roomId || !roomSlug) return;

    const presence = activePresence.get(roomId);
    if (!presence) return;

    if (socket.user) {
      const userId = socket.user.userId;
      const userSet = presence.userSockets.get(userId);
      if (userSet) {
        userSet.delete(socket.id);

        if (userSet.size === 0) {
          // 3-second grace window to handle quick network reconnect or tab refresh
          const timeout = setTimeout(async () => {
            presence.userSockets.delete(userId);
            presence.disconnectTimeouts.delete(userId);

            await db.removeParticipant(roomId, userId);
            const updatedParticipants = await db.listParticipants(roomId);

            io.to(`room:${roomSlug}`).emit('USER_LEFT', {
              userId,
              username: socket.user?.username || 'Participant',
              participants: updatedParticipants,
            });

            const sysMsg = await db.createChatMessage({
              roomId,
              userId,
              username: socket.user?.username || 'Participant',
              content: `${socket.user?.username || 'A participant'} left the theater.`,
              isSystem: true,
            });
            io.to(`room:${roomSlug}`).emit('NEW_CHAT_MESSAGE', sysMsg);

            if (presence.userSockets.size === 0 && presence.guestSockets.size === 0) {
              activePresence.delete(roomId);
            }
          }, 3000);

          presence.disconnectTimeouts.set(userId, timeout);
        }
      }
    } else {
      presence.guestSockets.delete(socket.id);
      if (presence.userSockets.size === 0 && presence.guestSockets.size === 0) {
        activePresence.delete(roomId);
      }
    }
  });
}
