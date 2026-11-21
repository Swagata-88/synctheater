// Shared Frontend TypeScript Type Definitions for SYNCTHEATER

export type RoomPrivacy = 'PUBLIC' | 'PRIVATE';
export type RoomRole = 'OWNER' | 'MODERATOR' | 'PARTICIPANT';
export type VideoProviderType = 'YOUTUBE' | 'DIRECT' | 'HLS' | 'GOOGLE_DRIVE' | 'UNSUPPORTED';

export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string | null;
  role?: string;
}

export interface RoomParticipant {
  id: string;
  roomId: string;
  userId: string;
  role: RoomRole;
  joinedAt: string;
  user?: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
}

export interface Room {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  privacy: RoomPrivacy;
  maxCapacity: number;
  ownerId: string;
  currentVideoId: string | null;
  currentVideoUrl: string | null;
  currentProvider: VideoProviderType;
  isEmergencyPaused: boolean;
  hasPassword?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  content: string;
  isSystem: boolean;
  createdAt: string;
}

export interface PlaybackSyncState {
  videoId: string;
  videoUrl?: string;
  provider: VideoProviderType;
  isPlaying: boolean;
  currentTime: number;
  serverTime: number;
  playbackRate?: number;
  isEmergencyPaused?: boolean;
}

export interface InitialRoomStatePayload {
  room: Room;
  participants: RoomParticipant[];
  playback: PlaybackSyncState;
  isEmergencyPaused: boolean;
}
