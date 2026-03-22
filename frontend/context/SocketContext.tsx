"use client";
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  connectionState: 'disconnected',
});

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { token, loading } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (loading) return;

    // Disconnect old socket if exists
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    setConnectionState('connecting');

    const socketInstance = io(BACKEND_URL, {
      withCredentials: true,
      auth: {
        token: token || undefined,
      },
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 15000,
      transports: ['websocket', 'polling'],
    });

    socketInstance.on("connect", () => {
      setIsConnected(true);
      setConnectionState('connected');
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
      setConnectionState('disconnected');
    });

    socketInstance.io.on("reconnect_attempt", () => {
      setConnectionState('reconnecting');
    });

    socketInstance.io.on("reconnect", () => {
      setIsConnected(true);
      setConnectionState('connected');
    });

    socketInstance.io.on("reconnect_failed", () => {
      setConnectionState('disconnected');
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [token, loading]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, connectionState }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
