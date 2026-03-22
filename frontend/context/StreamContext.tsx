"use client";
import React, { createContext, useContext, useState, useCallback, useRef } from "react";

interface StreamContextType {
  activeStream: MediaStream | null;
  setActiveStream: (stream: MediaStream | null) => void;
  isScreenShare: boolean;
  setIsScreenShare: (is: boolean) => void;
  stopStream: () => void;
}

const StreamContext = createContext<StreamContextType>({
  activeStream: null,
  setActiveStream: () => {},
  isScreenShare: false,
  setIsScreenShare: () => {},
  stopStream: () => {},
});

export const StreamProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeStream, setStreamState] = useState<MediaStream | null>(null);
  const [isScreenShare, setIsScreenShare] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const setActiveStream = useCallback((stream: MediaStream | null) => {
    streamRef.current = stream;
    setStreamState(stream);
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStreamState(null);
    }
  }, []);

  return (
    <StreamContext.Provider 
      value={{ 
        activeStream, 
        setActiveStream, 
        isScreenShare, 
        setIsScreenShare, 
        stopStream 
      }}
    >
      {children}
    </StreamContext.Provider>
  );
};

export const useStream = () => useContext(StreamContext);
