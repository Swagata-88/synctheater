import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';

export const metadata: Metadata = {
  title: 'SYNCTHEATER — Watch Together. Anywhere. In Sync.',
  description:
    'Full-stack social watch-party platform with server-authoritative video synchronization, LiveKit voice/video, real-time chat, and cinematic environments.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090b10] text-[#f3f4f6] antialiased selection:bg-indigo-500 selection:text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
