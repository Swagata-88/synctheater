'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { Navbar } from '../Navbar';

interface RoomAccessDeniedProps {
  slug: string;
  title?: string;
  message?: string;
}

export function RoomAccessDenied({ slug, title, message }: RoomAccessDeniedProps) {
  const router = useRouter();

  const handleEnterCode = () => {
    const input = prompt('Paste invitation token or invitation link:');
    if (input) {
      const token = input.includes('invite=')
        ? new URL(input, typeof window !== 'undefined' ? window.location.origin : 'https://synctheater.com').searchParams.get('invite') || input
        : input;
      router.push(`/room/${slug}?invite=${encodeURIComponent(token.trim())}`);
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#07090e] text-white">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="glass-panel w-full max-w-md p-8 rounded-2xl border border-white/10 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500" />
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center mb-5">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-extrabold text-white mb-2">
            {title || 'Private Theater'}
          </h2>

          <p className="text-sm text-gray-300 leading-relaxed mb-6">
            {message || 'This watch party is private. A valid invitation link is required to join.'}
          </p>

          <div className="space-y-3">
            <button
              onClick={handleEnterCode}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all cursor-pointer"
            >
              Enter Invitation Code
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
