import {
  User,
  UserProfile,
  UserPreference,
  Room,
  RoomParticipant,
  RoomInvitation,
  ChatMessage,
  RoomEvent,
  VideoSource,
  RoomSession,
  ParticipantAttendance,
  HostTransferHistory,
} from '../database/types';

export interface InMemoryDbState {
  users: User[];
  profiles: UserProfile[];
  preferences: UserPreference[];
  rooms: Room[];
  participants: RoomParticipant[];
  invitations: RoomInvitation[];
  chatMessages: ChatMessage[];
  roomEvents: RoomEvent[];
  videoSources: VideoSource[];
  sessions: RoomSession[];
  attendance: ParticipantAttendance[];
  hostTransfers: HostTransferHistory[];
}

export function createInitialInMemoryState(): InMemoryDbState {
  return {
    users: [],
    profiles: [],
    preferences: [],
    rooms: [],
    participants: [],
    invitations: [],
    chatMessages: [],
    roomEvents: [],
    videoSources: [],
    sessions: [],
    attendance: [],
    hostTransfers: [],
  };
}
