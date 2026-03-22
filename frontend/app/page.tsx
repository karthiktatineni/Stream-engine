"use client";

import { useEffect, useState, useMemo } from "react";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import {
  Radio, Users, Flame, TrendingUp, Search,
  Zap, ArrowRight, Eye, Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface StreamRoom {
  id: string;
  title: string;
  category: string;
  hostDisplayName: string;
  hostPhotoURL: string;
  viewerCount: number;
  startedAt: number;
  status: string;
}

type SortMode = 'viewers' | 'recent';

export default function Home() {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const [activeRooms, setActiveRooms] = useState<StreamRoom[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortMode, setSortMode] = useState<SortMode>('viewers');

  const categories = ["All", "Gaming", "Just Chatting", "Music", "Education", "Tech"];

  useEffect(() => {
    if (socket && isConnected) {
      socket.emit("get-active-rooms");

      const onRoomsUpdate = (rooms: StreamRoom[]) => {
        setActiveRooms(rooms);
      };

      socket.on("active-rooms", onRoomsUpdate);

      // Periodic refresh as backup
      const interval = setInterval(() => {
        socket.emit("get-active-rooms");
      }, 8000);

      return () => {
        socket.off("active-rooms", onRoomsUpdate);
        clearInterval(interval);
      };
    }
  }, [socket, isConnected]);

  const filteredRooms = useMemo(() => {
    let result = activeRooms;
    if (selectedCategory !== "All") {
      result = result.filter((r) => r.category === selectedCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.hostDisplayName.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
      );
    }
    // Sort
    if (sortMode === 'viewers') {
      result = [...result].sort((a, b) => b.viewerCount - a.viewerCount);
    } else {
      result = [...result].sort((a, b) => b.startedAt - a.startedAt);
    }
    return result;
  }, [activeRooms, selectedCategory, searchQuery, sortMode]);

  const featuredStream = filteredRooms[0];
  const trendingStreams = filteredRooms.slice(0, 4);
  const totalViewers = activeRooms.reduce((sum, r) => sum + r.viewerCount, 0);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border-subtle">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/8 via-bg-primary to-bg-primary" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
        
        <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="max-w-2xl space-y-6">
            {/* Stats bar */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-live-red/10 border border-live-red/20">
                <div className="w-1.5 h-1.5 rounded-full bg-live-red animate-live-pulse" />
                <span className="font-semibold text-live-red">
                  {activeRooms.length} Live Now
                </span>
              </div>
              {totalViewers > 0 && (
                <div className="flex items-center gap-1.5 text-text-muted">
                  <Eye className="w-3.5 h-3.5" />
                  <span className="font-medium">{totalViewers} watching</span>
                </div>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Watch streams{" "}
              <span className="text-accent-primary">together</span>
              <br />
              in real&nbsp;time
            </h1>

            <p className="text-text-secondary text-lg md:text-xl leading-relaxed max-w-lg">
              Start a live stream, invite friends, voice chat, react together — 
              all synchronized with ultra-low latency WebRTC.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {user ? (
                <Link
                  href="/go-live"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent-primary hover:bg-accent-hover text-white font-semibold transition-all hover:shadow-lg hover:shadow-accent-primary/20 active:scale-[0.98]"
                >
                  <Radio className="w-5 h-5" />
                  Start Streaming
                </Link>
              ) : (
                <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-bg-elevated text-text-muted font-medium border border-border-subtle cursor-default">
                  <Radio className="w-5 h-5" />
                  Sign in to start streaming
                </div>
              )}
              <a
                href="#discover"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-bg-secondary hover:bg-bg-tertiary text-text-primary font-semibold border border-border-subtle transition-all active:scale-[0.98]"
              >
                Explore Streams
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Stream (if any live) */}
      {featuredStream && (
        <section className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-warning" />
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">Featured</h2>
          </div>
          <Link
            href={`/watch/${featuredStream.id}`}
            className="block group bg-bg-secondary rounded-2xl border border-border-subtle overflow-hidden hover:border-accent-primary/30 transition-all"
          >
            <div className="flex flex-col md:flex-row">
              <div className="flex-1 aspect-video md:aspect-auto md:h-64 bg-bg-tertiary flex items-center justify-center relative">
                <Radio className="w-16 h-16 text-text-muted/20 group-hover:text-accent-primary/30 transition-colors" />
                <div className="absolute top-4 left-4 flex gap-2">
                  <div className="px-2.5 py-1 bg-live-red rounded-md text-[11px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />
                    Live
                  </div>
                  <div className="px-2.5 py-1 bg-bg-primary/70 backdrop-blur rounded-md text-xs font-semibold text-text-primary flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {featuredStream.viewerCount}
                  </div>
                </div>
              </div>
              <div className="p-6 md:w-[360px] flex flex-col justify-center">
                <span className="text-xs font-semibold text-accent-primary uppercase tracking-wider mb-2">
                  {featuredStream.category}
                </span>
                <h3 className="text-xl font-bold text-text-primary mb-2 group-hover:text-accent-primary transition-colors">
                  {featuredStream.title}
                </h3>
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <div className="w-6 h-6 rounded-full bg-bg-elevated flex items-center justify-center text-[10px] font-bold overflow-hidden">
                    {featuredStream.hostPhotoURL ? (
                      <img src={featuredStream.hostPhotoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      featuredStream.hostDisplayName[0]?.toUpperCase()
                    )}
                  </div>
                  <span>{featuredStream.hostDisplayName}</span>
                  <span className="text-text-muted/40">·</span>
                  <span>{formatDistanceToNow(featuredStream.startedAt)} ago</span>
                </div>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Trending Section (quick cards) */}
      {trendingStreams.length > 1 && (
        <section className="max-w-7xl mx-auto px-4 md:px-6 pb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-accent-primary" />
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">Trending</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {trendingStreams.map((room) => (
              <Link
                key={room.id}
                href={`/watch/${room.id}`}
                className="group bg-bg-secondary rounded-xl border border-border-subtle p-3 hover:border-accent-primary/30 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-live-red animate-live-pulse" />
                  <span className="text-[11px] font-bold text-live-red uppercase">Live</span>
                  <span className="text-[11px] text-text-muted ml-auto flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {room.viewerCount}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-text-primary truncate group-hover:text-accent-primary transition-colors">
                  {room.title}
                </h4>
                <p className="text-xs text-text-muted mt-1 truncate">{room.hostDisplayName} · {room.category}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Discovery Section */}
      <section id="discover" className="max-w-7xl mx-auto px-4 md:px-6 py-8 border-t border-border-subtle">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-text-muted" />
            <h2 className="text-lg font-bold text-text-primary">All Live Streams</h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-primary transition-colors" />
              <input
                type="text"
                placeholder="Search streams, hosts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 pl-9 pr-3 py-2 bg-bg-secondary border border-border-subtle rounded-lg text-sm text-text-primary focus:ring-1 focus:ring-accent-primary focus:border-accent-primary outline-none transition-all placeholder:text-text-muted"
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1.5 bg-bg-secondary border border-border-subtle rounded-lg p-0.5">
              <button
                onClick={() => setSortMode('viewers')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  sortMode === 'viewers'
                    ? 'bg-bg-elevated text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Users className="w-3 h-3 inline mr-1" />
                Popular
              </button>
              <button
                onClick={() => setSortMode('recent')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  sortMode === 'recent'
                    ? 'bg-bg-elevated text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Clock className="w-3 h-3 inline mr-1" />
                Recent
              </button>
            </div>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-accent-primary text-white"
                  : "bg-bg-secondary text-text-muted hover:text-text-secondary border border-border-subtle hover:border-border-default"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Stream Grid */}
        {filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-bg-secondary flex items-center justify-center mb-4 border border-border-subtle">
              <Radio className="w-7 h-7 text-text-muted/30" />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-1.5">No live streams</h3>
            <p className="text-sm text-text-muted max-w-xs mb-6">
              {searchQuery || selectedCategory !== "All"
                ? "Try a different search or category."
                : "It's quiet here. Be the first to go live!"}
            </p>
            {!searchQuery && selectedCategory === "All" && user && (
              <Link
                href="/go-live"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-hover text-white font-semibold rounded-xl transition-all text-sm"
              >
                <Radio className="w-4 h-4" />
                Go Live
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRooms.map((room) => (
              <Link
                href={`/watch/${room.id}`}
                key={room.id}
                className="group flex flex-col bg-bg-secondary rounded-xl border border-border-subtle overflow-hidden hover:border-accent-primary/30 transition-all hover:shadow-lg hover:shadow-accent-primary/5"
              >
                {/* Thumbnail Area */}
                <div className="aspect-video bg-bg-tertiary relative flex items-center justify-center">
                  <Radio className="w-10 h-10 text-text-muted/15 group-hover:text-accent-primary/20 transition-colors" />
                  
                  {/* Top-left: Live badge */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <div className="px-2 py-0.5 bg-live-red rounded text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-white animate-live-pulse" />
                      Live
                    </div>
                  </div>

                  {/* Bottom-left: Viewer count */}
                  <div className="absolute bottom-3 left-3 px-2 py-0.5 bg-bg-primary/70 backdrop-blur rounded text-xs font-semibold text-text-primary flex items-center gap-1">
                    <Users className="w-3 h-3 text-text-muted" />
                    {room.viewerCount}
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 flex gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center text-xs font-bold text-text-muted shrink-0 overflow-hidden">
                    {room.hostPhotoURL ? (
                      <img src={room.hostPhotoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      room.hostDisplayName[0]?.toUpperCase() || 'S'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className="text-sm font-semibold text-text-primary truncate group-hover:text-accent-primary transition-colors"
                      title={room.title}
                    >
                      {room.title}
                    </h3>
                    <p className="text-xs text-text-muted truncate mt-0.5">
                      {room.hostDisplayName}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] font-medium text-text-muted px-1.5 py-0.5 rounded bg-bg-elevated">
                        {room.category}
                      </span>
                      <span className="text-[11px] text-text-muted/60">
                        {formatDistanceToNow(room.startedAt)} ago
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
