import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';

export const metadata: Metadata = {
  title: 'SYNCTHEATER — Watch Together. Anywhere.',
  description:
    'Private synchronized cinema platform with server-authoritative playback, real-time messaging, and low-latency voice and video channels.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090909] text-[#FFFFFF] antialiased selection:bg-[#D6B56D] selection:text-[#090909]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
