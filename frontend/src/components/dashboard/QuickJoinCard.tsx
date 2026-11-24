'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, ArrowRight } from 'lucide-react';

export function QuickJoinCard() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = joinCode.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const urlObj = new URL(trimmed);
        const pathParts = urlObj.pathname.split('/room/').pop()?.split('/')[0];
        const inviteParam = urlObj.searchParams.get('invite');
        if (pathParts) {
          const target = `/room/${pathParts}${inviteParam ? `?invite=${encodeURIComponent(inviteParam)}` : ''}`;
          router.push(target);
          return;
        }
      } catch (e) {
        // Fall through to slug handling
      }
    }

    // Slug or slug with ?invite=
    const cleanSlug = trimmed.split('/room/').pop() || trimmed;
    router.push(`/room/${cleanSlug}`);
  };

  return (
    <div id="join" className="cinema-card p-6 border border-[#353535] relative">
      <div className="flex items-center gap-2.5 text-sm font-bold text-[#FFFFFF] mb-2">
        <KeyRound className="w-4 h-4 text-[#D6B56D]" />
        Join With Invitation Link
      </div>
      <p className="text-xs text-[#B9B9B9] mb-4">
        Paste an invitation URL or room link you received to join directly.
      </p>
      <form onSubmit={handleJoinByCode} className="flex gap-2">
        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="e.g. https://.../room/xyz?invite=..."
          className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#353535] text-[#FFFFFF] placeholder-[#777777] text-sm focus:border-[#D6B56D] outline-none transition-colors"
        />
        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl btn-gold-primary text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <span>Join</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
