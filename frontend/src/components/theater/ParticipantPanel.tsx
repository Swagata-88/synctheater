'use client';

import React from 'react';
import { Crown, Shield, UserMinus, Users } from 'lucide-react';

export interface Participant {
  id: string;
  userId: string;
  role: 'OWNER' | 'MODERATOR' | 'PARTICIPANT';
  joinedAt: string | Date;
  user?: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  };
}

interface ParticipantPanelProps {
  participants: Participant[];
  currentUserId?: string;
  isOwner: boolean;
  onKickParticipant?: (targetUserId: string) => void;
  onTransferOwnership?: (targetUserId: string) => void;
}

export function ParticipantPanel({
  participants,
  currentUserId,
  isOwner,
  onKickParticipant,
  onTransferOwnership,
}: ParticipantPanelProps) {
  return (
    <div className="flex flex-col h-full cinema-card border border-[#353535] p-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#353535] mb-3">
        <h4 className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-4 h-4 text-[#D6B56D]" />
          In The Theater
        </h4>
        <span className="text-xs font-mono bg-[#202020] text-[#D6B56D] border border-[#353535] px-2.5 py-0.5 rounded-full">
          {participants.length} viewers
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {participants.map((p) => {
          const username = p.user?.username || `User-${p.userId.substring(0, 5)}`;
          const avatar =
            p.user?.avatarUrl ||
            `https://api.dicebear.com/7.x/bottts/svg?seed=${p.userId}`;
          const isSelf = currentUserId === p.userId;

          return (
            <div
              key={p.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[#111111] border border-[#353535] hover:border-[#D6B56D]/40 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative">
                  <img
                    src={avatar}
                    alt={username}
                    className="w-8 h-8 rounded-full bg-[#202020] border border-[#353535] object-cover"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#111111]" />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#FFFFFF] truncate flex items-center gap-1.5">
                    <span>{username}</span>
                    {isSelf && <span className="text-[10px] text-[#777777]">(you)</span>}
                  </p>

                  <div className="flex items-center gap-1 mt-0.5">
                    {p.role === 'OWNER' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#202020] text-[#D6B56D] border border-[#D6B56D]/40">
                        <Crown className="w-2.5 h-2.5 text-[#D6B56D]" />
                        Host
                      </span>
                    )}
                    {p.role === 'MODERATOR' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#202020] text-[#F0D89F] border border-[#F0D89F]/40">
                        <Shield className="w-2.5 h-2.5 text-[#F0D89F]" />
                        Mod
                      </span>
                    )}
                    {p.role === 'PARTICIPANT' && (
                      <span className="text-[10px] text-[#777777] font-mono">Viewer</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Host Actions */}
              {isOwner && !isSelf && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onTransferOwnership?.(p.userId)}
                    title="Make Room Host"
                    className="p-1.5 rounded-lg text-[#777777] hover:text-[#D6B56D] hover:bg-[#202020] transition-colors cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onKickParticipant?.(p.userId)}
                    title="Kick from Theater"
                    className="p-1.5 rounded-lg text-[#777777] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
