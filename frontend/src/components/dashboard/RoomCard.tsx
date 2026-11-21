'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, Users, Share2, Check, Play } from 'lucide-react';

export interface DashboardRoomItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  privacy: 'PRIVATE';
  maxCapacity: number;
  currentVideoId: string | null;
  currentVideoUrl: string | null;
  currentProvider: string;
  participantCount: number;
  ownerId: string;
  userRole?: string;
  joinedAt?: string;
}

interface RoomCardProps {
  room: DashboardRoomItem;
  isCopied: boolean;
  onCopyInvite: (room: DashboardRoomItem) => void;
}

export function RoomCard({ room, isCopied, onCopyInvite }: RoomCardProps) {
  return (
    <div className="glass-panel rounded-2xl border border-white/10 hover:border-indigo-500/40 p-5 flex flex-col justify-between group transition-all">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/20">
            <Lock className="w-3 h-3 text-amber-400" />
            PRIVATE ROOM
          </span>

          <span className="text-xs text-gray-400 font-mono flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {room.participantCount} / {room.maxCapacity}
          </span>
        </div>

        <h3 className="font-bold text-lg text-white group-hover:text-indigo-300 transition-colors line-clamp-1 mb-1.5">
          {room.name}
        </h3>

        <p className="text-xs text-gray-400 line-clamp-2 mb-4">
          {room.description || 'Private synchronized watch party room.'}
        </p>
      </div>

      <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCopyInvite(room)}
            title="Generate and copy invitation link"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              isCopied
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300'
            }`}
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                Invite Link
              </>
            )}
          </button>
        </div>

        <Link
          href={`/room/${room.slug}`}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600/80 hover:bg-indigo-600 text-white transition-all cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Enter Theater
        </Link>
      </div>
    </div>
  );
}
