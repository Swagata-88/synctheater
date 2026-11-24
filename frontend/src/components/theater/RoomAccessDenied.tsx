'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col bg-[#090909] text-[#FFFFFF]">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="cinema-card w-full max-w-md p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#D6B56D] to-transparent" />
          <div className="w-14 h-14 rounded-2xl bg-[#202020] border border-[#353535] text-[#D6B56D] mx-auto flex items-center justify-center mb-5">
            <Lock className="w-7 h-7 text-[#D6B56D]" />
          </div>

          <h2 className="text-xl font-extrabold text-[#FFFFFF] mb-2">
            {title || 'Private Theater'}
          </h2>

          <p className="text-sm text-[#B9B9B9] leading-relaxed mb-6">
            {message || 'This watch party is private. A valid invitation link is required to join.'}
          </p>

          <div className="space-y-3">
            <button
              onClick={handleEnterCode}
              className="w-full py-3 px-4 rounded-xl text-sm font-bold btn-gold-primary transition-all cursor-pointer"
            >
              Enter Invitation Code
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold btn-gold-secondary transition-colors cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
