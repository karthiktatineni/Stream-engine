"use client";

import { Users, Crown, Mic, MicOff, UserX } from "lucide-react";

interface ParticipantInfo {
  uid: string;
  displayName: string;
  photoURL: string;
  isMuted: boolean;
  isVoiceActive: boolean;
}

interface ParticipantListProps {
  participants: ParticipantInfo[];
  hostUid: string;
  hostDisplayName: string;
  hostPhotoURL: string;
  isHost: boolean;
  onKick?: (uid: string) => void;
}

export default function ParticipantList({
  participants,
  hostUid,
  hostDisplayName,
  hostPhotoURL,
  isHost,
  onKick,
}: ParticipantListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary">
            Participants
          </span>
        </div>
        <span className="text-xs font-medium text-text-muted bg-bg-elevated px-2 py-0.5 rounded-full">
          {participants.length + 1}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {/* Host */}
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-accent-muted/50">
          <div className="w-7 h-7 rounded-full bg-accent-primary flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
            {hostPhotoURL ? (
              <img src={hostPhotoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              hostDisplayName[0]?.toUpperCase() || 'H'
            )}
          </div>
          <span className="text-sm font-semibold text-text-primary truncate flex-1">
            {hostDisplayName}
          </span>
          <Crown className="w-3.5 h-3.5 text-warning shrink-0" />
        </div>

        {/* Viewers */}
        {participants.map((p) => (
          <div
            key={p.uid}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-bg-elevated transition-colors group"
          >
            <div className="w-7 h-7 rounded-full bg-bg-elevated flex items-center justify-center text-xs font-bold text-text-secondary shrink-0 overflow-hidden">
              {p.photoURL ? (
                <img src={p.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                p.displayName[0]?.toUpperCase() || 'U'
              )}
            </div>
            <span className="text-sm text-text-secondary truncate flex-1">
              {p.displayName}
            </span>
            <div className="flex items-center gap-1">
              {p.isVoiceActive && (
                p.isMuted ? (
                  <MicOff className="w-3 h-3 text-destructive" />
                ) : (
                  <Mic className="w-3 h-3 text-success" />
                )
              )}
              {isHost && p.uid !== hostUid && (
                <button
                  onClick={() => onKick?.(p.uid)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/15 text-text-muted hover:text-destructive transition-all"
                  title={`Remove ${p.displayName}`}
                >
                  <UserX className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}

        {participants.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-text-muted">No viewers yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
