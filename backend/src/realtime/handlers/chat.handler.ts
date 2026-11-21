import { Server } from 'socket.io';
import { db } from '../../database';
import { AuthenticatedSocket } from '../types';

export function registerChatHandlers(io: Server, socket: AuthenticatedSocket) {
  // 1. SEND_CHAT_MESSAGE
  socket.on('SEND_CHAT_MESSAGE', async (data: { content: string }) => {
    try {
      if (!socket.roomId || !socket.roomSlug) return;
      const content = (data?.content || '').trim();
      if (!content || content.length > 500) {
        return socket.emit('ERROR', { message: 'Message must be between 1 and 500 characters.' });
      }

      const profile = socket.user ? await db.findProfileByUserId(socket.user.userId) : null;

      const message = await db.createChatMessage({
        roomId: socket.roomId,
        userId: socket.user?.userId || 'guest-' + socket.id,
        username: socket.user?.username || 'Guest',
        avatarUrl: profile?.avatarUrl || null,
        content,
        isSystem: false,
      });

      io.to(`room:${socket.roomSlug}`).emit('NEW_CHAT_MESSAGE', message);
    } catch (err: any) {
      socket.emit('ERROR', { message: err.message });
    }
  });

  // 2. SEND_REACTION
  socket.on('SEND_REACTION', (data: { emoji: string }) => {
    if (!socket.roomSlug) return;
    io.to(`room:${socket.roomSlug}`).emit('NEW_REACTION', {
      id: Math.random().toString(36).substring(2),
      emoji: data.emoji || '❤️',
      username: socket.user?.username || 'Guest',
      userId: socket.user?.userId || socket.id,
      timestamp: Date.now(),
    });
  });
}
