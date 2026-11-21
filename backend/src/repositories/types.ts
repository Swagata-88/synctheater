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
  };
}
