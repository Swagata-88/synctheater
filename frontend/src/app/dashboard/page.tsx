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
import { PlusCircle, Lock, Search, Tv } from 'lucide-react';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const [rooms, setRooms] = useState<DashboardRoomItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);

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
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 pb-8 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Lock className="w-4 h-4 text-amber-400" />
            Private Synchronized Cinema
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {user ? `Welcome back, ${user.username}!` : 'Private Watch Theaters'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
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
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] cursor-pointer"
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
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-center">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-white mb-2">
            <Search className="w-4 h-4 text-indigo-400" />
            Your Private Theaters
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Quickly find watch rooms you host or participate in.
          </p>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter your theaters by name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:border-indigo-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* User's Private Rooms Grid */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Lock className="w-5 h-5 text-amber-400" />
          Your Watch Rooms
          <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full font-mono">
            {filteredRooms.length}
          </span>
        </h2>

        <button
          onClick={loadMyRooms}
          className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {isLoadingRooms ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-400">Loading your private theaters...</p>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-white/10">
          <div className="w-12 h-12 rounded-xl bg-white/5 mx-auto flex items-center justify-center text-gray-400 mb-4">
            <Tv className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">No Private Theaters Yet</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto mb-6">
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer"
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
    <div className="min-h-screen flex flex-col bg-[#07090e] text-white">
      <Navbar />
      <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading dashboard...</div>}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
