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
    <div className="cinema-card p-5 flex flex-col justify-between group transition-all hover:border-[#D6B56D]/50 relative">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#202020] text-[#D6B56D] border border-[#D6B56D]/30">
            <Lock className="w-3 h-3 text-[#D6B56D]" />
            PRIVATE
          </span>

          <span className="text-xs text-[#777777] font-mono flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {room.participantCount} / {room.maxCapacity}
          </span>
        </div>

        <h3 className="font-bold text-base text-[#FFFFFF] group-hover:text-[#F0D89F] transition-colors line-clamp-1 mb-1.5">
          {room.name}
        </h3>

        <p className="text-xs text-[#B9B9B9] line-clamp-2 mb-4 leading-relaxed">
          {room.description || 'Private synchronized watch party room.'}
        </p>
      </div>

      <div className="pt-4 border-t border-[#353535] flex items-center justify-between gap-2">
        <button
          onClick={() => onCopyInvite(room)}
          title="Generate and copy invitation link"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
            isCopied
              ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300'
              : 'bg-[#202020] border-[#353535] hover:border-[#D6B56D] text-[#B9B9B9] hover:text-[#FFFFFF]'
          }`}
        >
          {isCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              Copied
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5 text-[#D6B56D]" />
              Invite Link
            </>
          )}
        </button>

        <Link
          href={`/room/${room.slug}`}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold btn-gold-primary transition-all cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Enter Theater
        </Link>
      </div>
    </div>
  );
}
