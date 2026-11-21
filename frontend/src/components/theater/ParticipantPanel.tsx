'use client';

import React from 'react';
import { Crown, Shield, UserMinus, UserCheck, Users } from 'lucide-react';

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
    <div className="flex flex-col h-full bg-[#0d101a]/70 rounded-2xl border border-white/10 p-4">
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
          <Users className="w-4 h-4 text-indigo-400" />
          In The Theater
        </h4>
        <span className="text-xs font-mono bg-white/5 px-2 py-0.5 rounded text-gray-300">
          {participants.length} viewers
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {participants.map((p) => {
          const username = p.user?.username || `User-${p.userId.substring(0, 5)}`;
          const avatar =
            p.user?.avatarUrl ||
            `https://api.dicebear.com/7.x/bottts/svg?seed=${p.userId}`;
          const isSelf = currentUserId === p.userId;

          return (
            <div
              key={p.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative">
                  <img
                    src={avatar}
                    alt={username}
                    className="w-8 h-8 rounded-full bg-indigo-950 border border-white/10 object-cover"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0d101a]" />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                    <span>{username}</span>
                    {isSelf && <span className="text-[10px] text-gray-500">(you)</span>}
                  </p>

                  <div className="flex items-center gap-1 mt-0.5">
                    {p.role === 'OWNER' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <Crown className="w-2.5 h-2.5" />
                        Host
                      </span>
                    )}
                    {p.role === 'MODERATOR' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        <Shield className="w-2.5 h-2.5" />
                        Mod
                      </span>
                    )}
                    {p.role === 'PARTICIPANT' && (
                      <span className="text-[10px] text-gray-400 font-mono">Viewer</span>
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
                    className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                  >
                    <Crown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onKickParticipant?.(p.userId)}
                    title="Kick from Theater"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
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
