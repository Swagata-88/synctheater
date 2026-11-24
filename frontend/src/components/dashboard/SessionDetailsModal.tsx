'use client';

import React, { useState, useEffect } from 'react';
import { fetchSessionDetails, SessionDetailsResponse } from '../../lib/api';
import {
  History,
  Crown,
  Users,
  Clock,
  Calendar,
  X,
  AlertCircle,
  ArrowRight,
  Shield,
  Film,
} from 'lucide-react';

interface SessionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function formatTime(isoString: string | null): string {
  if (!isoString) return 'In Progress / None';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(isoString: string | null): string {
  if (!isoString) return 'N/A';
  const d = new Date(isoString);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatClosureReason(reason: string | null): string {
  if (!reason) return 'Active / In Progress';
  switch (reason) {
    case 'HOST_CLOSED':
    case 'HOST_ENDED':
      return 'Concluded by Host';
    case 'INACTIVITY_TIMEOUT':
    case 'ABANDONED_TIMEOUT':
      return 'Inactivity Timeout';
    case 'ALL_PARTICIPANTS_LEFT':
    case 'HOST_DEPARTED':
      return 'All Viewers Departed';
    case 'ADMIN_TERMINATED':
      return 'Admin Terminated';
    default:
      return reason;
  }
}

export function SessionDetailsModal({ isOpen, onClose, sessionId }: SessionDetailsModalProps) {
  const [data, setData] = useState<SessionDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !sessionId) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchSessionDetails(sessionId)
      .then((res) => {
        if (isMounted) {
          setData(res);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message || 'Failed to load session details.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  const session = data?.session;
  const attendance = data?.attendance || [];
  const transfers = data?.transfers || [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-details-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col cinema-card border border-[#353535] shadow-2xl rounded-2xl bg-[#111111] text-[#FFFFFF] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#353535] bg-[#171717]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#202020] border border-[#353535] flex items-center justify-center text-[#D6B56D] shrink-0">
              <Film className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="session-details-title" className="text-base font-bold text-[#FFFFFF] truncate">
                {session?.roomName || 'Watch Session Details'}
              </h3>
              <div className="flex items-center gap-2 text-xs text-[#B9B9B9]">
                <span>{session ? formatDate(session.createdAt) : 'Historical Session'}</span>
                <span>•</span>
                <span className="font-mono text-[#D6B56D]">
                  {session?.status === 'CLOSED' ? 'CLOSED' : 'ACTIVE'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#777777] hover:text-[#FFFFFF] hover:bg-[#202020] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isLoading && (
            <div className="py-16 text-center">
              <div className="inline-block w-8 h-8 border-2 border-[#D6B56D] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs text-[#B9B9B9]">Loading session details...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Access Error</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {!isLoading && !error && session && (
            <>
              {/* Session Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#171717] border border-[#353535]">
                  <span className="text-[10px] font-bold text-[#777777] uppercase tracking-wider block mb-1">
                    Total Duration
                  </span>
                  <span className="text-sm font-extrabold text-[#D6B56D] font-mono">
                    {formatDuration(session.totalDurationSeconds)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#171717] border border-[#353535]">
                  <span className="text-[10px] font-bold text-[#777777] uppercase tracking-wider block mb-1">
                    Closure Reason
                  </span>
                  <span className="text-xs font-semibold text-[#FFFFFF] truncate block">
                    {formatClosureReason(session.closureReason)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#171717] border border-[#353535]">
                  <span className="text-[10px] font-bold text-[#777777] uppercase tracking-wider block mb-1">
                    Started At
                  </span>
                  <span className="text-xs font-mono text-[#B9B9B9] block">
                    {formatTime(session.startedAt)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#171717] border border-[#353535]">
                  <span className="text-[10px] font-bold text-[#777777] uppercase tracking-wider block mb-1">
                    Ended At
                  </span>
                  <span className="text-xs font-mono text-[#B9B9B9] block">
                    {formatTime(session.endedAt)}
                  </span>
                </div>
              </div>

              {/* Host & Creator Info */}
              <div className="p-4 rounded-xl bg-[#171717] border border-[#353535] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-[#D6B56D]" />
                  <span className="text-[#B9B9B9]">Original Host:</span>
                  <span className="font-bold text-[#FFFFFF]">{session.originalHostUsername}</span>
                </div>

                {session.finalHostUsername !== session.originalHostUsername && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#B9B9B9]">Final Host:</span>
                    <span className="font-bold text-[#D6B56D]">{session.finalHostUsername}</span>
                  </div>
                )}
              </div>

              {/* Host Transfer Timeline (if any) */}
              {transfers.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider flex items-center gap-1.5 mb-3">
                    <Crown className="w-3.5 h-3.5 text-[#D6B56D]" />
                    Host Transfer Timeline ({transfers.length})
                  </h4>
                  <div className="space-y-2">
                    {transfers.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl bg-[#171717] border border-[#353535] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[#B9B9B9]">{t.previousHostUsername}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#D6B56D]" />
                          <span className="font-bold text-[#D6B56D]">{t.newHostUsername}</span>
                        </div>
                        <span className="text-[11px] text-[#777777] font-mono">
                          {formatTime(t.transferredAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Participant Attendance Breakdown */}
              <div>
                <h4 className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <Users className="w-3.5 h-3.5 text-[#D6B56D]" />
                  Attendee Attendance Intervals ({attendance.length})
                </h4>

                <div className="space-y-2">
                  {attendance.map((att) => (
                    <div
                      key={att.id}
                      className="p-3 rounded-xl bg-[#171717] border border-[#353535] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-[#202020] border border-[#353535] flex items-center justify-center text-[11px] font-bold text-[#D6B56D]">
                          {att.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#FFFFFF] truncate flex items-center gap-1.5">
                            <span>{att.displayName}</span>
                            {att.isOriginalHost && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#202020] text-[#D6B56D] border border-[#D6B56D]/40">
                                Creator
                              </span>
                            )}
                            {att.becameHost && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#202020] text-[#F0D89F] border border-[#F0D89F]/40">
                                Successor Host
                              </span>
                            )}
                          </p>
                          <div className="text-[11px] text-[#777777] font-mono flex items-center gap-2 mt-0.5">
                            <span>Joined: {formatTime(att.joinedAt)}</span>
                            <span>•</span>
                            <span>Left: {formatTime(att.leftAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="sm:text-right shrink-0">
                        <span className="text-xs font-bold text-[#D6B56D] font-mono">
                          {formatDuration(att.durationSeconds)}
                        </span>
                        <span className="block text-[10px] text-[#777777]">Interval Duration</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Read-Only Notice */}
              <div className="p-3 rounded-xl bg-[#171717] border border-[#252525] text-center text-xs text-[#777777]">
                Historical records are permanent and read-only.
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#353535] bg-[#171717] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#202020] hover:bg-[#282828] text-[#FFFFFF] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
