import { Socket } from 'socket.io';
import { AuthTokenPayload } from '../modules/auth/auth.service';

export interface AuthenticatedSocket extends Socket {
  user?: AuthTokenPayload;
  roomSlug?: string;
  roomId?: string;
  activeSessionId?: string;
}

export interface RoomPresence {
  userSockets: Map<string, Set<string>>;
  disconnectTimeouts: Map<string, NodeJS.Timeout>;
  guestSockets: Set<string>;
}
