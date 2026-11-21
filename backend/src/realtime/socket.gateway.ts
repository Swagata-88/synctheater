import { Server } from 'socket.io';
import { authService } from '../modules/auth/auth.service';
import { AuthenticatedSocket } from './types';
import { setIoInstance, kickUserFromRoom } from './handlers/presence.manager';
import { registerRoomHandlers } from './handlers/room.handler';
import { registerPlaybackHandlers } from './handlers/playback.handler';
import { registerEmergencyHandlers } from './handlers/emergency.handler';
import { registerChatHandlers } from './handlers/chat.handler';

export { kickUserFromRoom };

export function registerSocketGateway(io: Server) {
  setIoInstance(io);

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (token) {
        try {
          const user = await authService.verifyToken(token);
          socket.user = user;
        } catch (e) {
          // Token invalid, allow as guest for public rooms
        }
      }
      next();
    } catch (err) {
      next();
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[Socket] Client connected: ${socket.id} (User: ${socket.user?.username || 'Guest'})`);

    registerRoomHandlers(io, socket);
    registerPlaybackHandlers(io, socket);
    registerEmergencyHandlers(io, socket);
    registerChatHandlers(io, socket);
  });
}
