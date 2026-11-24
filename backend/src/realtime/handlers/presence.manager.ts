import { Server } from 'socket.io';
import { db } from '../../database';
import { AuthenticatedSocket, RoomPresence } from '../types';

export const activePresence = new Map<string, RoomPresence>();
let ioInstance: Server | null = null;

export function setIoInstance(io: Server) {
  ioInstance = io;
}

export function getIoInstance(): Server | null {
  return ioInstance;
}

export function getOrCreatePresence(roomId: string): RoomPresence {
  let presence = activePresence.get(roomId);
  if (!presence) {
    presence = {
      userSockets: new Map(),
      disconnectTimeouts: new Map(),
      guestSockets: new Set(),
    };
    activePresence.set(roomId, presence);
  }
  return presence;
}

export async function kickUserFromRoom(roomSlug: string, targetUserId: string, reason?: string): Promise<void> {
  const room = await db.findRoomBySlug(roomSlug);
  if (!room) return;

  const presence = activePresence.get(room.id);
  const roomChannel = `room:${roomSlug}`;

  if (ioInstance && presence) {
    const targetSockets = presence.userSockets.get(targetUserId);
    if (targetSockets && targetSockets.size > 0) {
      for (const socketId of targetSockets) {
        const clientSocket = ioInstance.sockets.sockets.get(socketId);
        if (clientSocket) {
          clientSocket.emit('KICKED_FROM_ROOM', {
            roomSlug,
            reason: reason || 'You have been removed from the theater room by a moderator.',
          });
          clientSocket.leave(roomChannel);
          (clientSocket as AuthenticatedSocket).roomId = undefined;
          (clientSocket as AuthenticatedSocket).roomSlug = undefined;
        }
      }
      presence.userSockets.delete(targetUserId);
      const pendingTimeout = presence.disconnectTimeouts.get(targetUserId);
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        presence.disconnectTimeouts.delete(targetUserId);
      }
    }
  }

  // Remove participant from database
  await db.removeParticipant(room.id, targetUserId);
  const updatedParticipants = await db.listParticipants(room.id);

  if (ioInstance) {
    // Notify room of departure
    ioInstance.to(roomChannel).emit('USER_LEFT', {
      userId: targetUserId,
      username: 'Participant',
      participants: updatedParticipants,
    });

    const targetUser = await db.findUserById(targetUserId);
    const username = targetUser?.username || 'A participant';
    const sysMsg = await db.createChatMessage({
      roomId: room.id,
      userId: 'system',
      username: 'System Alert',
      content: `⚠️ ${username} was removed from the theater by a moderator.`,
      isSystem: true,
    });
    ioInstance.to(roomChannel).emit('NEW_CHAT_MESSAGE', sysMsg);
  }
}

export async function broadcastHostTransfer(
  roomSlug: string,
  newHostId: string,
  newHostUsername: string,
  participants: any[]
): Promise<void> {
  const room = await db.findRoomBySlug(roomSlug);
  if (!room) return;
  const roomChannel = `room:${roomSlug}`;

  if (ioInstance) {
    ioInstance.to(roomChannel).emit('HOST_TRANSFERRED', {
      roomSlug,
      newHostId,
      newHostUsername,
      participants,
    });

    const sysMsg = await db.createChatMessage({
      roomId: room.id,
      userId: 'system',
      username: 'System Alert',
      content: `👑 ${newHostUsername} is now the host of the theater.`,
      isSystem: true,
    });
    ioInstance.to(roomChannel).emit('NEW_CHAT_MESSAGE', sysMsg);
  }
}

export async function broadcastRoomClosed(
  roomSlug: string,
  reason = 'The host has ended this watch room.'
): Promise<void> {
  const room = await db.findRoomBySlug(roomSlug);
  const roomChannel = `room:${roomSlug}`;

  if (ioInstance) {
    ioInstance.to(roomChannel).emit('ROOM_CLOSED', {
      roomSlug,
      reason,
    });

    const roomSockets = await ioInstance.in(roomChannel).fetchSockets();
    for (const s of roomSockets) {
      s.leave(roomChannel);
      (s as any).roomId = undefined;
      (s as any).roomSlug = undefined;
      (s as any).activeSessionId = undefined;
    }
  }

  if (room) {
    const presence = activePresence.get(room.id);
    if (presence) {
      for (const timeout of presence.disconnectTimeouts.values()) {
        clearTimeout(timeout);
      }
      activePresence.delete(room.id);
    }
  }
}
