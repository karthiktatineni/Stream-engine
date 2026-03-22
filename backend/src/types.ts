export interface Participant {
  socketId: string;
  uid: string;
  displayName: string;
  photoURL: string;
  joinedAt: number;
  isMuted: boolean;
  isVoiceActive: boolean;
}

export interface Room {
  id: string;
  hostUid: string;
  hostSocketId: string;
  hostDisplayName: string;
  hostPhotoURL: string;
  title: string;
  category: string;
  isPublic: boolean;
  status: 'live' | 'ended';
  startedAt: number;
  participants: Map<string, Participant>;
  chatRateLimit: Map<string, number[]>;
  reactionRateLimit: Map<string, number[]>;
  kickedUids: Set<string>;
  maxParticipants: number;
}

export interface RoomPublicInfo {
  id: string;
  title: string;
  category: string;
  hostDisplayName: string;
  hostPhotoURL: string;
  viewerCount: number;
  startedAt: number;
  status: string;
}

export interface RoomDetailedState {
  id: string;
  title: string;
  category: string;
  isPublic: boolean;
  hostUid: string;
  hostDisplayName: string;
  hostPhotoURL: string;
  status: string;
  startedAt: number;
  viewerCount: number;
  participantsList: Array<{
    uid: string;
    displayName: string;
    photoURL: string;
    isMuted: boolean;
    isVoiceActive: boolean;
  }>;
}

export interface ChatMessage {
  id: string;
  uid: string;
  displayName: string;
  photoURL: string;
  text: string;
  timestamp: number;
}

export interface ReactionEvent {
  id: string;
  emoji: string;
  displayName: string;
}

export interface StreamHealthReport {
  roomId: string;
  bitrate: number;
  resolution: string;
  frameRate: number;
  packetsLost: number;
  jitter: number;
  timestamp: number;
}
