import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { roomManager } from './rooms/RoomManager';
import { verifyFirebaseToken } from './firebaseAdmin';
import { logger } from './utils/logger';
import { Participant, StreamHealthReport } from './types';

// Sanitize user input to prevent XSS through chat
function sanitize(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
    .slice(0, 500); // max 500 chars
}

export const initSocket = (server: HttpServer, allowedOrigins: string[]) => {
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 15000,
    maxHttpBufferSize: 1e6, // 1MB max message
    connectionStateRecovery: {
      maxDisconnectionDuration: 30000, // 30s recovery window
      skipMiddlewares: false,
    },
  });

  // ---- Authentication Middleware ----
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (token) {
        const decoded = await verifyFirebaseToken(token);
        (socket as any).userId = decoded.uid;
        (socket as any).userName = decoded.name || 'Unknown';
        (socket as any).userPhoto = decoded.picture || '';
        (socket as any).authenticated = true;
        logger.info('Socket', `Authenticated user: ${decoded.name}`, { uid: decoded.uid });
      } else {
        // Allow anonymous connections for browsing
        (socket as any).authenticated = false;
        (socket as any).userId = `anon_${socket.id}`;
        (socket as any).userName = 'Anonymous';
        (socket as any).userPhoto = '';
      }
      next();
    } catch (err) {
      // Allow connection but mark as unauthenticated
      (socket as any).authenticated = false;
      (socket as any).userId = `anon_${socket.id}`;
      (socket as any).userName = 'Anonymous';
      (socket as any).userPhoto = '';
      logger.warn('Socket', 'Auth token invalid, allowing anonymous', { socketId: socket.id });
      next();
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    const userName = (socket as any).userName;
    const isAuthenticated = (socket as any).authenticated;
    
    logger.info('Socket', `Connected: ${socket.id}`, { userId, authenticated: isAuthenticated });

    // ---- Browse Active Rooms ----
    socket.on('get-active-rooms', () => {
      const activeRooms = roomManager.getActivePublicRooms();
      socket.emit('active-rooms', activeRooms);
    });

    // ---- Get Single Room Info ----
    socket.on('get-room-info', (data: { roomId: string }, callback) => {
      const room = roomManager.getRoom(data.roomId);
      if (!room || room.status !== 'live') {
        if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
        return;
      }
      if (typeof callback === 'function') {
        callback({ success: true, room: roomManager.getRoomState(room) });
      }
    });

    // ---- Start Stream (requires auth) ----
    socket.on('start-stream', (data: {
      title: string;
      category: string;
      isPublic: boolean;
    }, callback) => {
      if (!isAuthenticated) {
        if (typeof callback === 'function') callback({ success: false, error: 'Authentication required' });
        return;
      }

      const title = sanitize(data.title);
      if (!title || title.length < 2) {
        if (typeof callback === 'function') callback({ success: false, error: 'Title too short' });
        return;
      }

      const userPhoto = (socket as any).userPhoto;
      const room = roomManager.createRoom(
        userId,
        socket.id,
        userName,
        userPhoto,
        title,
        data.category || 'General',
        data.isPublic !== false
      );

      socket.join(room.id);
      logger.info('Socket', `Stream started: ${room.id}`, { host: userName, title });

      if (typeof callback === 'function') callback({ success: true, roomId: room.id });
      broadcastActiveRooms();
    });

    // ---- Join Room ----
    socket.on('join-room', (data: { roomId: string }, callback) => {
      const { roomId } = data;
      const room = roomManager.getRoom(roomId);

      if (!room || room.status !== 'live') {
        if (typeof callback === 'function') callback({ success: false, error: 'Room not found or ended' });
        return;
      }

      const participant: Participant = {
        socketId: socket.id,
        uid: userId,
        displayName: userName,
        photoURL: (socket as any).userPhoto || '',
        joinedAt: Date.now(),
        isMuted: true, // default muted for voice
        isVoiceActive: false,
      };

      const added = roomManager.addParticipant(roomId, participant);
      if (!added) {
        if (typeof callback === 'function') callback({ success: false, error: 'Cannot join room (full or kicked)' });
        return;
      }

      socket.join(roomId);

      // Notify host about new viewer for WebRTC
      io.to(room.hostSocketId).emit('viewer-joined', {
        viewerSocketId: socket.id,
        uid: userId,
        displayName: userName,
        photoURL: (socket as any).userPhoto,
      });

      // Broadcast updated room state
      const roomState = roomManager.getRoomState(room);
      io.to(roomId).emit('room-updated', roomState);

      logger.info('Socket', `Viewer joined: ${userName}`, { roomId });
      if (typeof callback === 'function') callback({ success: true, room: roomState });
    });

    // ---- Leave Room ----
    socket.on('leave-room', (data: { roomId: string }) => {
      const room = roomManager.getRoom(data.roomId);
      if (!room) return;
      const removed = roomManager.removeParticipant(data.roomId, socket.id);
      if (removed) {
        socket.leave(data.roomId);
        io.to(data.roomId).emit('room-updated', roomManager.getRoomState(room));
        io.to(room.hostSocketId).emit('viewer-left', { viewerSocketId: socket.id });
        io.to(data.roomId).emit('voice-peer-left', { peerSocketId: socket.id });
        logger.info('Socket', `Viewer left: ${removed.displayName}`, { roomId: data.roomId });
      }
    });

    // ---- WebRTC Signaling ----
    socket.on('webrtc-offer', (data: { offer: any; toSocketId: string }) => {
      io.to(data.toSocketId).emit('webrtc-offer', {
        offer: data.offer,
        fromSocketId: socket.id,
      });
    });

    socket.on('webrtc-answer', (data: { answer: any; toSocketId: string }) => {
      io.to(data.toSocketId).emit('webrtc-answer', {
        answer: data.answer,
        fromSocketId: socket.id,
      });
    });

    socket.on('webrtc-ice-candidate', (data: { candidate: any; toSocketId: string }) => {
      io.to(data.toSocketId).emit('webrtc-ice-candidate', {
        candidate: data.candidate,
        fromSocketId: socket.id,
      });
    });

    // ---- Voice Chat Signaling ----
    socket.on('voice-join', (data: { roomId: string }) => {
      const room = roomManager.getRoom(data.roomId);
      if (!room) return;
      
      const participant = room.participants.get(socket.id);
      if (participant) {
        participant.isVoiceActive = true;
        participant.isMuted = false;
      }

      // Notify all participants in room about voice state change
      io.to(data.roomId).emit('room-updated', roomManager.getRoomState(room));

      // Notify existing voice participants to create peer connections
      for (const [peerSocketId, peer] of room.participants) {
        if (peerSocketId !== socket.id && peer.isVoiceActive) {
          // Tell the new joiner about existing voice peers
          socket.emit('voice-peer-joined', {
            peerSocketId,
            displayName: peer.displayName,
          });
          // Tell existing peers about the new voice joiner
          io.to(peerSocketId).emit('voice-peer-joined', {
            peerSocketId: socket.id,
            displayName: userName,
          });
        }
      }

      // Also notify host if host is not in participants list
      if (room.hostSocketId !== socket.id) {
        io.to(room.hostSocketId).emit('voice-peer-joined', {
          peerSocketId: socket.id,
          displayName: userName,
        });
      }

      logger.info('Voice', `User joined voice: ${userName}`, { roomId: data.roomId });
    });

    socket.on('voice-leave', (data: { roomId: string }) => {
      const room = roomManager.getRoom(data.roomId);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (participant) {
        participant.isVoiceActive = false;
        participant.isMuted = true;
      }

      io.to(data.roomId).emit('voice-peer-left', { peerSocketId: socket.id });
      io.to(data.roomId).emit('room-updated', roomManager.getRoomState(room));
      logger.info('Voice', `User left voice: ${userName}`, { roomId: data.roomId });
    });

    socket.on('voice-offer', (data: { offer: any; toSocketId: string; roomId: string }) => {
      io.to(data.toSocketId).emit('voice-offer', {
        offer: data.offer,
        fromSocketId: socket.id,
        roomId: data.roomId,
      });
    });

    socket.on('voice-answer', (data: { answer: any; toSocketId: string; roomId: string }) => {
      io.to(data.toSocketId).emit('voice-answer', {
        answer: data.answer,
        fromSocketId: socket.id,
        roomId: data.roomId,
      });
    });

    socket.on('voice-ice-candidate', (data: { candidate: any; toSocketId: string; roomId: string }) => {
      io.to(data.toSocketId).emit('voice-ice-candidate', {
        candidate: data.candidate,
        fromSocketId: socket.id,
        roomId: data.roomId,
      });
    });

    socket.on('voice-mute-toggle', (data: { roomId: string; isMuted: boolean }) => {
      const room = roomManager.getRoom(data.roomId);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (participant) {
        participant.isMuted = data.isMuted;
      }

      io.to(data.roomId).emit('voice-mute-update', {
        socketId: socket.id,
        isMuted: data.isMuted,
      });
      io.to(data.roomId).emit('room-updated', roomManager.getRoomState(room));
    });

    // ---- Chat ----
    socket.on('send-message', (data: { roomId: string; message: string }) => {
      if (!isAuthenticated) {
        socket.emit('chat-error', { error: 'Sign in to chat' });
        return;
      }

      const room = roomManager.getRoom(data.roomId);
      if (!room) return;

      if (!roomManager.checkChatRateLimit(data.roomId, socket.id)) {
        socket.emit('chat-error', { error: 'Slow down! Too many messages.' });
        return;
      }

      const text = sanitize(data.message);
      if (!text) return;

      io.to(data.roomId).emit('chat-message', {
        id: uuidv4(),
        uid: userId,
        displayName: userName,
        photoURL: (socket as any).userPhoto || '',
        text,
        timestamp: Date.now(),
      });
    });

    // ---- Reactions ----
    socket.on('send-reaction', (data: { roomId: string; emoji: string }) => {
      if (!isAuthenticated) return;

      const room = roomManager.getRoom(data.roomId);
      if (!room) return;

      if (!roomManager.checkReactionRateLimit(data.roomId, socket.id)) return;

      const allowedEmojis = ['🔥', '😂', '👏', '❤️', '😮', '🎉', '💯', '👀'];
      if (!allowedEmojis.includes(data.emoji)) return;

      io.to(data.roomId).emit('room-reaction', {
        id: uuidv4(),
        emoji: data.emoji,
        displayName: userName,
      });
    });

    // ---- Host: End Stream ----
    socket.on('end-stream', (data: { roomId: string }, callback) => {
      const room = roomManager.getRoom(data.roomId);
      if (room && room.hostSocketId === socket.id) {
        room.status = 'ended';
        io.to(data.roomId).emit('stream-ended', { reason: 'host-ended' });
        roomManager.deleteRoom(data.roomId);
        broadcastActiveRooms();
        logger.info('Socket', `Stream ended by host`, { roomId: data.roomId });
        if (typeof callback === 'function') callback({ success: true });
      } else {
        if (typeof callback === 'function') callback({ success: false, error: 'Not authorized' });
      }
    });

    // ---- Host: Kick Participant ----
    socket.on('kick-participant', (data: { roomId: string; targetUid: string }, callback) => {
      const room = roomManager.getRoom(data.roomId);
      if (!room || room.hostSocketId !== socket.id) {
        if (typeof callback === 'function') callback({ success: false, error: 'Not authorized' });
        return;
      }

      const kickedSocketId = roomManager.kickParticipant(data.roomId, data.targetUid);
      if (kickedSocketId) {
        io.to(kickedSocketId).emit('kicked-from-room', { roomId: data.roomId });
        io.to(data.roomId).emit('room-updated', roomManager.getRoomState(room));
        logger.info('Socket', `Participant kicked`, { roomId: data.roomId, targetUid: data.targetUid });
        if (typeof callback === 'function') callback({ success: true });
      } else {
        if (typeof callback === 'function') callback({ success: false, error: 'User not found' });
      }
    });

    // ---- Stream Health ----
    socket.on('stream-health', (data: StreamHealthReport) => {
      const room = roomManager.getRoom(data.roomId);
      if (room && room.hostSocketId === socket.id) {
        io.to(data.roomId).emit('stream-health-update', {
          bitrate: data.bitrate,
          resolution: data.resolution,
          frameRate: data.frameRate,
          timestamp: Date.now(),
        });
      }
    });

    // ---- Reconnect Recovery ----
    socket.on('reconnect-to-room', (data: { roomId: string }, callback) => {
      const room = roomManager.getRoom(data.roomId);
      if (!room || room.status !== 'live') {
        if (typeof callback === 'function') callback({ success: false, error: 'Room no longer available' });
        return;
      }

      if (room.hostUid === userId) {
        // Host reconnecting
        room.hostSocketId = socket.id;
        socket.join(data.roomId);
        const roomState = roomManager.getRoomState(room);
        io.to(data.roomId).emit('room-updated', roomState);
        if (typeof callback === 'function') callback({ success: true, room: roomState, isHost: true });
        logger.info('Socket', `Host reconnected`, { roomId: data.roomId });
      } else {
        // Viewer reconnecting
        const participant: Participant = {
          socketId: socket.id,
          uid: userId,
          displayName: userName,
          photoURL: (socket as any).userPhoto || '',
          joinedAt: Date.now(),
          isMuted: true,
          isVoiceActive: false,
        };

        roomManager.addParticipant(data.roomId, participant);
        socket.join(data.roomId);

        io.to(room.hostSocketId).emit('viewer-joined', {
          viewerSocketId: socket.id,
          uid: userId,
          displayName: userName,
          photoURL: (socket as any).userPhoto,
        });

        const roomState = roomManager.getRoomState(room);
        io.to(data.roomId).emit('room-updated', roomState);
        if (typeof callback === 'function') callback({ success: true, room: roomState, isHost: false });
        logger.info('Socket', `Viewer reconnected`, { roomId: data.roomId, user: userName });
      }
    });

    // ---- Disconnect ----
    socket.on('disconnect', (reason) => {
      logger.info('Socket', `Disconnected: ${socket.id}`, { reason });

      // Cleanup host rooms
      const hostRooms = roomManager.findRoomsByHost(socket.id);
      for (const room of hostRooms) {
        room.status = 'ended';
        io.to(room.id).emit('stream-ended', { reason: 'host-disconnected' });
        roomManager.deleteRoom(room.id);
      }

      // Cleanup viewer participations
      const viewerRooms = roomManager.findRoomsWithParticipant(socket.id);
      for (const { room } of viewerRooms) {
        roomManager.removeParticipant(room.id, socket.id);
        io.to(room.id).emit('room-updated', roomManager.getRoomState(room));
        io.to(room.hostSocketId).emit('viewer-left', { viewerSocketId: socket.id });
        // Notify voice peers
        io.to(room.id).emit('voice-peer-left', { peerSocketId: socket.id });
      }

      if (hostRooms.length > 0) {
        broadcastActiveRooms();
      }
    });
  });

  function broadcastActiveRooms() {
    const activeRooms = roomManager.getActivePublicRooms();
    io.emit('active-rooms', activeRooms);
  }
};
