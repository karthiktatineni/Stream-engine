"use client";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { Send, MessageCircle } from "lucide-react";

interface ChatMessage {
  id: string;
  uid: string;
  displayName: string;
  photoURL: string;
  text: string;
  timestamp: number;
}

interface Reaction {
  id: string;
  emoji: string;
  displayName: string;
}

export default function LiveChat({ roomId }: { roomId: string }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg].slice(-150));
    };

    const onReaction = (reaction: Reaction) => {
      setReactions((prev) => [...prev, reaction]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 2500);
    };

    const onChatError = (data: { error: string }) => {
      setChatError(data.error);
      setTimeout(() => setChatError(null), 3000);
    };

    socket.on("chat-message", onMessage);
    socket.on("room-reaction", onReaction);
    socket.on("chat-error", onChatError);

    return () => {
      socket.off("chat-message", onMessage);
      socket.off("room-reaction", onReaction);
      socket.off("chat-error", onChatError);
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !user) return;

    socket.emit("send-message", {
      roomId,
      message: newMessage.trim(),
    });
    setNewMessage("");
  };

  const sendReaction = (emoji: string) => {
    if (!socket || !user) return;
    socket.emit("send-reaction", { roomId, emoji });
  };

  const reactionEmojis = ["🔥", "😂", "👏", "❤️", "😮", "🎉", "💯", "👀"];

  return (
    <div className="flex flex-col h-full bg-bg-primary relative">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-text-muted" />
        <span className="text-sm font-semibold text-text-primary">Live Chat</span>
        <span className="text-xs text-text-muted ml-auto">{messages.length} msgs</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <MessageCircle className="w-8 h-8 text-text-muted/30 mb-2" />
            <p className="text-xs text-text-muted">No messages yet</p>
            <p className="text-xs text-text-muted/60">Be the first to say something!</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex items-start gap-2 py-1 group animate-slide-in-right">
            <div className="w-6 h-6 rounded-full bg-bg-elevated flex items-center justify-center text-[10px] font-bold text-text-muted shrink-0 mt-0.5 overflow-hidden">
              {msg.photoURL ? (
                <img src={msg.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                msg.displayName[0]?.toUpperCase() || 'U'
              )}
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-accent-primary text-xs mr-1.5">
                {msg.displayName}
              </span>
              <span className="text-text-secondary text-sm break-words">{msg.text}</span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Reactions */}
      <div className="absolute bottom-28 right-3 pointer-events-none flex flex-col-reverse gap-1 z-50">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="animate-float-up text-2xl"
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Error Banner */}
      {chatError && (
        <div className="mx-3 mb-1 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
          {chatError}
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 border-t border-border-subtle bg-bg-secondary/50">
        {/* Reactions */}
        <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-1 scrollbar-hide">
          {reactionEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              disabled={!user}
              className="p-1.5 hover:bg-bg-elevated rounded-lg transition-all hover:scale-110 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 text-base shrink-0"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Message Input */}
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={!user}
            placeholder={user ? "Send a message..." : "Sign in to chat"}
            maxLength={500}
            className="flex-1 bg-bg-tertiary text-text-primary border border-border-subtle rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent-primary focus:border-accent-primary outline-none transition-all placeholder:text-text-muted"
          />
          <button
            type="submit"
            disabled={!user || !newMessage.trim()}
            className="p-2 bg-accent-primary hover:bg-accent-hover disabled:bg-bg-elevated disabled:text-text-muted text-white rounded-lg transition-all shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
