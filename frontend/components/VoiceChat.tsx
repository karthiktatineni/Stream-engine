"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/context/SocketContext";
import { Mic, MicOff, PhoneCall, PhoneOff } from "lucide-react";

interface VoicePeer {
  socketId: string;
  displayName: string;
  connection: RTCPeerConnection;
  audioElement: HTMLAudioElement;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function VoiceChat({ roomId }: { roomId: string }) {
  const { socket } = useSocket();
  const [isInVoice, setIsInVoice] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, VoicePeer>>(new Map());

  const createPeerConnection = useCallback((peerSocketId: string, displayName: string, isInitiator: boolean) => {
    if (!socket || !localStreamRef.current) return;
    
    // Clean up existing connection to this peer
    const existing = peersRef.current.get(peerSocketId);
    if (existing) {
      existing.connection.close();
      existing.audioElement.remove();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    const audioEl = new Audio();
    audioEl.autoplay = true;

    // Add local audio track
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      pc.addTrack(audioTrack, localStreamRef.current);
    }

    // Handle remote audio
    pc.ontrack = (event) => {
      audioEl.srcObject = event.streams[0] || null;
    };

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('voice-ice-candidate', {
          candidate: event.candidate,
          toSocketId: peerSocketId,
          roomId,
        });
      }
    };

    peersRef.current.set(peerSocketId, { socketId: peerSocketId, displayName, connection: pc, audioElement: audioEl });

    // If initiator, create offer
    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('voice-offer', {
            offer: pc.localDescription,
            toSocketId: peerSocketId,
            roomId,
          });
        })
        .catch(console.error);
    }

    return pc;
  }, [socket, roomId]);

  useEffect(() => {
    if (!socket || !isInVoice) return;

    const handlePeerJoined = (data: { peerSocketId: string; displayName: string }) => {
      // We are the receiver — create connection as initiator since we got notified
      createPeerConnection(data.peerSocketId, data.displayName, true);
    };

    const handlePeerLeft = (data: { peerSocketId: string }) => {
      const peer = peersRef.current.get(data.peerSocketId);
      if (peer) {
        peer.connection.close();
        peer.audioElement.remove();
        peersRef.current.delete(data.peerSocketId);
      }
    };

    const handleVoiceOffer = async (data: { offer: RTCSessionDescriptionInit; fromSocketId: string; roomId: string }) => {
      const pc = createPeerConnection(data.fromSocketId, '', false);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('voice-answer', {
          answer: pc.localDescription,
          toSocketId: data.fromSocketId,
          roomId,
        });
      } catch (err) {
        console.error('Voice offer error:', err);
      }
    };

    const handleVoiceAnswer = async (data: { answer: RTCSessionDescriptionInit; fromSocketId: string }) => {
      const peer = peersRef.current.get(data.fromSocketId);
      if (peer && peer.connection.signalingState !== 'stable') {
        try {
          await peer.connection.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (err) {
          console.error('Voice answer error:', err);
        }
      }
    };

    const handleVoiceIceCandidate = async (data: { candidate: RTCIceCandidateInit; fromSocketId: string }) => {
      const peer = peersRef.current.get(data.fromSocketId);
      if (peer) {
        try {
          await peer.connection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('Voice ICE error:', err);
        }
      }
    };

    socket.on('voice-peer-joined', handlePeerJoined);
    socket.on('voice-peer-left', handlePeerLeft);
    socket.on('voice-offer', handleVoiceOffer);
    socket.on('voice-answer', handleVoiceAnswer);
    socket.on('voice-ice-candidate', handleVoiceIceCandidate);

    return () => {
      socket.off('voice-peer-joined', handlePeerJoined);
      socket.off('voice-peer-left', handlePeerLeft);
      socket.off('voice-offer', handleVoiceOffer);
      socket.off('voice-answer', handleVoiceAnswer);
      socket.off('voice-ice-candidate', handleVoiceIceCandidate);
    };
  }, [socket, isInVoice, createPeerConnection, roomId]);

  const joinVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });
      localStreamRef.current = stream;
      setIsInVoice(true);
      setIsMuted(false);
      setMicPermission('granted');

      socket?.emit('voice-join', { roomId });
    } catch (err) {
      console.error('Mic access denied:', err);
      setMicPermission('denied');
    }
  };

  const leaveVoice = () => {
    // Cleanup all peers
    peersRef.current.forEach(peer => {
      peer.connection.close();
      peer.audioElement.remove();
    });
    peersRef.current.clear();

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    setIsInVoice(false);
    setIsMuted(false);
    socket?.emit('voice-leave', { roomId });
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
      socket?.emit('voice-mute-toggle', { roomId, isMuted: !audioTrack.enabled });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peersRef.current.forEach(peer => {
        peer.connection.close();
        peer.audioElement.remove();
      });
      peersRef.current.clear();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  if (!isInVoice) {
    return (
      <button
        onClick={joinVoice}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-muted hover:bg-accent-primary/25 border border-accent-border text-accent-primary text-sm font-semibold transition-all"
        title={micPermission === 'denied' ? 'Microphone access denied' : 'Join voice chat'}
      >
        <PhoneCall className="w-4 h-4" />
        <span className="hidden sm:inline">Join Voice</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleMute}
        className={`p-2 rounded-lg transition-all ${
          isMuted
            ? 'bg-destructive/15 text-destructive border border-destructive/30'
            : 'bg-success/15 text-success border border-success/30'
        }`}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
      <button
        onClick={leaveVoice}
        className="p-2 rounded-lg bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 transition-all"
        title="Leave voice"
      >
        <PhoneOff className="w-4 h-4" />
      </button>
    </div>
  );
}
