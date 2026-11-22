'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { Navbar } from '../../../components/Navbar';
import { VideoPlayer } from '../../../components/theater/VideoPlayer';
import { EmergencyPauseBanner } from '../../../components/theater/EmergencyPauseBanner';
import { PlaybackControls } from '../../../components/theater/PlaybackControls';
import { ChatPanel } from '../../../components/chat/ChatPanel';
import { ParticipantPanel } from '../../../components/theater/ParticipantPanel';
import { VoiceVideoPanel } from '../../../components/livekit/VoiceVideoPanel';
import { RoomAccessDenied } from '../../../components/theater/RoomAccessDenied';
import { RoomInviteModal } from '../../../components/theater/RoomInviteModal';
import { ChangeVideoModal } from '../../../components/theater/ChangeVideoModal';
import { RoomPasswordModal } from '../../../components/theater/RoomPasswordModal';
import { useRoomSocket } from '../../../hooks/useRoomSocket';
import { useRoomInvitations } from '../../../hooks/useRoomInvitations';
import { generateInviteUrl } from '../../../lib/api';
import { MessageSquare, Users, Radio, Share2, Lock } from 'lucide-react';

function TheaterRoomContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const inviteToken = searchParams.get('invite') || '';
  const { user, preferences, updatePreferences, isLoading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'chat' | 'participants' | 'voice'>('chat');
  const [showChangeVideoModal, setShowChangeVideoModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [theaterTheme, setTheaterTheme] = useState<'classic' | 'cozy' | 'gaming' | 'minimal'>(
    (preferences?.theaterSetting as any) || 'classic'
  );

  // Unauthenticated recipient redirect preserving returnUrl
  useEffect(() => {
    if (!authLoading && !user) {
      const returnUrl = `/room/${slug}${inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : ''}`;
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  }, [user, authLoading, slug, inviteToken, router]);

  // Socket & Sync state
  const {
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
    emergencyFeedback,
    emergencyError,
    clearEmergencyError,
  } = useRoomSocket({ slug, inviteToken, user });

  // Role calculation
  const currentParticipant = participants.find((p) => p.userId === user?.id);
  const isOwner = room?.ownerId === user?.id || currentParticipant?.role === 'OWNER';
  const isOwnerOrMod = isOwner || currentParticipant?.role === 'MODERATOR';

  // Invitations management
  const {
    activeInviteUrl,
    invitationsList,
    inviteCopiedToast,
    handleCopyInviteUrl,
    handleCreateNewInvitation,
    handleRevokeInvitation,
  } = useRoomInvitations({
    slug,
    inviteToken,
    isOwnerOrMod,
    roomId: room?.id,
  });

  const handleChangeTheme = (theme: 'classic' | 'cozy' | 'gaming' | 'minimal') => {
    setTheaterTheme(theme);
    updatePreferences({ theaterSetting: theme });
  };

  // Access Denied Screen (Private Room / Token Required / Room Full)
  if (accessDenied.status) {
    return (
      <RoomAccessDenied
        slug={slug}
        title={accessDenied.title}
        message={accessDenied.message}
      />
    );
  }

  return (
    <div className={`min-h-screen flex flex-col theater-${theaterTheme} text-white transition-colors duration-500`}>
      <Navbar />

      {/* Floating Emoji Reactions Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            style={{ left: `${r.x}%` }}
            className="absolute bottom-16 text-3xl animate-bounce"
          >
            {r.emoji}
          </div>
        ))}
      </div>

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-4 lg:px-6 py-4 flex flex-col gap-4">
        {/* Emergency Pause Feedback / Error Toast */}
        {emergencyError && (
          <div className="w-full p-3 rounded-xl bg-red-900/80 border border-red-500/50 text-red-200 text-xs flex items-center justify-between shadow-lg">
            <span>{emergencyError}</span>
            <button
              onClick={clearEmergencyError}
              className="text-white hover:text-red-300 font-bold px-2 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
        {emergencyFeedback && (
          <div className="w-full p-3 rounded-xl bg-emerald-900/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between shadow-lg animate-pulse">
            <span>{emergencyFeedback}</span>
          </div>
        )}

        {/* Emergency Pause Notification */}
        <EmergencyPauseBanner
          isEmergencyPaused={playbackState.isEmergencyPaused}
          emergencyPausedBy={playbackState.emergencyPausedBy}
          isOwnerOrMod={isOwnerOrMod}
          onResume={handleResumeFromEmergency}
        />

        {/* Theater Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          {/* Left Column: Player & Controls (8 cols on lg) */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            {/* Room Info Header */}
            <div className="flex items-center justify-between px-2">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate flex items-center gap-2">
                  <span>{room?.name || 'Synchronized Cinema'}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                    PRIVATE
                  </span>
                </h1>
                <p className="text-xs text-gray-400 truncate">
                  {room?.description || 'Watching together in synchronized private harmony.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 transition-all cursor-pointer"
                  title="Invite guests or manage invitations"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Invite Guests</span>
                </button>

                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <Radio className="w-3 h-3 animate-pulse" />
                  {playbackState.status}
                </span>
              </div>
            </div>

            {/* Video Player */}
            <VideoPlayer
              provider={playbackState.provider}
              videoId={playbackState.videoId}
              videoUrl={playbackState.videoUrl}
              status={playbackState.status}
              currentPosition={playbackState.currentPosition}
              playbackRate={playbackState.playbackRate}
              lastServerTimestamp={playbackState.lastServerTimestamp}
              isOwnerOrMod={isOwnerOrMod}
              isEmergencyPaused={playbackState.isEmergencyPaused}
              onTimeUpdate={(c, d) => {
                setCurrentTime(c);
                if (d) setDuration(d);
              }}
              onPlayAction={handlePlay}
              onPauseAction={handlePause}
              onSeekAction={handleSeek}
            />

            {/* Bottom Playback Controls */}
            <PlaybackControls
              status={playbackState.status}
              currentTime={currentTime}
              duration={duration}
              playbackRate={playbackState.playbackRate}
              isOwnerOrMod={isOwnerOrMod}
              theaterSetting={theaterTheme}
              inviteUrl={activeInviteUrl || (inviteToken ? generateInviteUrl(slug, inviteToken) : undefined)}
              onPlay={handlePlay}
              onPause={handlePause}
              onSeek={handleSeek}
              onEmergencyPause={handleEmergencyPause}
              onChangeVideoClick={() => setShowChangeVideoModal(true)}
              onChangeRate={handleChangeRate}
              onChangeTheme={handleChangeTheme}
            />
          </div>

          {/* Right Column: Social / Chat / LiveKit Panel (4 cols on lg) */}
          <div className="lg:col-span-4 flex flex-col h-[650px] lg:h-[calc(100vh-140px)] min-h-[500px]">
            {/* Panel Tabs Navigation */}
            <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/10 mb-3">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'chat'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Live Chat
              </button>

              <button
                onClick={() => setActiveTab('participants')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'participants'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Viewers ({participants.length})
              </button>

              <button
                onClick={() => setActiveTab('voice')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'voice'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                Voice & Cam
              </button>
            </div>

            {/* Active Panel View */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'chat' && (
                <ChatPanel
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onSendReaction={handleSendReaction}
                />
              )}

              {activeTab === 'participants' && (
                <ParticipantPanel
                  participants={participants}
                  currentUserId={user?.id}
                  isOwner={isOwner}
                  onKickParticipant={handleKickParticipant}
                  onTransferOwnership={handleTransferOwnership}
                />
              )}

              {activeTab === 'voice' && (
                <VoiceVideoPanel
                  roomSlug={slug}
                  username={user?.username || 'Guest'}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* INVITATION & SHARING MODAL */}
      <RoomInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        slug={slug}
        inviteToken={inviteToken}
        activeInviteUrl={activeInviteUrl}
        invitationsList={invitationsList}
        isOwnerOrMod={isOwnerOrMod}
        copiedToast={inviteCopiedToast}
        onCopyInviteUrl={handleCopyInviteUrl}
        onCreateInvitation={handleCreateNewInvitation}
        onRevokeInvitation={handleRevokeInvitation}
      />

      {/* CHANGE VIDEO MODAL */}
      <ChangeVideoModal
        isOpen={showChangeVideoModal}
        onClose={() => setShowChangeVideoModal(false)}
        onSubmitVideo={handleChangeVideo}
      />

      {/* PASSWORD REQUIRED MODAL */}
      <RoomPasswordModal
        isOpen={needsPassword}
        onSubmitPassword={handlePasswordSubmit}
        error={passwordError}
      />
    </div>
  );
}

export default function TheaterRoomPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07090e] text-white flex items-center justify-center text-sm text-gray-400">Loading Theater Room...</div>}>
      <TheaterRoomContent />
    </Suspense>
  );
}
