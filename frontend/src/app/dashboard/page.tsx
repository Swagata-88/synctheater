'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/Navbar';
import { fetchMyRooms, createRoomInvitation, generateInviteUrl } from '../../lib/api';
import { copyToClipboard } from '../../lib/clipboard';
import { CreateRoomModal } from '../../components/dashboard/CreateRoomModal';
import { QuickJoinCard } from '../../components/dashboard/QuickJoinCard';
import { RoomCard, DashboardRoomItem } from '../../components/dashboard/RoomCard';
import { WatchHistorySection } from '../../components/dashboard/WatchHistorySection';
import { PlusCircle, Lock, Search, Tv, RotateCcw, Info, X } from 'lucide-react';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const [rooms, setRooms] = useState<DashboardRoomItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);
  const [roomNotification, setRoomNotification] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const notice = sessionStorage.getItem('room_closed_notification');
      if (notice) {
        setRoomNotification(notice);
        sessionStorage.removeItem('room_closed_notification');
      }
    }
  }, []);

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowCreateModal(true);
    }
  }, [searchParams]);

  const loadMyRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const data = await fetchMyRooms();
      setRooms(data.rooms || []);
    } catch (err) {
      console.error('Failed to load user rooms', err);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadMyRooms();
    } else if (!authLoading) {
      setIsLoadingRooms(false);
    }
  }, [user, authLoading]);

  const handleCopyRoomInvite = async (room: DashboardRoomItem) => {
    try {
      const res = await createRoomInvitation(room.slug);
      const url = res.invitation.inviteUrl || generateInviteUrl(room.slug, res.invitation.token);
      const copyRes = await copyToClipboard(url);
      if (copyRes.success) {
        setCopiedRoomId(room.id);
        setTimeout(() => setCopiedRoomId(null), 2500);
      } else {
        alert(`Invitation URL:\n${url}`);
      }
    } catch (err: any) {
      alert(`Could not generate invitation: ${err.message}`);
    }
  };

  const filteredRooms = rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Room Closure / Leave Notification Toast */}
      {roomNotification && (
        <div className="mb-6 p-4 rounded-xl bg-[#171717] border border-[#D6B56D]/40 text-[#FFFFFF] text-xs flex items-center justify-between shadow-lg animate-fade-in">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-[#D6B56D] shrink-0" />
            <span>{roomNotification}</span>
          </div>
          <button
            onClick={() => setRoomNotification(null)}
            className="p-1 rounded text-[#777777] hover:text-[#FFFFFF] transition-colors cursor-pointer"
            aria-label="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 pb-8 border-b border-[#353535]">
        <div>
          <div className="flex items-center gap-2 text-[#D6B56D] text-xs font-semibold uppercase tracking-wider mb-2">
            <Lock className="w-4 h-4 text-[#D6B56D]" />
            Private Synchronized Cinema
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#FFFFFF]">
            {user ? `Welcome back, ${user.username}` : 'Private Watch Theaters'}
          </h1>
          <p className="text-xs sm:text-sm text-[#B9B9B9] mt-1.5 max-w-2xl">
            Every theater is strictly private and invite-only. Create your room and share secure links to watch together.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              if (!user) {
                router.push('/login');
                return;
              }
              setShowCreateModal(true);
            }}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold btn-gold-primary transition-all hover:scale-[1.02] cursor-pointer"
          >
            <PlusCircle className="w-5 h-5" />
            Host Private Theater
          </button>
        </div>
      </div>

      {/* Quick Join Bar & Filter */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* Quick Join Card */}
        <QuickJoinCard />

        {/* Filter My Rooms */}
        <div className="lg:col-span-2 cinema-card p-6 flex flex-col justify-center">
          <div className="flex items-center gap-2.5 text-sm font-bold text-[#FFFFFF] mb-2">
            <Search className="w-4 h-4 text-[#D6B56D]" />
            Your Private Theaters
          </div>
          <p className="text-xs text-[#B9B9B9] mb-4">
            Quickly search watch rooms you host or participate in.
          </p>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#777777]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter your theaters by name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#111111] border border-[#353535] text-[#FFFFFF] placeholder-[#777777] text-sm focus:border-[#D6B56D] outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* User's Private Rooms Grid */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2 text-[#FFFFFF]">
          <Lock className="w-5 h-5 text-[#D6B56D]" />
          Your Watch Rooms
          <span className="text-xs bg-[#202020] text-[#D6B56D] border border-[#D6B56D]/30 px-2.5 py-0.5 rounded-full font-mono">
            {filteredRooms.length}
          </span>
        </h2>

        <button
          onClick={loadMyRooms}
          className="flex items-center gap-1.5 text-xs text-[#B9B9B9] hover:text-[#FFFFFF] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#D6B56D]" />
          Refresh
        </button>
      </div>

      {isLoadingRooms ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-2 border-[#D6B56D] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-[#B9B9B9]">Loading your private theaters...</p>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="cinema-card p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#202020] border border-[#353535] mx-auto flex items-center justify-center text-[#D6B56D] mb-4">
            <Tv className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#FFFFFF] mb-1">No Private Theaters Yet</h3>
          <p className="text-xs text-[#B9B9B9] max-w-sm mx-auto mb-6 leading-relaxed">
            All rooms on SYNCTHEATER are completely private. Launch a room and share the invitation link with your friends to start watching together.
          </p>
          <button
            onClick={() => {
              if (!user) {
                router.push('/login');
                return;
              }
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold btn-gold-primary transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Launch Private Theater
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              isCopied={copiedRoomId === room.id}
              onCopyInvite={handleCopyRoomInvite}
            />
          ))}
        </div>
      )}

      {/* PERSONAL WATCH HISTORY SECTION */}
      {user && <WatchHistorySection />}

      {/* CREATE ROOM MODAL */}
      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        user={user}
      />
    </main>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#090909] text-[#FFFFFF]">
      <Navbar />
      <Suspense fallback={<div className="p-8 text-center text-[#B9B9B9]">Loading dashboard...</div>}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
