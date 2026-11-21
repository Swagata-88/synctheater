'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  generateInviteUrl,
  createRoomInvitation,
  listRoomInvitations,
  revokeRoomInvitation,
} from '../lib/api';
import { copyToClipboard } from '../lib/clipboard';

interface UseRoomInvitationsOptions {
  slug: string;
  inviteToken?: string;
  isOwnerOrMod: boolean;
  roomId?: string;
}

export function useRoomInvitations({
  slug,
  inviteToken,
  isOwnerOrMod,
  roomId,
}: UseRoomInvitationsOptions) {
  const [activeInviteUrl, setActiveInviteUrl] = useState<string>('');
  const [invitationsList, setInvitationsList] = useState<any[]>([]);
  const [inviteCopiedToast, setInviteCopiedToast] = useState(false);

  useEffect(() => {
    if (inviteToken) {
      setActiveInviteUrl(generateInviteUrl(slug, inviteToken));
    }
  }, [slug, inviteToken]);

  const loadInvitations = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await listRoomInvitations(slug);
      setInvitationsList(res.invitations || []);
      const active = res.invitations?.find((inv) => !inv.isRevoked);
      if (active) {
        setActiveInviteUrl(active.inviteUrl || generateInviteUrl(slug, active.token));
      } else if (isOwnerOrMod) {
        const newInv = await createRoomInvitation(slug);
        setActiveInviteUrl(
          newInv.invitation.inviteUrl || generateInviteUrl(slug, newInv.invitation.token)
        );
        setInvitationsList([newInv.invitation]);
      }
    } catch (err) {
      console.warn('Could not load invitations:', err);
    }
  }, [slug, isOwnerOrMod]);

  useEffect(() => {
    if (roomId && isOwnerOrMod) {
      loadInvitations();
    }
  }, [roomId, isOwnerOrMod, loadInvitations]);

  const handleCopyInviteUrl = async (urlToCopy?: string) => {
    const target =
      urlToCopy ||
      activeInviteUrl ||
      (inviteToken ? generateInviteUrl(slug, inviteToken) : '');
    if (!target) return;

    const res = await copyToClipboard(target);
    if (res.success) {
      setInviteCopiedToast(true);
      setTimeout(() => setInviteCopiedToast(false), 2500);
    } else {
      prompt('Copy invitation URL below:', target);
    }
  };

  const handleCreateNewInvitation = async (options: {
    maxUses?: number;
    expiresInHours?: number;
  }) => {
    try {
      const res = await createRoomInvitation(slug, options);
      const url = res.invitation.inviteUrl || generateInviteUrl(slug, res.invitation.token);
      setActiveInviteUrl(url);
      setInvitationsList((prev) => [res.invitation, ...prev]);
    } catch (err: any) {
      alert(err.message || 'Failed to create invitation.');
    }
  };

  const handleRevokeInvitation = async (token: string) => {
    if (
      !confirm(
        'Are you sure you want to revoke this invitation link? Any recipient using it will be blocked.'
      )
    ) {
      return;
    }
    try {
      await revokeRoomInvitation(slug, token);
      setInvitationsList((prev) =>
        prev.map((inv) => (inv.token === token ? { ...inv, isRevoked: true } : inv))
      );
      if (activeInviteUrl.includes(token)) {
        setActiveInviteUrl('');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to revoke invitation.');
    }
  };

  return {
    activeInviteUrl,
    invitationsList,
    inviteCopiedToast,
    loadInvitations,
    handleCopyInviteUrl,
    handleCreateNewInvitation,
    handleRevokeInvitation,
  };
}
