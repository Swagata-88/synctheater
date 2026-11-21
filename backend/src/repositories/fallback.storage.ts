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
        return {
          users: parsed.users || [],
          profiles: parsed.profiles || [],
          preferences: parsed.preferences || [],
          rooms: parsed.rooms || [],
          participants: parsed.participants || [],
          invitations: parsed.invitations || [],
          chatMessages: parsed.chatMessages || [],
          roomEvents: parsed.roomEvents || [],
          videoSources: parsed.videoSources || [],
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
