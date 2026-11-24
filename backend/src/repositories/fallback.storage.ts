import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { InMemoryDbState, createInitialInMemoryState } from './types';

export class FallbackStorage {
  private fallbackFilePath: string;

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (e) {}
    }
    this.fallbackFilePath = path.join(dataDir, 'synctheater.json');
  }

  public load(): InMemoryDbState {
    if (config.env === 'production') {
      return createInitialInMemoryState();
    }
    try {
      if (fs.existsSync(this.fallbackFilePath)) {
        const raw = fs.readFileSync(this.fallbackFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        const users = parsed.users || [];
        const rooms = (parsed.rooms || []).map((r: any) => ({
          ...r,
          status: r.status || 'ACTIVE',
          activeSessionId: r.activeSessionId || null,
        }));
        const participants = parsed.participants || [];
        const sessions = parsed.sessions || [];
        const attendance = parsed.attendance || [];
        const hostTransfers = parsed.hostTransfers || [];

        // Backfill active sessions for pre-existing rooms without an activeSessionId
        for (const room of rooms) {
          if (room.status === 'ACTIVE' && !room.activeSessionId) {
            const hostUser = users.find((u: any) => u.id === room.ownerId);
            const hostUsername = hostUser ? hostUser.username : 'Host';
            const sessionId = 'sess_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
            room.activeSessionId = sessionId;

            const existingSession = sessions.find((s: any) => s.id === sessionId || (s.roomId === room.id && s.status === 'ACTIVE'));
            if (!existingSession) {
              sessions.push({
                id: sessionId,
                roomId: room.id,
                roomSlug: room.slug,
                roomName: room.name,
                originalHostId: room.ownerId,
                originalHostUsername: hostUsername,
                finalHostId: room.ownerId,
                finalHostUsername: hostUsername,
                createdAt: room.createdAt || new Date(),
                startedAt: room.createdAt || new Date(),
                endedAt: null,
                totalDurationSeconds: 0,
                status: 'ACTIVE',
                closureReason: null,
              });
            }

            // Backfill attendance for existing participants of this active room
            const roomParts = participants.filter((p: any) => p.roomId === room.id);
            for (const rp of roomParts) {
              const hasOpenAtt = attendance.some((a: any) => a.sessionId === sessionId && a.userId === rp.userId && a.leftAt === null);
              if (!hasOpenAtt) {
                const partUser = users.find((u: any) => u.id === rp.userId);
                attendance.push({
                  id: 'att_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
                  sessionId,
                  userId: rp.userId,
                  displayName: partUser ? partUser.username : 'Participant',
                  joinedAt: rp.joinedAt || new Date(),
                  leftAt: null,
                  durationSeconds: 0,
                  isOriginalHost: rp.userId === room.ownerId,
                  becameHost: rp.role === 'OWNER' && rp.userId !== room.ownerId,
                });
              }
            }
          }
        }

        return {
          users,
          profiles: parsed.profiles || [],
          preferences: parsed.preferences || [],
          rooms,
          participants,
          invitations: parsed.invitations || [],
          chatMessages: parsed.chatMessages || [],
          roomEvents: parsed.roomEvents || [],
          videoSources: parsed.videoSources || [],
          sessions,
          attendance,
          hostTransfers,
        };
      }
    } catch (err) {
      console.warn('[Database] Could not read local persistence file, starting fresh', err);
    }
    return createInitialInMemoryState();
  }

  public persist(state: InMemoryDbState): void {
    if (config.env === 'production') return;
    try {
      fs.writeFileSync(this.fallbackFilePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Database] Error persisting data to local file', err);
    }
  }
}
