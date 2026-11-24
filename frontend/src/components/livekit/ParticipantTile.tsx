'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RoomEvent,
  Participant,
} from 'livekit-client';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
} from 'lucide-react';

interface ParticipantTileProps {
  participant: Participant;
  isLocal?: boolean;
  isSpeaking?: boolean;
}

export function ParticipantTile({
  participant,
  isLocal = false,
  isSpeaking = false,
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Sync track state from publications
  const updateTracks = useCallback(() => {
    // Check video tracks
    const videoPubs = Array.from(participant.videoTrackPublications.values());
    const activeVideoPub = videoPubs.find((pub) => pub.track && !pub.isMuted);

    if (activeVideoPub && activeVideoPub.track) {
      setHasVideo(true);
      if (videoRef.current) {
        activeVideoPub.track.attach(videoRef.current);
      }
    } else {
      setHasVideo(false);
      if (videoRef.current) {
        videoPubs.forEach((pub) => pub.track?.detach(videoRef.current!));
      }
    }

    // Check audio tracks
    const audioPubs = Array.from(participant.audioTrackPublications.values());
    const activeAudioPub = audioPubs.find((pub) => pub.track && !pub.isMuted);

    setIsMuted(!activeAudioPub || activeAudioPub.isMuted);

    if (!isLocal && activeAudioPub && activeAudioPub.track) {
      setHasAudio(true);
      if (audioRef.current) {
        activeAudioPub.track.attach(audioRef.current);
      }
    } else if (!isLocal) {
      setHasAudio(false);
      if (audioRef.current) {
        audioPubs.forEach((pub) => pub.track?.detach(audioRef.current!));
      }
    }
  }, [participant, isLocal]);

  useEffect(() => {
    updateTracks();

    const handleTrackSubscribed = () => updateTracks();
    const handleTrackUnsubscribed = () => updateTracks();
    const handleTrackMuted = () => updateTracks();
    const handleTrackUnmuted = () => updateTracks();

    participant.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    participant.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    participant.on(RoomEvent.TrackMuted, handleTrackMuted);
    participant.on(RoomEvent.TrackUnmuted, handleTrackUnmuted);

    return () => {
      participant.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      participant.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      participant.off(RoomEvent.TrackMuted, handleTrackMuted);
      participant.off(RoomEvent.TrackUnmuted, handleTrackUnmuted);

      // Clean up track attachments
      if (videoRef.current) {
        participant.videoTrackPublications.forEach((pub) => {
          pub.track?.detach(videoRef.current!);
        });
      }
      if (audioRef.current) {
        participant.audioTrackPublications.forEach((pub) => {
          pub.track?.detach(audioRef.current!);
        });
      }
    };
  }, [participant, updateTracks]);

  const displayName = participant.name || participant.identity || 'Participant';
  const initial = displayName[0]?.toUpperCase() || 'U';

  return (
    <div
      className={`relative group rounded-xl overflow-hidden bg-[#000000] border transition-all duration-200 aspect-video flex items-center justify-center ${
        isSpeaking
          ? 'border-[#D6B56D] ring-2 ring-[#D6B56D]/50 shadow-[0_0_15px_rgba(214,181,109,0.3)]'
          : 'border-[#353535] hover:border-[#D6B56D]/40'
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''} ${
          hasVideo ? 'block' : 'hidden'
        }`}
      />

      {/* Audio Element for Remote Participants */}
      {!isLocal && <audio ref={audioRef} autoPlay />}

      {/* Fallback Avatar when camera is off */}
      {!hasVideo && (
        <div className="flex flex-col items-center justify-center p-3 select-none">
          <div className="w-12 h-12 rounded-full bg-gradient-to-b from-[#F0D89F] via-[#D6B56D] to-[#94743D] text-[#090909] flex items-center justify-center font-extrabold text-lg shadow-inner">
            {initial}
          </div>
          <span className="text-[11px] text-[#B9B9B9] font-medium mt-2 truncate max-w-[120px]">
            {displayName} {isLocal && '(You)'}
          </span>
        </div>
      )}

      {/* Overlay Badges */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
        {/* Name Tag */}
        <span className="bg-[#171717]/85 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-medium text-[#FFFFFF] truncate max-w-[100px] border border-[#353535]">
          {displayName} {isLocal && '(You)'}
        </span>

        {/* Media Indicators */}
        <div className="flex items-center gap-1">
          {/* Audio Indicator */}
          {isMuted ? (
            <span
              className="p-1 rounded bg-[#171717]/90 text-red-400 border border-red-700/50"
              title="Microphone Muted"
            >
              <MicOff className="w-3 h-3" />
            </span>
          ) : (
            <span
              className="p-1 rounded bg-[#171717]/90 text-emerald-400 border border-emerald-600/40"
              title="Microphone Active"
            >
              <Mic className="w-3 h-3" />
            </span>
          )}

          {/* Video Indicator */}
          {hasVideo ? (
            <span
              className="p-1 rounded bg-[#202020] text-[#D6B56D] border border-[#D6B56D]/40"
              title="Camera Active"
            >
              <Video className="w-3 h-3" />
            </span>
          ) : (
            <span
              className="p-1 rounded bg-[#202020] text-[#777777] border border-[#353535]"
              title="Camera Off"
            >
              <VideoOff className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
