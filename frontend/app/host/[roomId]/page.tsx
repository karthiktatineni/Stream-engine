"use client";

import { useEffect, useRef, useState, use, useCallback } from "react";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import LiveChat from "@/components/LiveChat";
import VoiceChat from "@/components/VoiceChat";
import ParticipantList from "@/components/ParticipantList";
import {
  MicOff, Mic, StopCircle, Eye, Users, Copy, 
  MessageCircle, ChevronLeft, ChevronRight, Monitor
} from "lucide-react";

interface ParticipantInfo {
  uid: string;
  displayName: string;
  photoURL: string;
  isMuted: boolean;
  isVoiceActive: boolean;
}

export default function HostRoom({ params }: { params: Promise<{ roomId: string }> }) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.roomId;

  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const router = useRouter();

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [participantsCount, setParticipantsCount] = useState(0);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [sidePanel, setSidePanel] = useState<'chat' | 'participants'>('chat');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  const createPeerForViewer = useCallback((viewerSocketId: string) => {
    if (!socket || !localStreamRef.current) return;

    const existing = peersRef.current.get(viewerSocketId);
    if (existing) {
      existing.close();
    }

    const pc = new RTCPeerConnection(iceServers);
    peersRef.current.set(viewerSocketId, pc);

    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc-ice-candidate", {
          candidate: event.candidate,
          toSocketId: viewerSocketId,
        });
      }
    };

    pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false })
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        socket.emit("webrtc-offer", {
          offer: pc.localDescription,
          toSocketId: viewerSocketId,
        });
      })
      .catch((e) => console.error("Error creating offer:", e));
  }, [socket]);

  useEffect(() => {
    if (!user || !socket || !isConnected) return;

    let mounted = true;

    const initStream = async () => {
      // If we already have a stream, don't try to pick up from window again
      if (localStreamRef.current && localStreamRef.current.active) return;

      const previewStream = (window as any).__streamEnginePreviewStream as MediaStream | undefined;

      let mediaStream: MediaStream;

      if (previewStream && previewStream.active) {
        mediaStream = previewStream;
        // Only clear from global after it's confirmed found
        delete (window as any).__streamEnginePreviewStream;
        delete (window as any).__streamEngineScreenShare;
      } else {
        toast.error("No active stream found. Returning to setup.");
        router.push("/go-live");
        return;
      }

      if (!mounted) {
        mediaStream.getTracks().forEach(t => t.stop());
        return;
      }

      localStreamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    };

    initStream();

    const onViewerJoined = (data: { viewerSocketId: string; displayName: string }) => {
      createPeerForViewer(data.viewerSocketId);
    };

    const onAnswer = async (data: { answer: RTCSessionDescriptionInit; fromSocketId: string }) => {
      const pc = peersRef.current.get(data.fromSocketId);
      if (pc && pc.signalingState !== "stable") {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (e) {
          console.error("Error setting remote description:", e);
        }
      }
    };

    const onIceCandidate = async (data: { candidate: RTCIceCandidateInit; fromSocketId: string }) => {
      const pc = peersRef.current.get(data.fromSocketId);
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error("Error adding ice candidate:", e);
        }
      }
    };

    const onRoomUpdated = (state: any) => {
      setParticipantsCount(state.viewerCount);
      setParticipants(state.participantsList || []);
    };

    const onViewerLeft = (data: { viewerSocketId: string }) => {
      const pc = peersRef.current.get(data.viewerSocketId);
      if (pc) {
        pc.close();
        peersRef.current.delete(data.viewerSocketId);
      }
    };

    socket.on("viewer-joined", onViewerJoined);
    socket.on("webrtc-answer", onAnswer);
    socket.on("webrtc-ice-candidate", onIceCandidate);
    socket.on("room-updated", onRoomUpdated);
    socket.on("viewer-left", onViewerLeft);

    return () => {
      mounted = false;
      socket.off("viewer-joined", onViewerJoined);
      socket.off("webrtc-answer", onAnswer);
      socket.off("webrtc-ice-candidate", onIceCandidate);
      socket.off("room-updated", onRoomUpdated);
      socket.off("viewer-left", onViewerLeft);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();

      socket.emit("end-stream", { roomId });
    };
  }, [user, socket, isConnected, roomId, router, createPeerForViewer]);

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const endStream = () => {
    if (socket) {
      socket.emit("end-stream", { roomId }, () => {
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
        toast.success("Stream ended");
        router.push("/");
      });
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/watch/${roomId}`;
    navigator.clipboard.writeText(url);
    toast.success("Watch link copied!");
  };

  const kickParticipant = (uid: string) => {
    if (!socket) return;
    socket.emit("kick-participant", { roomId, targetUid: uid }, (res: any) => {
      if (res.success) {
        toast.success("Participant removed");
      } else {
        toast.error(res.error || "Failed to kick");
      }
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-bg-primary text-text-primary">
      {/* Main Broadcast Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="h-12 border-b border-border-subtle flex items-center justify-between px-4 bg-bg-secondary/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 bg-live-red rounded-md text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />
              Broadcasting
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Eye className="w-3.5 h-3.5" />
              <span className="font-semibold">{participantsCount}</span>
              <span>viewers</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <VoiceChat roomId={roomId} />
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-elevated hover:bg-bg-tertiary text-text-secondary text-xs font-semibold border border-border-subtle transition-all"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Copy Link</span>
            </button>
            <button
              onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
              className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted transition-colors lg:hidden"
            >
              {isSidePanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Video Container */}
        <div className="flex-1 flex items-center justify-center p-4 bg-bg-primary">
          <div className="w-full max-w-5xl aspect-video rounded-2xl overflow-hidden border border-border-subtle relative bg-black shadow-2xl shadow-black/50">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
            <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-black uppercase tracking-widest text-white border border-white/10 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-live-red animate-pulse" />
              Screen Feed
            </div>
            <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-accent-primary/20 backdrop-blur-md rounded-lg text-[10px] font-bold text-accent-primary border border-accent-primary/30 flex items-center gap-2">
              <Monitor className="w-3.5 h-3.5" />
              Primary Display
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="h-20 border-t border-border-subtle flex items-center justify-center gap-4 px-6 bg-bg-secondary/50 shrink-0">
          <button
            onClick={toggleAudio}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isAudioMuted
                ? "bg-destructive/15 text-destructive border border-destructive/30 shadow-lg shadow-destructive/10"
                : "bg-bg-elevated text-text-secondary hover:text-text-primary border border-border-subtle hover:border-text-muted/30"
            }`}
            title={isAudioMuted ? "Unmute mic" : "Mute mic"}
          >
            {isAudioMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          <div className="w-px h-8 bg-border-subtle mx-2" />
          <button
            onClick={endStream}
            className="px-8 py-3 bg-live-red hover:bg-live-red/90 text-white font-black rounded-2xl transition-all flex items-center gap-2.5 text-sm uppercase tracking-wider shadow-xl shadow-live-red/20 active:scale-[0.98]"
          >
            <StopCircle className="w-5 h-5" />
            End Broadcast
          </button>
        </div>
      </div>

      {/* Side Panel */}
      <div
        className={`${
          isSidePanelOpen ? "w-80" : "w-0"
        } transition-all duration-300 border-l border-border-subtle flex flex-col bg-bg-secondary overflow-hidden shrink-0`}
      >
        <div className="flex border-b border-border-subtle shrink-0">
          <button
            onClick={() => setSidePanel("chat")}
            className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${
              sidePanel === "chat"
                ? "text-accent-primary border-b-2 border-accent-primary bg-accent-primary/5"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Chat
          </button>
          <button
            onClick={() => setSidePanel("participants")}
            className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${
              sidePanel === "participants"
                ? "text-accent-primary border-b-2 border-accent-primary bg-accent-primary/5"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Users className="w-4 h-4" />
            People
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-elevated font-black">
              {participantsCount}
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {sidePanel === "chat" ? (
            <LiveChat roomId={roomId} />
          ) : (
            <ParticipantList
              participants={participants}
              hostUid={user.uid}
              hostDisplayName={user.displayName || "Host"}
              hostPhotoURL={user.photoURL || ""}
              isHost={true}
              onKick={kickParticipant}
            />
          )}
        </div>
      </div>
    </div>
  );
}
