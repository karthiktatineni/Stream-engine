"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { LogIn, LogOut, Radio, Wifi, WifiOff } from "lucide-react";
import Image from "next/image";

export default function Navbar() {
  const { user, signInWithGoogle, signOut, loading } = useAuth();
  const { connectionState } = useSocket();

  return (
    <nav className="fixed top-0 w-full h-16 bg-bg-secondary/80 backdrop-blur-xl border-b border-border-subtle flex items-center px-4 md:px-6 z-50">
      <div className="w-full max-w-[1920px] mx-auto flex items-center justify-between">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-accent-primary flex items-center justify-center group-hover:scale-105 transition-transform">
            <Radio className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-extrabold text-lg tracking-tight hidden sm:block">
            Stream<span className="text-accent-primary">Engine</span>
          </span>
        </Link>

        {/* Center: Connection Status */}
        <div className="hidden md:flex items-center gap-2">
          {connectionState === 'connected' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-status-pulse" />
              <span className="text-[11px] font-semibold text-success">Connected</span>
            </div>
          ) : connectionState === 'reconnecting' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10 border border-warning/20">
              <Wifi className="w-3 h-3 text-warning animate-pulse" />
              <span className="text-[11px] font-semibold text-warning">Reconnecting...</span>
            </div>
          ) : connectionState === 'connecting' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-muted border border-accent-border">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
              <span className="text-[11px] font-semibold text-accent-primary">Connecting</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 border border-destructive/20">
              <WifiOff className="w-3 h-3 text-destructive" />
              <span className="text-[11px] font-semibold text-destructive">Offline</span>
            </div>
          )}
        </div>

        {/* Right: Auth */}
        <div className="flex items-center gap-3">
          {!loading && (
            <>
              {user ? (
                <div className="flex items-center gap-3">
                  <Link
                    href="/go-live"
                    className="bg-accent-primary hover:bg-accent-hover text-white px-4 py-2 rounded-lg font-semibold transition-all text-sm flex items-center gap-2 hover:shadow-lg hover:shadow-accent-primary/20"
                  >
                    <Radio className="w-4 h-4" />
                    <span className="hidden sm:inline">Go Live</span>
                  </Link>
                  <div className="flex items-center gap-2">
                    {user.photoURL ? (
                      <Image
                        src={user.photoURL}
                        alt={user.displayName || "Avatar"}
                        width={32}
                        height={32}
                        className="rounded-full border border-border-subtle"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center text-xs font-bold text-text-secondary">
                        {(user.displayName || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <button
                      onClick={signOut}
                      className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-elevated transition-colors"
                      title="Sign Out"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="bg-text-primary text-bg-primary hover:bg-text-secondary px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 text-sm"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
