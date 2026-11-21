'use client';

import React, { useState } from 'react';
import { Share2, Plus, Copy, Trash2, Check } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-white/15 p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Share2 className="w-4 h-4 text-indigo-400" />
            Invite Guests to Private Theater
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Primary Share Link Card */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/10 mb-5">
          <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
            Direct Invitation Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={currentDisplayUrl}
              className="flex-1 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-mono outline-none select-all"
            />
            <button
              onClick={() => onCopyInviteUrl()}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                copiedToast
                  ? 'bg-emerald-500 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow'
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
          <p className="text-[11px] text-gray-400 mt-2">
            Recipients opening this link from any device or network will be admitted to this private room.
          </p>
        </div>

        {/* Management for Host / Mod */}
        {isOwnerOrMod && (
          <div className="space-y-4">
            <div className="pt-2 border-t border-white/10">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
                Generate Custom Invitation
              </h4>
              <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Max Uses (Optional)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={newInviteMaxUses}
                    onChange={(e) => setNewInviteMaxUses(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Expires In (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="72"
                    value={newInviteExpiresHours}
                    onChange={(e) => setNewInviteExpiresHours(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isGenerating ? 'Generating...' : 'Create New Link'}
                  </button>
                </div>
              </form>
            </div>

            {/* Existing Invitations List */}
            {invitationsList.length > 0 && (
              <div className="pt-2 border-t border-white/10">
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  Active Invitations ({invitationsList.filter((i) => !i.isRevoked).length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {invitationsList.map((inv) => (
                    <div
                      key={inv.id || inv.token}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        inv.isRevoked
                          ? 'bg-rose-500/5 border-rose-500/20 text-gray-400 opacity-60'
                          : 'bg-black/30 border-white/10 text-white'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-mono text-[11px] truncate">
                          token: {inv.token.substring(0, 10)}...
                        </p>
                        <p className="text-[10px] text-gray-400">
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
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onRevokeInvitation(inv.token)}
                              title="Revoke invitation"
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {inv.isRevoked && (
                          <span className="text-[10px] text-rose-400 font-semibold uppercase">
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
