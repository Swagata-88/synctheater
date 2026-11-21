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
    <div className="glass-panel p-6 rounded-2xl border border-white/10">
      <div className="flex items-center gap-2.5 text-sm font-semibold text-white mb-2">
        <KeyRound className="w-4 h-4 text-amber-400" />
        Join With Invitation Link
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Paste an invitation URL or room link you received to join directly.
      </p>
      <form onSubmit={handleJoinByCode} className="flex gap-2">
        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="e.g. https://.../room/xyz?invite=..."
          className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:border-indigo-500 outline-none"
        />
        <button
          type="submit"
          className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          Join
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
