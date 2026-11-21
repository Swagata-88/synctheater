'use client';

import React from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneCall,
  PhoneOff,
  Radio,
  AlertCircle,
  Loader2,
  Users,
  RefreshCw,
} from 'lucide-react';
import { ParticipantTile } from './ParticipantTile';
import { useLiveKitRoom } from '../../hooks/useLiveKitRoom';

interface VoiceVideoPanelProps {
  roomSlug: string;
  username: string;
}

export function VoiceVideoPanel({ roomSlug }: VoiceVideoPanelProps) {
  const {
    connectionStatus,
    isMuted,
    isVideoOn,
    isConfigured,
    errorMessage,
    setErrorMessage,
    activeSpeakerIds,
    remoteParticipants,
    localParticipant,
    handleJoinChannel,
    handleToggleMicrophone,
    handleToggleCamera,
    disconnectRoom,
  } = useLiveKitRoom({ roomSlug });

  const isConnected = connectionStatus === 'connected';
  const isReconnecting = connectionStatus === 'reconnecting';
  const isConnecting = connectionStatus === 'connecting';

  return (
    <div className="flex flex-col h-full bg-[#0d101a]/70 rounded-2xl border border-white/10 p-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
            Voice & Video Lounge
          </h4>
        </div>

        {/* Status Pills */}
        {isConnected && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Connected ({remoteParticipants.length + 1})
          </span>
        )}
        {isReconnecting && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
            Reconnecting...
          </span>
        )}
        {isConnecting && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
            Connecting...
          </span>
        )}
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="mb-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <p className="font-medium">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-semibold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Disconnected State / Welcome Card */}
      {!isConnected && !isReconnecting ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-600/10">
            <PhoneCall className="w-6 h-6" />
          </div>
          <div>
            <h5 className="text-sm font-semibold text-white">
              Live Theater Lounge
            </h5>
            <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
              Connect with fellow moviegoers in real-time. Share your camera and talk with ultra-low latency WebRTC.
            </p>
          </div>

          <button
            onClick={handleJoinChannel}
            disabled={isConnecting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <PhoneCall className="w-4 h-4" />
                Join Voice & Video
              </>
            )}
          </button>
        </div>
      ) : (
        /* Connected State */
        <div className="flex-1 flex flex-col justify-between space-y-3 min-h-0">
          {/* Active Participants Media Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            <div
              className={`grid gap-2.5 ${
                remoteParticipants.length === 0
                  ? 'grid-cols-1'
                  : remoteParticipants.length === 1
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-2'
              }`}
            >
              {/* Local Participant Tile */}
              {localParticipant && (
                <ParticipantTile
                  participant={localParticipant}
                  isLocal={true}
                  isSpeaking={activeSpeakerIds.has(localParticipant.identity)}
                />
              )}

              {/* Remote Participants Tiles */}
              {remoteParticipants.map((participant) => (
                <ParticipantTile
                  key={participant.identity}
                  participant={participant}
                  isLocal={false}
                  isSpeaking={activeSpeakerIds.has(participant.identity)}
                />
              ))}
            </div>

            {/* Waiting Notice if Solo */}
            {remoteParticipants.length === 0 && (
              <div className="mt-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                <Users className="w-5 h-5 mx-auto text-gray-500 mb-1" />
                <p className="text-xs text-gray-400">
                  You are the only one in the voice channel.
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Others in this watch party can join anytime!
                </p>
              </div>
            )}

            {/* LiveKit Configuration Hint */}
            {!isConfigured && (
              <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] leading-relaxed">
                ℹ️ <strong>LiveKit Cloud Note:</strong> Connected in local development mode. For cloud-hosted multi-region WebRTC, specify <code>LIVEKIT_URL</code> and <code>LIVEKIT_API_SECRET</code> in <code>.env</code>.
              </div>
            )}
          </div>

          {/* Audio / Video Controls Bar */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              {/* Mic Toggle Button */}
              <button
                onClick={handleToggleMicrophone}
                className={`p-2.5 rounded-xl text-xs font-medium transition-all ${
                  isMuted
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                }`}
                title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Camera Toggle Button */}
              <button
                onClick={handleToggleCamera}
                className={`p-2.5 rounded-xl text-xs font-medium transition-all ${
                  isVideoOn
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500'
                    : 'bg-white/10 hover:bg-white/15 text-gray-400 border border-white/10'
                }`}
                title={isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
            </div>

            {/* Leave Voice Channel Button */}
            <button
              onClick={disconnectRoom}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-600/80 hover:bg-rose-600 text-white transition-colors cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              Leave Voice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
