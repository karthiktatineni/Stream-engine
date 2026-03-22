"use client";

import { useEffect, useRef, useState, use } from "react";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import LiveChat from "@/components/LiveChat";
import VoiceChat from "@/components/VoiceChat";
import ParticipantList from "@/components/ParticipantList";
import {
  Play, Users, Clock, AlertTriangle, Radio, Eye,
  MessageCircle, ChevronLeft, ChevronRight, Share2,
  WifiOff, RefreshCw, Maximize, Volume2
} from "lucide-react";

interface ParticipantInfo {
  uid: string;
  displayName: string;
  photoURL: string;
  isMuted: boolean;
  isVoiceActive: boolean;
}

interface RoomState {
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
  participantsList: ParticipantInfo[];
}

export default function WatchRoom({ params }: { params: Promise<{ roomId: string }> }) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.roomId;

  const { socket, isConnected, connectionState } = useSocket();
  const { user } = useAuth();
  const router = useRouter();

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [streamEnded, setStreamEnded] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [sidePanel, setSidePanel] = useState<'chat' | 'participants'>('chat');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [volume, setVolume] = useState(0.8);

  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  useEffect(() => {
    if (!socket || !isConnected) return;

    const uid = user?.uid || "anonymous";
    const displayName = user?.displayName || "Anonymous";

    socket.emit("join-room", { roomId }, (response: any) => {
      if (response.success) {
        setIsJoined(true);
        setRoomState(response.room);
      } else {
        toast.error(response.error || "Could not join stream");
        router.push("/");
      }
    });

    const onRoomUpdated = (state: RoomState) => {
      setRoomState(state);
    };

    const onStreamEnded = () => {
      setStreamEnded(true);
    };

    const onKicked = () => {
      setKicked(true);
      toast.error("You have been removed from this room");
    };

    // WebRTC: receive offer from host
    const onOffer = async (data: { offer: RTCSessionDescriptionInit; fromSocketId: string }) => {
      // Cleanup existing peer
      if (peerRef.current) {
        peerRef.current.close();
      }

      const pc = new RTCPeerConnection(iceServers);
      peerRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc-ice-candidate", {
            candidate: event.candidate,
            toSocketId: data.fromSocketId,
          });
        }
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0];
        setRemoteStream(stream || null);
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        }
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc-answer", {
          answer: pc.localDescription,
          toSocketId: data.fromSocketId,
        });
      } catch (e) {
        console.error("Error handling WebRTC offer:", e);
      }
    };

    const onIceCandidate = async (data: { candidate: RTCIceCandidateInit; fromSocketId: string }) => {
      if (peerRef.current) {
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error("Error adding ICE candidate:", e);
        }
      }
    };

    socket.on("room-updated", onRoomUpdated);
    socket.on("stream-ended", onStreamEnded);
    socket.on("kicked-from-room", onKicked);
    socket.on("webrtc-offer", onOffer);
    socket.on("webrtc-ice-candidate", onIceCandidate);

    return () => {
      socket.off("room-updated", onRoomUpdated);
      socket.off("stream-ended", onStreamEnded);
      socket.off("kicked-from-room", onKicked);
      socket.off("webrtc-offer", onOffer);
      socket.off("webrtc-ice-candidate", onIceCandidate);
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
      socket.emit("leave-room", { roomId });
    };
  }, [socket, isConnected, roomId, user, router]);

  const handleManualPlay = () => {
    if (videoRef.current) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const shareRoom = () => {
    const url = `${window.location.origin}/watch/${roomId}`;
    navigator.clipboard.writeText(url);
    toast.success("Room link copied!");
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen().catch(console.error);
      }
    }
  };

  // Loading state
  if (!isJoined && !streamEnded && !kicked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary">
        <div className="w-10 h-10 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm font-semibold text-text-secondary">Joining room...</span>
      </div>
    );
  }

  // Kicked state
  if (kicked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
        <div className="bg-bg-secondary border border-border-subtle rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Removed from Room</h2>
          <p className="text-sm text-text-muted mb-6">The host has removed you from this stream.</p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 bg-accent-primary hover:bg-accent-hover text-white font-semibold rounded-xl transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Stream ended state
  if (streamEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
        <div className="bg-bg-secondary border border-border-subtle rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto mb-4">
            <Radio className="w-8 h-8 text-warning" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Stream Ended</h2>
          <p className="text-sm text-text-muted mb-6">
            The host ended this broadcast. Check out other live streams.
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 bg-accent-primary hover:bg-accent-hover text-white font-semibold rounded-xl transition-all"
          >
            Discover Streams
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-bg-primary text-text-primary">
      {/* Video & Info */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-12 border-b border-border-subtle flex items-center justify-between px-4 bg-bg-secondary/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 bg-live-red rounded-md text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />
              Live
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Eye className="w-3.5 h-3.5" />
              <span className="font-semibold">{roomState?.viewerCount || 0}</span>
            </div>
            {connectionState === 'reconnecting' && (
              <div className="flex items-center gap-1 text-warning text-xs font-semibold">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Reconnecting...
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={shareRoom}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
            >
              <Share2 size={16} />
              Share Stream
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all ml-1"
              title="Fullscreen"
            >
              <Maximize size={20} />
            </button>
            <button
              onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
              className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted transition-colors lg:hidden"
            >
              {isSidePanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Player */}
        <div className="flex-1 flex items-center justify-center p-4 bg-black relative">
          {!remoteStream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-bg-primary">
              <Radio className="w-12 h-12 text-text-muted/20 mb-4" />
              <p className="text-sm font-semibold text-text-muted animate-pulse">Waiting for host video...</p>
            </div>
          )}

          <video
            ref={videoRef}
            playsInline
            autoPlay
            className="w-full h-full object-contain"
          />

          {/* Viewer Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 z-30">
            <VoiceChat roomId={roomId} autoJoin={true} />
            
            <div className="w-px h-6 bg-white/10 mx-1" />
            
            <div className="flex items-center gap-2 group w-32">
              <Volume2 className="w-5 h-5 text-white/70" />
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (videoRef.current) videoRef.current.volume = val;
                }}
                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-accent-primary"
              />
            </div>

            <button
              onClick={toggleFullscreen}
              className="p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all font-bold"
              title="Fullscreen"
            >
              <Maximize size={24} />
            </button>
          </div>

          {/* Play overlay for autoplay-blocked browsers */}
          {remoteStream && !isPlaying && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
              <button
                onClick={handleManualPlay}
                className="w-20 h-20 rounded-full bg-accent-primary hover:bg-accent-hover flex items-center justify-center transition-all hover:scale-110 shadow-2xl shadow-accent-primary/30"
              >
                <Play className="w-8 h-8 ml-1" />
              </button>
            </div>
          )}
        </div>

        {/* Stream Info */}
        <div className="border-t border-border-subtle bg-bg-secondary/50 px-4 py-3 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-semibold text-accent-primary uppercase tracking-wider">
                  {roomState?.category || "General"}
                </span>
              </div>
              <h1 className="text-lg font-bold text-text-primary truncate">
                {roomState?.title || "Live Stream"}
              </h1>
              <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                <div className="w-5 h-5 rounded-full bg-bg-elevated flex items-center justify-center text-[9px] font-bold overflow-hidden">
                  {roomState?.hostPhotoURL ? (
                    <img src={roomState.hostPhotoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (roomState?.hostDisplayName || 'H')[0].toUpperCase()
                  )}
                </div>
                <span className="font-medium text-text-secondary">{roomState?.hostDisplayName || "Host"}</span>
                <span className="text-text-muted/40">·</span>
                <Clock className="w-3 h-3" />
                <span>Started {new Date(roomState?.startedAt || Date.now()).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side Panel */}
      <div
        className={`${
          isSidePanelOpen ? "w-80" : "w-0"
        } transition-all duration-200 border-l border-border-subtle flex flex-col bg-bg-secondary overflow-hidden shrink-0`}
      >
        {/* Tabs */}
        <div className="flex border-b border-border-subtle shrink-0">
          <button
            onClick={() => setSidePanel("chat")}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              sidePanel === "chat"
                ? "text-accent-primary border-b-2 border-accent-primary"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Chat
          </button>
          <button
            onClick={() => setSidePanel("participants")}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              sidePanel === "participants"
                ? "text-accent-primary border-b-2 border-accent-primary"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            People
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-elevated">
              {roomState?.viewerCount || 0}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {sidePanel === "chat" ? (
            <LiveChat roomId={roomId} />
          ) : (
            <ParticipantList
              participants={roomState?.participantsList || []}
              hostUid={roomState?.hostUid || ""}
              hostDisplayName={roomState?.hostDisplayName || "Host"}
              hostPhotoURL={roomState?.hostPhotoURL || ""}
              isHost={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
