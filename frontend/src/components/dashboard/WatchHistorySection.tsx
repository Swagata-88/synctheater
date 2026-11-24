'use client';

import React, { useState, useEffect } from 'react';
import { fetchMyWatchHistory, WatchHistoryItem } from '../../lib/api';
import { SessionDetailsModal } from './SessionDetailsModal';
import {
  History,
  Crown,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  Film,
  RotateCcw,
  User,
  Shield,
  Eye,
} from 'lucide-react';

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function formatDate(isoString: string | null): string {
  if (!isoString) return 'N/A';
  const d = new Date(isoString);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function WatchHistorySection() {
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const loadHistory = async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchMyWatchHistory(page, 10);
      setHistory(res.history || []);
      setPagination(res.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err: any) {
      setError(err.message || 'Failed to load personal watch history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(1);
  }, []);

  return (
    <div className="mt-12 pt-8 border-t border-[#353535]">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2 text-[#FFFFFF]">
            <History className="w-5 h-5 text-[#D6B56D]" />
            Your Watch History
            <span className="text-xs bg-[#202020] text-[#D6B56D] border border-[#D6B56D]/30 px-2.5 py-0.5 rounded-full font-mono">
              {pagination.total}
            </span>
          </h2>
          <p className="text-xs text-[#B9B9B9] mt-1">
            Permanent record of every private room session you hosted or attended.
          </p>
        </div>

        <button
          onClick={() => loadHistory(pagination.page)}
          className="flex items-center gap-1.5 text-xs text-[#B9B9B9] hover:text-[#FFFFFF] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#D6B56D]" />
          Refresh History
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="cinema-card p-12 text-center border border-[#353535]">
          <div className="inline-block w-8 h-8 border-2 border-[#D6B56D] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-[#B9B9B9]">Loading your personal watch history...</p>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="cinema-card p-8 text-center border border-red-500/40 bg-red-950/20">
          <p className="text-xs text-red-200 mb-3">{error}</p>
          <button
            onClick={() => loadHistory(1)}
            className="px-4 py-2 rounded-xl text-xs font-bold btn-gold-primary cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && history.length === 0 && (
        <div className="cinema-card p-12 text-center border border-[#353535]">
          <div className="w-12 h-12 rounded-xl bg-[#202020] border border-[#353535] mx-auto flex items-center justify-center text-[#D6B56D] mb-4">
            <Film className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#FFFFFF] mb-1">No Watch History Yet</h3>
          <p className="text-xs text-[#B9B9B9] max-w-sm mx-auto leading-relaxed">
            Whenever you host or join a private watch room, your participation and watch durations will be recorded here permanently.
          </p>
        </div>
      )}

      {/* History Cards / Table */}
      {!isLoading && !error && history.length > 0 && (
        <div className="space-y-3">
          {history.map((item) => {
            const isCreator = item.userRole === 'ORIGINAL_HOST';
            const isSuccessor = item.userRole === 'SUCCESSOR_HOST';

            return (
              <div
                key={item.id}
                className="cinema-card p-4 sm:p-5 border border-[#353535] hover:border-[#D6B56D]/50 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                {/* Left: Room Title, Host & Date */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#202020] border border-[#353535] flex items-center justify-center text-[#D6B56D] shrink-0 mt-0.5">
                    <Film className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-[#FFFFFF] truncate">
                        {item.roomName}
                      </h4>

                      {/* User Role Badge */}
                      {isCreator && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#202020] text-[#D6B56D] border border-[#D6B56D]/40">
                          <Crown className="w-3 h-3 text-[#D6B56D]" />
                          Room Creator
                        </span>
                      )}
                      {isSuccessor && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#202020] text-[#F0D89F] border border-[#F0D89F]/40">
                          <Crown className="w-3 h-3 text-[#F0D89F]" />
                          Successor Host
                        </span>
                      )}
                      {!isCreator && !isSuccessor && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#171717] text-[#B9B9B9] border border-[#353535]">
                          <User className="w-3 h-3 text-[#777777]" />
                          Viewer
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#B9B9B9] mt-1.5 flex-wrap">
                      <span>Date: {formatDate(item.createdAt)}</span>
                      <span>•</span>
                      <span>Host: <strong className="text-[#FFFFFF]">{item.originalHostUsername}</strong></span>
                      {item.finalHostUsername !== item.originalHostUsername && (
                        <>
                          <span>•</span>
                          <span>Final Host: <strong className="text-[#D6B56D]">{item.finalHostUsername}</strong></span>
                        </>
                      )}
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Users className="w-3 h-3 text-[#777777]" />
                        {item.participantCount} attendee{item.participantCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Metrics & Details Action */}
                <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-[#252525]">
                  {/* Distinct Durations */}
                  <div className="flex items-center gap-5 text-right">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-[#777777] font-bold">
                        Your Time
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-[#D6B56D] font-mono">
                        {formatDuration(item.userParticipationDuration)}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-[#777777] font-bold">
                        Total Session
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-[#FFFFFF] font-mono">
                        {formatDuration(item.totalDurationSeconds)}
                      </span>
                    </div>
                  </div>

                  {/* View Details Button */}
                  <button
                    onClick={() => setSelectedSessionId(item.id)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#202020] hover:bg-[#282828] border border-[#353535] hover:border-[#D6B56D] text-[#D6B56D] hover:text-[#F0D89F] transition-all cursor-pointer shrink-0"
                    title="View detailed attendee intervals and history"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Details</span>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 cinema-card border border-[#353535] rounded-xl mt-4">
              <span className="text-xs text-[#B9B9B9]">
                Showing page <strong className="text-[#FFFFFF]">{pagination.page}</strong> of{' '}
                <strong className="text-[#FFFFFF]">{pagination.totalPages}</strong> ({pagination.total} sessions)
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadHistory(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#202020] hover:bg-[#282828] disabled:opacity-40 disabled:cursor-not-allowed text-[#B9B9B9] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  onClick={() => loadHistory(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#202020] hover:bg-[#282828] disabled:opacity-40 disabled:cursor-not-allowed text-[#B9B9B9] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SESSION DETAILS MODAL */}
      <SessionDetailsModal
        isOpen={!!selectedSessionId}
        onClose={() => setSelectedSessionId(null)}
        sessionId={selectedSessionId}
      />
    </div>
  );
}
