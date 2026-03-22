import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { SocketProvider } from '../context/SocketContext';
import { StreamProvider } from '../context/StreamContext';
import Navbar from '@/components/Navbar';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'StreamEngine — Live Streaming Together',
  description: 'Watch live streams together with friends in real-time. Start streaming, join rooms, chat, react, and voice chat — all in sync.',
  keywords: ['live streaming', 'watch party', 'real-time', 'WebRTC', 'voice chat'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-bg-primary text-text-primary min-h-screen flex flex-col">
        <AuthProvider>
          <SocketProvider>
            <StreamProvider>
              <Navbar />
              <main className="flex-1 w-full flex flex-col">
                {children}
              </main>
              <Toaster
                position="bottom-right"
                toastOptions={{
                  duration: 3000,
                  style: {
                    background: '#1a1a1f',
                    color: '#fafafa',
                    border: '1px solid #27272a',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
                  },
                  success: {
                    iconTheme: {
                      primary: '#6366f1',
                      secondary: '#fafafa',
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fafafa',
                    },
                  },
                }}
              />
            </StreamProvider>
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
