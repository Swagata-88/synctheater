'use client';

import React, { useState } from 'react';
import { Share2, Plus, Copy, Trash2, Check, X } from 'lucide-react';
import { generateInviteUrl } from '../../lib/api';

interface RoomInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  inviteToken?: string;
  activeInviteUrl: string;
  invitationsList: any[];
  isOwnerOrMod: boolean;
  copiedToast: boolean;
  onCopyInviteUrl: (urlToCopy?: string) => Promise<void>;
  onCreateInvitation: (options: { maxUses?: number; expiresInHours?: number }) => Promise<void>;
  onRevokeInvitation: (token: string) => Promise<void>;
}

export function RoomInviteModal({
  isOpen,
  onClose,
  slug,
  inviteToken,
  activeInviteUrl,
  invitationsList,
  isOwnerOrMod,
  copiedToast,
  onCopyInviteUrl,
  onCreateInvitation,
  onRevokeInvitation,
}: RoomInviteModalProps) {
  const [newInviteMaxUses, setNewInviteMaxUses] = useState<string>('');
  const [newInviteExpiresHours, setNewInviteExpiresHours] = useState<string>('72');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const options: { maxUses?: number; expiresInHours?: number } = {};
      if (newInviteMaxUses) options.maxUses = Number(newInviteMaxUses);
      if (newInviteExpiresHours) options.expiresInHours = Number(newInviteExpiresHours);
      await onCreateInvitation(options);
      setNewInviteMaxUses('');
    } finally {
      setIsGenerating(false);
    }
  };

  const currentDisplayUrl =
    activeInviteUrl || (inviteToken ? generateInviteUrl(slug, inviteToken) : 'Generating invitation link...');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/85 backdrop-blur-md">
      <div className="cinema-card w-full max-w-lg rounded-2xl border border-[#353535] p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#D6B56D] to-transparent" />

        <div className="flex items-center justify-between pb-3 border-b border-[#353535] mb-4">
          <h3 className="text-base font-bold text-[#FFFFFF] flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#D6B56D]" />
            Invite Guests to Private Theater
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#777777] hover:text-[#FFFFFF] hover:bg-[#202020] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Share Link Card */}
        <div className="p-4 rounded-xl bg-[#111111] border border-[#353535] mb-5">
          <label className="block text-xs font-semibold text-[#B9B9B9] uppercase tracking-wider mb-2">
            Direct Invitation Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={currentDisplayUrl}
              className="flex-1 px-3 py-2 rounded-lg bg-[#171717] border border-[#353535] text-[#FFFFFF] text-xs font-mono outline-none select-all focus:border-[#D6B56D]"
            />
            <button
              onClick={() => onCopyInviteUrl()}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                copiedToast
                  ? 'bg-emerald-600 text-white'
                  : 'btn-gold-primary'
              }`}
            >
              {copiedToast ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Link
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-[#777777] mt-2">
            Recipients opening this link from any device or network will be admitted to this private room.
          </p>
        </div>

        {/* Management for Host / Mod */}
        {isOwnerOrMod && (
          <div className="space-y-4">
            <div className="pt-2 border-t border-[#353535]">
              <h4 className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider mb-3">
                Generate Custom Invitation
              </h4>
              <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[11px] text-[#B9B9B9] mb-1">Max Uses (Optional)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={newInviteMaxUses}
                    onChange={(e) => setNewInviteMaxUses(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#111111] border border-[#353535] text-[#FFFFFF] text-xs outline-none focus:border-[#D6B56D]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#B9B9B9] mb-1">Expires In (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="72"
                    value={newInviteExpiresHours}
                    onChange={(e) => setNewInviteExpiresHours(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#111111] border border-[#353535] text-[#FFFFFF] text-xs outline-none focus:border-[#D6B56D]"
                  />
                </div>
                <div className="col-span-2">
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold btn-gold-secondary flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#D6B56D]" />
                    {isGenerating ? 'Generating...' : 'Create New Link'}
                  </button>
                </div>
              </form>
            </div>

            {/* Existing Invitations List */}
            {invitationsList.length > 0 && (
              <div className="pt-2 border-t border-[#353535]">
                <h4 className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider mb-2">
                  Active Invitations ({invitationsList.filter((i) => !i.isRevoked).length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {invitationsList.map((inv) => (
                    <div
                      key={inv.id || inv.token}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        inv.isRevoked
                          ? 'bg-red-950/20 border-red-900/30 text-[#777777] opacity-60'
                          : 'bg-[#111111] border-[#353535] text-[#FFFFFF]'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-mono text-[11px] truncate">
                          token: {inv.token.substring(0, 10)}...
                        </p>
                        <p className="text-[10px] text-[#777777]">
                          Uses: {inv.usesCount} / {inv.maxUses ? inv.maxUses : '∞'} •{' '}
                          {inv.expiresAt
                            ? `Expires ${new Date(inv.expiresAt).toLocaleDateString()}`
                            : 'No expiry'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!inv.isRevoked && (
                          <>
                            <button
                              onClick={() =>
                                onCopyInviteUrl(inv.inviteUrl || generateInviteUrl(slug, inv.token))
                              }
                              title="Copy this link"
                              className="p-1.5 rounded-lg bg-[#202020] hover:bg-[#282828] text-[#B9B9B9] hover:text-[#FFFFFF] cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onRevokeInvitation(inv.token)}
                              title="Revoke invitation"
                              className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {inv.isRevoked && (
                          <span className="text-[10px] text-red-400 font-semibold uppercase">
                            Revoked
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
