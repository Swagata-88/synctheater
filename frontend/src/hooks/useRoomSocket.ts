'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '../lib/socket';
import { apiRequest } from '../lib/api';
import { Participant } from '../components/theater/ParticipantPanel';
import { ChatMsg } from '../components/chat/ChatPanel';
import { VideoProviderType } from '../types';

export interface PlaybackState {
  provider: VideoProviderType;
  videoId: string;
  videoUrl: string;
  status: 'PLAYING' | 'PAUSED' | 'BUFFERING';
  currentPosition: number;
  playbackRate: number;
  lastServerTimestamp: number;
  sequenceNumber: number;
  isEmergencyPaused: boolean;
  emergencyPausedBy?: { userId: string; username: string } | null;
}

interface UseRoomSocketOptions {
  slug: string;
  inviteToken?: string;
  user: any;
}

export function useRoomSocket({ slug, inviteToken, user }: UseRoomSocketOptions) {
  const router = useRouter();
  const socket = getSocket();

  const [room, setRoom] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);

  // Access Control & Error State
  const [accessDenied, setAccessDenied] = useState<{
    status: boolean;
    title?: string;
    message?: string;
  }>({ status: false });

  // Playback State
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    provider: 'YOUTUBE',
    videoId: 'dQw4w9WgXcQ',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    status: 'PAUSED',
    currentPosition: 0,
    playbackRate: 1.0,
    lastServerTimestamp: Date.now(),
    sequenceNumber: 1,
    isEmergencyPaused: false,
    emergencyPausedBy: null,
  });

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Private room password state
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !user) return;

    if (!socket.connected) {
      socket.connect();
    }

    // Emit initial join event with inviteToken
    socket.emit('JOIN_ROOM', { roomSlug: slug, inviteToken });

    // Handle automatic low-level transport reconnection
    const handleReconnect = () => {
      socket.emit('RECONNECT_ROOM', { roomSlug: slug, inviteToken });
    };
    socket.on('connect', handleReconnect);

    socket.on('INITIAL_ROOM_STATE', (data) => {
      setAccessDenied({ status: false });
      setRoom(data.room);
      setPlaybackState(data.playbackState);
      setCurrentTime(data.playbackState.currentPosition);
      setParticipants(data.participants || []);
      setMessages(data.messages || []);

      // Clean visible URL: remove the invitation token from address bar
      if (typeof window !== 'undefined' && window.location.search.includes('invite=')) {
        window.history.replaceState({}, '', `/room/${slug}`);
      }
    });

    socket.on('SYNC_STATE', (newState) => {
      setPlaybackState((prev) => {
        // Monotonic sequence verification: ignore older state packets
        if (newState.sequenceNumber < prev.sequenceNumber) {
          return prev;
        }
        return newState;
      });
    });

    socket.on('EMERGENCY_PAUSE_TRIGGERED', (data) => {
      setPlaybackState(data.playbackState);
    });

    socket.on('NEW_CHAT_MESSAGE', (msg: ChatMsg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('NEW_REACTION', (data: { id: string; emoji: string }) => {
      const xPos = Math.random() * 80 + 10;
      setReactions((prev) => [...prev, { id: data.id, emoji: data.emoji, x: xPos }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== data.id));
      }, 3000);
    });

    socket.on('USER_JOINED', (data) => {
      if (data.participants) setParticipants(data.participants);
      if (data.systemMessage) setMessages((prev) => [...prev, data.systemMessage]);
    });

    socket.on('USER_LEFT', (data: { userId: string; username: string; participants?: Participant[] }) => {
      if (data.participants) {
        setParticipants(data.participants);
      } else {
        setParticipants((prev) => prev.filter((p) => p.userId !== data.userId));
      }
    });

    socket.on('KICKED_FROM_ROOM', (data: { roomSlug: string; reason: string }) => {
      alert(data.reason || 'You have been removed from this theater room.');
      router.push('/dashboard');
    });

    socket.on('ERROR', (err: any) => {
      console.warn('[Socket Room Error]', err);
      if (err.code === 'INVITE_REQUIRED' || err.message?.includes('invitation')) {
        setAccessDenied({
          status: true,
          title: 'Private Theater — Invitation Required',
          message: err.message || 'This watch party is private. A valid invitation link is required to enter.',
        });
      } else if (err.code === 'ROOM_FULL' || err.message?.includes('capacity')) {
        setAccessDenied({
          status: true,
          title: 'Theater Room Full',
          message: err.message || 'This room has reached its maximum viewer capacity.',
        });
      } else if (err.code === 'UNAUTHENTICATED') {
        const returnUrl = `/room/${slug}${inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : ''}`;
        router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
      } else if (err.message && err.message.includes('password')) {
        setNeedsPassword(true);
      }
    });

    return () => {
      socket.emit('LEAVE_ROOM');
      socket.off('connect', handleReconnect);
      socket.off('INITIAL_ROOM_STATE');
      socket.off('SYNC_STATE');
      socket.off('EMERGENCY_PAUSE_TRIGGERED');
      socket.off('NEW_CHAT_MESSAGE');
      socket.off('NEW_REACTION');
      socket.off('USER_JOINED');
      socket.off('USER_LEFT');
      socket.off('KICKED_FROM_ROOM');
      socket.off('ERROR');
    };
  }, [slug, user, inviteToken, router, socket]);

  // Sync actions
  const handlePlay = useCallback(() => {
    socket.emit('PLAY', { reportedPosition: currentTime });
  }, [socket, currentTime]);

  const handlePause = useCallback(() => {
    socket.emit('PAUSE', { reportedPosition: currentTime });
  }, [socket, currentTime]);

  const handleSeek = useCallback((targetTime: number) => {
    setCurrentTime(targetTime);
    socket.emit('SEEK', { targetPosition: targetTime });
  }, [socket]);

  const handleEmergencyPause = useCallback(() => {
    socket.emit('EMERGENCY_PAUSE');
  }, [socket]);

  const handleResumeFromEmergency = useCallback(() => {
    socket.emit('RESUME_FROM_EMERGENCY');
  }, [socket]);

  const handleChangeRate = useCallback((rate: number) => {
    socket.emit('CHANGE_PLAYBACK_RATE', { rate });
  }, [socket]);

  const handleSendMessage = useCallback((content: string) => {
    socket.emit('SEND_CHAT_MESSAGE', { content });
  }, [socket]);

  const handleSendReaction = useCallback((emoji: string) => {
    socket.emit('SEND_REACTION', { emoji });
  }, [socket]);

  const handleChangeVideo = useCallback((newVideoUrl: string) => {
    socket.emit('CHANGE_VIDEO', { videoUrl: newVideoUrl });
  }, [socket]);

  const handlePasswordSubmit = useCallback(async (password: string) => {
    setPasswordError(null);
    try {
      await apiRequest(`/api/rooms/${slug}/join`, {
        method: 'POST',
        body: JSON.stringify({ inviteToken, password }),
      });
      setNeedsPassword(false);
      socket.emit('JOIN_ROOM', { roomSlug: slug, inviteToken, password });
    } catch (err: any) {
      setPasswordError(err.message || 'Incorrect room password.');
    }
  }, [slug, inviteToken, socket]);

  const handleKickParticipant = useCallback(async (targetUserId: string) => {
    try {
      await apiRequest(`/api/rooms/${slug}/kick`, {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      });
      setParticipants((prev) => prev.filter((p) => p.userId !== targetUserId));
    } catch (e: any) {
      alert(e.message || 'Failed to kick participant.');
    }
  }, [slug]);

  const handleTransferOwnership = useCallback(async (newOwnerId: string) => {
    try {
      await apiRequest(`/api/rooms/${slug}/transfer-owner`, {
        method: 'POST',
        body: JSON.stringify({ newOwnerId }),
      });
      window.location.reload();
    } catch (e: any) {
      alert(e.message || 'Failed to transfer ownership.');
    }
  }, [slug]);

  return {
    room,
    participants,
    messages,
    reactions,
    accessDenied,
    playbackState,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    needsPassword,
    passwordError,
    handlePlay,
    handlePause,
    handleSeek,
    handleEmergencyPause,
    handleResumeFromEmergency,
    handleChangeRate,
    handleSendMessage,
    handleSendReaction,
    handleChangeVideo,
    handlePasswordSubmit,
    handleKickParticipant,
    handleTransferOwnership,
  };
}
