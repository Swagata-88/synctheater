import { VideoProviderType } from '../database/types';
import { db } from '../database';

export interface RoomPlaybackState {
  roomId: string;
  roomSlug: string;
  provider: VideoProviderType;
  videoId: string;
  videoUrl: string;
  status: 'PLAYING' | 'PAUSED' | 'BUFFERING';
  currentPosition: number; // in seconds
  playbackRate: number;
  lastServerTimestamp: number; // epoch ms
  sequenceNumber: number;
  isEmergencyPaused: boolean;
  emergencyPausedBy?: {
    userId: string;
    username: string;
  } | null;
}

export class RealtimeStateManager {
  private static instance: RealtimeStateManager;
  private roomStates: Map<string, RoomPlaybackState> = new Map();

  public static getInstance(): RealtimeStateManager {
    if (!RealtimeStateManager.instance) {
      RealtimeStateManager.instance = new RealtimeStateManager();
    }
    return RealtimeStateManager.instance;
  }

  public async getOrCreateRoomState(roomId: string, roomSlug: string): Promise<RoomPlaybackState> {
    let state = this.roomStates.get(roomId);
    if (!state) {
      const room = await db.findRoomById(roomId);
      state = {
        roomId,
        roomSlug,
        provider: room?.currentProvider || 'YOUTUBE',
        videoId: room?.currentVideoId || 'dQw4w9WgXcQ',
        videoUrl: room?.currentVideoUrl || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        status: 'PAUSED',
        currentPosition: 0,
        playbackRate: 1.0,
        lastServerTimestamp: Date.now(),
        sequenceNumber: 1,
        isEmergencyPaused: false,
        emergencyPausedBy: null,
      };
      this.roomStates.set(roomId, state);
    }
    return state;
  }

  /**
   * Computes the authoritative elapsed position of the video based on wall-clock time
   */
  public calculateCurrentPosition(state: RoomPlaybackState): number {
    if (state.status !== 'PLAYING') {
      return state.currentPosition;
    }
    const elapsedSeconds = (Date.now() - state.lastServerTimestamp) / 1000;
    const computedPosition = state.currentPosition + elapsedSeconds * state.playbackRate;
    return Math.max(0, computedPosition);
  }

  /**
   * Returns a snapshot of the current state with calculated position and server time
   */
  public getSnapshot(state: RoomPlaybackState): RoomPlaybackState & { calculatedPosition: number } {
    return {
      ...state,
      calculatedPosition: this.calculateCurrentPosition(state),
    };
  }

  public play(roomId: string, reportedPosition?: number): RoomPlaybackState {
    const state = this.roomStates.get(roomId);
    if (!state) throw new Error('Room state not found.');

    if (state.isEmergencyPaused) {
      throw new Error('Room is in Emergency Pause. Only the owner or moderator can resume.');
    }

    const currentPos = reportedPosition !== undefined ? reportedPosition : this.calculateCurrentPosition(state);
    state.currentPosition = currentPos;
    state.status = 'PLAYING';
    state.lastServerTimestamp = Date.now();
    state.sequenceNumber += 1;

    return state;
  }

  public pause(roomId: string, reportedPosition?: number): RoomPlaybackState {
    const state = this.roomStates.get(roomId);
    if (!state) throw new Error('Room state not found.');

    const currentPos = reportedPosition !== undefined ? reportedPosition : this.calculateCurrentPosition(state);
    state.currentPosition = currentPos;
    state.status = 'PAUSED';
    state.lastServerTimestamp = Date.now();
    state.sequenceNumber += 1;

    return state;
  }

  public seek(roomId: string, targetPosition: number): RoomPlaybackState {
    const state = this.roomStates.get(roomId);
    if (!state) throw new Error('Room state not found.');

    state.currentPosition = Math.max(0, targetPosition);
    state.lastServerTimestamp = Date.now();
    state.sequenceNumber += 1;

    return state;
  }

  public changeVideo(
    roomId: string,
    data: {
      provider: VideoProviderType;
      videoId: string;
      videoUrl: string;
    }
  ): RoomPlaybackState {
    const state = this.roomStates.get(roomId);
    if (!state) throw new Error('Room state not found.');

    state.provider = data.provider;
    state.videoId = data.videoId;
    state.videoUrl = data.videoUrl;
    state.currentPosition = 0;
    state.status = 'PAUSED';
    state.lastServerTimestamp = Date.now();
    state.sequenceNumber += 1;
    state.isEmergencyPaused = false;
    state.emergencyPausedBy = null;

    // Persist in DB
    db.updateRoom(roomId, {
      currentProvider: data.provider,
      currentVideoId: data.videoId,
      currentVideoUrl: data.videoUrl,
      isEmergencyPaused: false,
    }).catch(console.error);

    return state;
  }

  public setPlaybackRate(roomId: string, rate: number): RoomPlaybackState {
    const state = this.roomStates.get(roomId);
    if (!state) throw new Error('Room state not found.');

    state.currentPosition = this.calculateCurrentPosition(state);
    state.playbackRate = Math.max(0.25, Math.min(rate, 2.5));
    state.lastServerTimestamp = Date.now();
    state.sequenceNumber += 1;

    return state;
  }

  public emergencyPause(roomId: string, user: { userId: string; username: string }): RoomPlaybackState {
    const state = this.roomStates.get(roomId);
    if (!state) throw new Error('Room state not found.');

    state.currentPosition = this.calculateCurrentPosition(state);
    state.status = 'PAUSED';
    state.isEmergencyPaused = true;
    state.emergencyPausedBy = user;
    state.lastServerTimestamp = Date.now();
    state.sequenceNumber += 1;

    db.updateRoom(roomId, { isEmergencyPaused: true }).catch(console.error);
    return state;
  }

  public resumeFromEmergency(roomId: string): RoomPlaybackState {
    const state = this.roomStates.get(roomId);
    if (!state) throw new Error('Room state not found.');

    state.isEmergencyPaused = false;
    state.emergencyPausedBy = null;
    state.status = 'PLAYING';
    state.lastServerTimestamp = Date.now();
    state.sequenceNumber += 1;

    db.updateRoom(roomId, { isEmergencyPaused: false }).catch(console.error);
    return state;
  }
}

export const stateManager = RealtimeStateManager.getInstance();
