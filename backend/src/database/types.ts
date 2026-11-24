export type Role = 'USER' | 'ADMIN';
export type RoomRole = 'OWNER' | 'MODERATOR' | 'PARTICIPANT';
export type RoomPrivacy = 'PUBLIC' | 'PRIVATE';
export type VideoProviderType = 'YOUTUBE' | 'DIRECT' | 'HLS' | 'GOOGLE_DRIVE' | 'UNSUPPORTED';
export type RoomStatus = 'ACTIVE' | 'CLOSING' | 'CLOSED';
export type SessionStatus = 'ACTIVE' | 'CLOSING' | 'CLOSED';
export type ClosureReason =
  | 'HOST_ENDED'
  | 'HOST_CLOSED'
  | 'ABANDONED_TIMEOUT'
  | 'HOST_DEPARTED'
  | 'MANUAL_CLOSE'
  | 'INACTIVITY_TIMEOUT'
  | 'ALL_PARTICIPANTS_LEFT'
  | 'ADMIN_TERMINATED';
export type TransferType = 'VOLUNTARY' | 'HOST_DISCONNECT_RECOVERY' | 'MANUAL' | 'AUTOMATIC';

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  emailVerified: boolean;
  verificationToken: string | null;
  resetToken: string | null;
  resetTokenExpiry: Date | null;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreference {
  id: string;
  userId: string;
  theme: 'dark' | 'light';
  accentColor: string;
  theaterSetting: 'classic' | 'cozy' | 'gaming' | 'minimal';
  audioVolume: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Room {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  privacy: RoomPrivacy;
  passwordHash: string | null;
  maxCapacity: number;
  ownerId: string;
  currentVideoId: string | null;
  currentVideoUrl: string | null;
  currentProvider: VideoProviderType;
  isEmergencyPaused: boolean;
  status: RoomStatus;
  activeSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomSession {
  id: string;
  roomId: string;
  roomSlug: string;
  roomName: string;
  originalHostId: string | null;
  originalHostUsername: string;
  finalHostId: string | null;
  finalHostUsername: string;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  totalDurationSeconds: number;
  status: SessionStatus;
  closureReason: ClosureReason | null;
}

export interface ParticipantAttendance {
  id: string;
  sessionId: string;
  userId: string | null;
  displayName: string;
  joinedAt: Date;
  leftAt: Date | null;
  durationSeconds: number;
  isOriginalHost: boolean;
  becameHost: boolean;
}

export interface HostTransferHistory {
  id: string;
  sessionId: string;
  previousHostId: string | null;
  previousHostUsername: string;
  newHostId: string | null;
  newHostUsername: string;
  transferredAt: Date;
  reason: string;
  transferType: TransferType;
}

export interface RoomParticipant {
  id: string;
  roomId: string;
  userId: string;
  role: RoomRole;
  joinedAt: Date;
  // Joined fields for display
  user?: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
}

export interface RoomInvitation {
  id: string;
  roomId: string;
  token: string;
  createdBy: string;
  expiresAt: Date | null;
  maxUses?: number | null;
  usesCount: number;
  isRevoked: boolean;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  content: string;
  isSystem: boolean;
  createdAt: Date;
}

export interface RoomEvent {
  id: string;
  roomId: string;
  userId: string | null;
  eventType: string;
  payload: any;
  createdAt: Date;
}

export interface VideoSource {
  id: string;
  roomId: string;
  provider: VideoProviderType;
  externalId: string;
  url: string;
  title: string | null;
  duration: number | null;
  addedAt: Date;
}
