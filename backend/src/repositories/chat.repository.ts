import { Pool } from 'pg';
import { ChatMessage, RoomEvent, VideoSource, VideoProviderType } from '../database/types';
import { InMemoryDbState } from './types';
import { FallbackStorage } from './fallback.storage';

export class ChatRepository {
  constructor(
    private getPool: () => Pool | null,
    private isConnected: () => boolean,
    private inMemoryDb: InMemoryDbState,
    private storage: FallbackStorage
  ) {}

  public async saveChatMessage(data: {
    roomId: string;
    userId: string;
    username: string;
    avatarUrl?: string | null;
    content: string;
    isSystem?: boolean;
  }): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      roomId: data.roomId,
      userId: data.userId,
      username: data.username,
      avatarUrl: data.avatarUrl || null,
      content: data.content,
      isSystem: data.isSystem || false,
      createdAt: new Date(),
    };

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `INSERT INTO chat_messages (id, room_id, user_id, username, avatar_url, content, is_system, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          message.id,
          message.roomId,
          message.userId,
          message.username,
          message.avatarUrl,
          message.content,
          message.isSystem,
          message.createdAt,
        ]
      );
    } else {
      this.inMemoryDb.chatMessages.push(message);
      this.storage.persist(this.inMemoryDb);
    }

    return message;
  }

  public async listMessagesForRoom(roomId: string, limit = 100): Promise<ChatMessage[]> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(
        `SELECT * FROM chat_messages WHERE room_id = $1 ORDER BY created_at ASC LIMIT $2`,
        [roomId, limit]
      );
      return res.rows.map((r) => ({
        id: r.id,
        roomId: r.room_id,
        userId: r.user_id,
        username: r.username,
        avatarUrl: r.avatar_url,
        content: r.content,
        isSystem: r.is_system,
        createdAt: r.created_at,
      }));
    }

    return this.inMemoryDb.chatMessages
      .filter((m) => m.roomId === roomId)
      .slice(-limit);
  }

  public createChatMessage(data: {
    roomId: string;
    userId: string;
    username: string;
    avatarUrl?: string | null;
    content: string;
    isSystem?: boolean;
  }): Promise<ChatMessage> {
    return this.saveChatMessage(data);
  }

  public listChatMessages(roomId: string, limit = 100): Promise<ChatMessage[]> {
    return this.listMessagesForRoom(roomId, limit);
  }

  public async logRoomEvent(data: {
    roomId: string;
    userId?: string | null;
    eventType: string;
    payload?: any;
  }): Promise<RoomEvent> {
    const event: RoomEvent = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      roomId: data.roomId,
      userId: data.userId || null,
      eventType: data.eventType,
      payload: data.payload || {},
      createdAt: new Date(),
    };

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `INSERT INTO room_events (id, room_id, user_id, event_type, payload, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [event.id, event.roomId, event.userId, event.eventType, JSON.stringify(event.payload), event.createdAt]
      );
    } else {
      this.inMemoryDb.roomEvents.push(event);
      this.storage.persist(this.inMemoryDb);
    }

    return event;
  }

  public async addVideoSource(data: {
    roomId: string;
    provider: VideoProviderType;
    externalId: string;
    url: string;
    title?: string | null;
    duration?: number | null;
  }): Promise<VideoSource> {
    const source: VideoSource = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      roomId: data.roomId,
      provider: data.provider,
      externalId: data.externalId,
      url: data.url,
      title: data.title || null,
      duration: data.duration || null,
      addedAt: new Date(),
    };

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `INSERT INTO video_sources (id, room_id, provider, external_id, url, title, duration, added_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [source.id, source.roomId, source.provider, source.externalId, source.url, source.title, source.duration, source.addedAt]
      );
    } else {
      this.inMemoryDb.videoSources.push(source);
      this.storage.persist(this.inMemoryDb);
    }

    return source;
  }

  public async getVideoSourcesForRoom(roomId: string): Promise<VideoSource[]> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(
        `SELECT * FROM video_sources WHERE room_id = $1 ORDER BY added_at DESC`,
        [roomId]
      );
      return res.rows.map((r) => ({
        id: r.id,
        roomId: r.room_id,
        provider: r.provider,
        externalId: r.external_id,
        url: r.url,
        title: r.title,
        duration: r.duration,
        addedAt: r.added_at,
      }));
    }

    return this.inMemoryDb.videoSources.filter((s) => s.roomId === roomId);
  }
}
