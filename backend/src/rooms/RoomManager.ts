import { Room, RoomPublicInfo, RoomDetailedState, Participant } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const ROOM_IDLE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (essentially permanent for active users)
const CHAT_RATE_LIMIT_WINDOW = 5000; // 5 second window
const CHAT_RATE_LIMIT_MAX = 10; // max 10 messages per window
const REACTION_RATE_LIMIT_WINDOW = 3000;
const REACTION_RATE_LIMIT_MAX = 8;

class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodic cleanup of stale rooms
    this.cleanupInterval = setInterval(() => this.cleanupStaleRooms(), 60000);
  }

  createRoom(
    hostUid: string,
    hostSocketId: string,
    hostDisplayName: string,
    hostPhotoURL: string,
    title: string,
    category: string,
    isPublic: boolean
  ): Room {
    const roomId = uuidv4();
    const room: Room = {
      id: roomId,
      hostUid,
      hostSocketId,
      hostDisplayName,
      hostPhotoURL,
      title,
      category: category || 'General',
      isPublic,
      status: 'live',
      startedAt: Date.now(),
      participants: new Map(),
      chatRateLimit: new Map(),
      reactionRateLimit: new Map(),
      kickedUids: new Set(),
      maxParticipants: 50,
    };
    this.rooms.set(roomId, room);
    logger.info('RoomManager', `Room created: ${roomId}`, { host: hostDisplayName, title });
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
    logger.info('RoomManager', `Room deleted: ${roomId}`);
  }

  addParticipant(roomId: string, participant: Participant): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    if (room.kickedUids.has(participant.uid)) return false;
    if (room.participants.size >= room.maxParticipants) return false;
    room.participants.set(participant.socketId, participant);
    return true;
  }

  removeParticipant(roomId: string, socketId: string): Participant | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    const participant = room.participants.get(socketId);
    room.participants.delete(socketId);
    return participant;
  }

  kickParticipant(roomId: string, targetUid: string): string | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    room.kickedUids.add(targetUid);

    // Find and remove the participant by uid
    for (const [socketId, participant] of room.participants) {
      if (participant.uid === targetUid) {
        room.participants.delete(socketId);
        return socketId;
      }
    }
    return undefined;
  }

  checkChatRateLimit(roomId: string, socketId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const now = Date.now();
    const timestamps = room.chatRateLimit.get(socketId) || [];
    const recent = timestamps.filter(t => now - t < CHAT_RATE_LIMIT_WINDOW);
    
    if (recent.length >= CHAT_RATE_LIMIT_MAX) return false;
    
    recent.push(now);
    room.chatRateLimit.set(socketId, recent);
    return true;
  }

  checkReactionRateLimit(roomId: string, socketId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const now = Date.now();
    const timestamps = room.reactionRateLimit.get(socketId) || [];
    const recent = timestamps.filter(t => now - t < REACTION_RATE_LIMIT_WINDOW);
    
    if (recent.length >= REACTION_RATE_LIMIT_MAX) return false;
    
    recent.push(now);
    room.reactionRateLimit.set(socketId, recent);
    return true;
  }

  updateHostSocket(roomId: string, newSocketId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.hostSocketId = newSocketId;
    }
  }

  getActivePublicRooms(): RoomPublicInfo[] {
    const result: RoomPublicInfo[] = [];
    for (const room of this.rooms.values()) {
      if (room.status === 'live' && room.isPublic) {
        result.push({
          id: room.id,
          title: room.title,
          category: room.category,
          hostDisplayName: room.hostDisplayName,
          hostPhotoURL: room.hostPhotoURL,
          viewerCount: room.participants.size,
          startedAt: room.startedAt,
          status: room.status,
        });
      }
    }
    return result;
  }

  getRoomState(room: Room): RoomDetailedState {
    const participantsList = [];
    for (const p of room.participants.values()) {
      participantsList.push({
        uid: p.uid,
        displayName: p.displayName,
        photoURL: p.photoURL,
        isMuted: p.isMuted,
        isVoiceActive: p.isVoiceActive,
      });
    }

    return {
      id: room.id,
      title: room.title,
      category: room.category,
      isPublic: room.isPublic,
      hostUid: room.hostUid,
      hostDisplayName: room.hostDisplayName,
      hostPhotoURL: room.hostPhotoURL,
      status: room.status,
      startedAt: room.startedAt,
      viewerCount: room.participants.size,
      participantsList,
    };
  }

  findRoomsByHost(socketId: string): Room[] {
    const result: Room[] = [];
    for (const room of this.rooms.values()) {
      if (room.hostSocketId === socketId) {
        result.push(room);
      }
    }
    return result;
  }

  findRoomsWithParticipant(socketId: string): Array<{ room: Room; participant: Participant }> {
    const result: Array<{ room: Room; participant: Participant }> = [];
    for (const room of this.rooms.values()) {
      const participant = room.participants.get(socketId);
      if (participant) {
        result.push({ room, participant });
      }
    }
    return result;
  }

  private cleanupStaleRooms(): void {
    const now = Date.now();
    for (const [roomId, room] of this.rooms) {
      if (now - room.startedAt > ROOM_IDLE_TIMEOUT_MS && room.participants.size === 0) {
        this.rooms.delete(roomId);
        logger.warn('RoomManager', `Cleaned up stale room: ${roomId}`);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton
export const roomManager = new RoomManager();
