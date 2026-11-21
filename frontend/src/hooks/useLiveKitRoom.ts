'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  Participant,
} from 'livekit-client';
import { apiRequest } from '../lib/api';

interface UseLiveKitRoomOptions {
  roomSlug: string;
}

export function useLiveKitRoom({ roomSlug }: UseLiveKitRoomOptions) {
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  >('disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<Set<string>>(new Set());
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [, setTrackUpdateTick] = useState(0);

  const roomRef = useRef<Room | null>(null);
  const isConnectingRef = useRef(false);

  // Force a component re-render when remote track states toggle
  const triggerTrackUpdate = useCallback(() => {
    setTrackUpdateTick((t) => t + 1);
  }, []);

  // Clean up and disconnect
  const disconnectRoom = useCallback(() => {
    if (roomRef.current) {
      try {
        roomRef.current.localParticipant.getTrackPublications().forEach((publication) => {
          if (publication.track) {
            publication.track.stop();
          }
        });
        roomRef.current.removeAllListeners();
        roomRef.current.disconnect();
      } catch (err) {
        console.warn('Error during LiveKit room disconnect:', err);
      }
      roomRef.current = null;
    }
    setConnectionStatus('disconnected');
    setIsVideoOn(false);
    setIsMuted(false);
    setActiveSpeakerIds(new Set());
    setRemoteParticipants([]);
    isConnectingRef.current = false;
  }, []);

  // Handle joining the LiveKit WebRTC channel
  const handleJoinChannel = async () => {
    if (isConnectingRef.current || roomRef.current) return;

    isConnectingRef.current = true;
    setConnectionStatus('connecting');
    setErrorMessage(null);

    try {
      // 1. Request room token from backend with authorization check
      const data = await apiRequest(
        `/api/livekit/token?room=${encodeURIComponent(roomSlug)}`
      );

      if (!data.token) {
        throw new Error('Server did not return a valid LiveKit token.');
      }

      setIsConfigured(data.isConfigured !== false);

      // 2. Instantiate LiveKit Room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      // 3. Attach Room Event Handlers
      room.on(RoomEvent.Connected, () => {
        setConnectionStatus('connected');
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });

      room.on(RoomEvent.Reconnecting, () => {
        setConnectionStatus('reconnecting');
      });

      room.on(RoomEvent.Reconnected, () => {
        setConnectionStatus('connected');
      });

      room.on(RoomEvent.Disconnected, () => {
        disconnectRoom();
      });

      room.on(RoomEvent.ParticipantConnected, () => {
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      });

      room.on(RoomEvent.TrackSubscribed, () => {
        triggerTrackUpdate();
      });

      room.on(RoomEvent.TrackUnsubscribed, () => {
        triggerTrackUpdate();
      });

      room.on(RoomEvent.TrackMuted, () => {
        triggerTrackUpdate();
      });

      room.on(RoomEvent.TrackUnmuted, () => {
        triggerTrackUpdate();
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        setActiveSpeakerIds(new Set(speakers.map((s) => s.identity)));
      });

      // 4. Connect to WebRTC server
      const livekitUrl = data.serverUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL;
      if (!livekitUrl) {
        throw new Error('LiveKit WebRTC server URL is not configured. Voice/video is unavailable.');
      }
      await room.connect(livekitUrl, data.token);

      // 5. Try enabling microphone by default upon joining
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMuted(false);
      } catch (micErr: any) {
        console.warn('Could not auto-enable microphone:', micErr.message);
        setIsMuted(true);
      }

      setConnectionStatus('connected');
    } catch (err: any) {
      console.error('Failed to connect to LiveKit channel:', err);
      disconnectRoom();
      setErrorMessage(
        err.message || 'Failed to connect to the voice & video room.'
      );
    } finally {
      isConnectingRef.current = false;
    }
  };

  // Toggle Microphone
  const handleToggleMicrophone = async () => {
    const room = roomRef.current;
    if (!room || connectionStatus !== 'connected') return;

    try {
      const willEnable = isMuted; // If currently muted, we want to enable
      await room.localParticipant.setMicrophoneEnabled(willEnable);
      setIsMuted(!willEnable);
      setErrorMessage(null);
    } catch (err: any) {
      console.error('Microphone toggle error:', err);
      let msg = 'Failed to toggle microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Microphone permission denied. Please allow microphone access in your browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No microphone device found on this system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Microphone is currently in use by another application.';
      }
      setErrorMessage(msg);
    }
  };

  // Toggle Camera
  const handleToggleCamera = async () => {
    const room = roomRef.current;
    if (!room || connectionStatus !== 'connected') return;

    try {
      const willEnable = !isVideoOn;
      await room.localParticipant.setCameraEnabled(willEnable);
      setIsVideoOn(willEnable);
      triggerTrackUpdate();
      setErrorMessage(null);
    } catch (err: any) {
      console.error('Camera toggle error:', err);
      let msg = 'Failed to toggle camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please allow camera access in your browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera device found on this system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera is currently in use by another application.';
      }
      setErrorMessage(msg);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectRoom();
    };
  }, [disconnectRoom]);

  return {
    connectionStatus,
    isMuted,
    isVideoOn,
    isConfigured,
    errorMessage,
    setErrorMessage,
    activeSpeakerIds,
    remoteParticipants,
    localParticipant: roomRef.current?.localParticipant,
    handleJoinChannel,
    handleToggleMicrophone,
    handleToggleCamera,
    disconnectRoom,
  };
}
