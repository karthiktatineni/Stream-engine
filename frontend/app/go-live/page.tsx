"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Radio, Settings2, Monitor, AlertCircle, XCircle } from "lucide-react";

export default function GoLiveSetup() {
  const { user, loading: authLoading } = useAuth();
  const { socket, isConnected } = useSocket();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Just Chatting");
  const [isPublic, setIsPublic] = useState(true);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [starting, setStarting] = useState(false);
  const [actualCapability, setActualCapability] = useState<string>("");
  const isNavigatingToRoom = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      toast.error("You must be signed in to stream");
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (previewStream && videoRef.current) {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  const stopPreview = useCallback(() => {
    if (previewStream) {
      previewStream.getTracks().forEach((track) => track.stop());
      setPreviewStream(null);
    }
    setActualCapability("");
  }, [previewStream]);

  const requestScreenShare = useCallback(async () => {
    stopPreview();

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 3840 },
          height: { ideal: 2160 },
          frameRate: { ideal: 60 },
        },
        audio: true,
      });

      // Get mic audio separately for voice
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        // Screen share without mic is okay
      }

      // Combine screen video with mic audio
      const tracks = [...screenStream.getVideoTracks()];
      if (micStream) {
        tracks.push(...micStream.getAudioTracks());
      } else if (screenStream.getAudioTracks().length > 0) {
        tracks.push(...screenStream.getAudioTracks());
      }

      const combinedStream = new MediaStream(tracks);
      const videoTrack = combinedStream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings();
      const actualLabel = `Screen: ${settings?.width}x${settings?.height} @ ${Math.round(settings?.frameRate || 30)}FPS`;
      setActualCapability(actualLabel);
      setPreviewStream(combinedStream);
      toast.success(actualLabel);

      // Handle the browser's "Stop sharing" button
      videoTrack?.addEventListener('ended', () => {
        setPreviewStream(null);
        setActualCapability("");
        toast("Screen sharing stopped", { icon: '🖥️' });
      });
    } catch (err) {
      console.error(err);
      toast.error("Screen share cancelled or denied");
    }
  }, [stopPreview]);

  useEffect(() => {
    return () => {
      // ONLY stop tracks if we're not passing them to the next page
      if (!isNavigatingToRoom.current) {
        previewStream?.getTracks().forEach((t) => t.stop());
      }
    };
  }, [previewStream]);

  const handleStartStream = () => {
    if (!title.trim()) {
      toast.error("Enter a stream title");
      return;
    }
    if (!previewStream) {
      toast.error("Select your screen to share first");
      return;
    }
    if (!socket || !isConnected) {
      toast.error("Not connected to server");
      return;
    }

    setStarting(true);
    socket.emit(
      "start-stream",
      { title: title.trim(), category, isPublic },
      (response: any) => {
        if (response.success) {
          toast.success("Stream created!");
          // Mark that we are navigating, so unmount cleanup doesn't stop the tracks
          isNavigatingToRoom.current = true;
          (window as any).__streamEnginePreviewStream = previewStream;
          (window as any).__streamEngineScreenShare = true;
          router.push(`/host/${response.roomId}`);
        } else {
          toast.error(response.error || "Failed to start stream");
          setStarting(false);
        }
      }
    );
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] max-w-6xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold text-text-primary flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center">
            <Radio className="w-5 h-5 text-accent-primary" />
          </div>
          Go Live
        </h1>
        <p className="text-text-muted mt-2 ml-[52px]">
          Share your screen with friends in real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Preview Area */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-bg-secondary rounded-2xl border border-border-subtle overflow-hidden">
            <div className="aspect-video bg-bg-primary relative flex items-center justify-center">
              {previewStream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center flex flex-col items-center p-8">
                  <div className="w-20 h-20 rounded-2xl bg-bg-secondary flex items-center justify-center mb-4 border border-border-subtle">
                    <Monitor className="w-8 h-8 text-text-muted/30" />
                  </div>
                  <h3 className="text-text-primary font-bold mb-2">Ready to share?</h3>
                  <p className="text-sm text-text-muted mb-6 max-w-xs uppercase tracking-tight font-semibold">Select your screen, application window, or browser tab to start streaming.</p>
                  <button
                    onClick={requestScreenShare}
                    className="px-8 py-3 bg-accent-primary hover:bg-accent-hover text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-accent-primary/20"
                  >
                    <Monitor className="w-5 h-5" />
                    Select Screen
                  </button>
                </div>
              )}
            </div>

            {previewStream && (
              <div className="px-4 py-3 flex items-center justify-between border-t border-border-subtle bg-bg-secondary/80">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success animate-status-pulse" />
                  <span className="text-xs font-semibold text-success">Screen Selected</span>
                  <span className="text-xs text-text-muted ml-1">{actualCapability}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={requestScreenShare}
                    className="text-xs text-text-muted hover:text-text-primary px-3 py-1.5 rounded-lg hover:bg-bg-elevated border border-border-subtle transition-all"
                  >
                    Change Screen
                  </button>
                  <button
                    onClick={stopPreview}
                    className="text-xs text-destructive hover:text-destructive/80 px-3 py-1.5 rounded-lg hover:bg-destructive/10 transition-all flex items-center gap-1.5 font-semibold"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Info Notice */}
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-accent-muted/50 border border-accent-border/50">
            <AlertCircle className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
            <div className="text-xs text-text-secondary leading-relaxed">
              <strong className="text-text-primary">Performance Tip:</strong> For the best quality, share a specific Application Window instead of your entire screen. StreamEngine supports up to 4K 60FPS based on your hardware.
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        <div className="lg:col-span-2">
          <div className="bg-bg-secondary rounded-2xl border border-border-subtle p-6 flex flex-col h-full">
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2 mb-6">
              <Settings2 className="w-4 h-4 text-text-muted" />
              Stream Settings
            </h2>

            <div className="space-y-5 flex-1">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                  Stream Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Watching some 4K nature documentaries!"
                  maxLength={100}
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary outline-none transition-all placeholder:text-text-muted/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary outline-none transition-all appearance-none cursor-pointer"
                >
                  <option>Gaming</option>
                  <option>Movie Night</option>
                  <option>Software Dev</option>
                  <option>Education</option>
                  <option>Just Chatting</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-3 px-4 bg-bg-primary/50 rounded-xl border border-border-subtle">
                <div>
                  <span className="text-sm font-bold text-text-primary block">Public</span>
                  <span className="text-[10px] text-text-muted font-medium">Allow anyone to find your stream</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-bg-elevated rounded-full peer peer-checked:bg-accent-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 transition-colors" />
                </label>
              </div>
            </div>

            <button
              onClick={handleStartStream}
              disabled={starting || !previewStream || !title.trim()}
              className="w-full mt-8 py-4 bg-accent-primary hover:bg-accent-hover disabled:bg-bg-elevated disabled:text-text-muted disabled:cursor-not-allowed text-white font-extrabold rounded-xl transition-all shadow-xl hover:shadow-accent-primary/30 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Radio className="w-5 h-5" />
              {starting ? "Starting..." : "Begin Broadcast"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
