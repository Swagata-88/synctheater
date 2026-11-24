'use client';

import React, { useState } from 'react';
import { Participant } from './ParticipantPanel';
import { LogOut, Crown, AlertTriangle, X, Check } from 'lucide-react';

interface LeaveRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHost: boolean;
  participants: Participant[];
  currentUserId?: string;
  onConfirmLeave: () => Promise<void | any>;
  onTransferAndLeave: (successorId: string) => Promise<void | any>;
  onOpenEndRoomModal: () => void;
}

export function LeaveRoomModal({
  isOpen,
  onClose,
  isHost,
  participants,
  currentUserId,
  onConfirmLeave,
  onTransferAndLeave,
  onOpenEndRoomModal,
}: LeaveRoomModalProps) {
  const [selectedSuccessorId, setSelectedSuccessorId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const eligibleParticipants = participants.filter((p) => p.userId !== currentUserId);

  const handleLeaveAsParticipant = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await onConfirmLeave();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to leave the room.');
      setIsLoading(false);
    }
  };

  const handleHostDeparture = async () => {
    if (eligibleParticipants.length > 0 && !selectedSuccessorId) {
      setErrorMessage('Please select an active participant to transfer host privileges to.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (eligibleParticipants.length > 0) {
        await onTransferAndLeave(selectedSuccessorId);
      } else {
        await onConfirmLeave();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Host transfer failed. You have not left the room.');
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-room-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md cinema-card border border-[#353535] p-6 shadow-2xl rounded-2xl bg-[#111111] text-[#FFFFFF]">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#777777] hover:text-[#FFFFFF] hover:bg-[#202020] transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#202020] border border-[#353535] flex items-center justify-center text-[#D6B56D]">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <h3 id="leave-room-title" className="text-base font-bold text-[#FFFFFF]">
              {isHost ? 'Host Departure' : 'Leave Watch Room'}
            </h3>
            <p className="text-xs text-[#B9B9B9]">
              {isHost
                ? 'Manage theater ownership before departing'
                : 'Confirm your exit from this theater'}
            </p>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Ordinary Participant Mode */}
        {!isHost && (
          <div className="space-y-4">
            <p className="text-xs text-[#B9B9B9] leading-relaxed">
              Are you sure you want to leave this watch party? You will be returned to the dashboard. You can return anytime using your invitation link.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#202020] hover:bg-[#282828] text-[#B9B9B9] hover:text-[#FFFFFF] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLeaveAsParticipant}
                disabled={isLoading}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#D6B56D] hover:bg-[#F0D89F] text-[#090909] transition-all cursor-pointer flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#090909] border-t-transparent rounded-full animate-spin" />
                    <span>Leaving...</span>
                  </>
                ) : (
                  <span>Leave Room</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Host Departure Mode */}
        {isHost && (
          <div className="space-y-4">
            {eligibleParticipants.length === 0 ? (
              <div>
                <p className="text-xs text-[#B9B9B9] leading-relaxed mb-4">
                  You are currently the only person in this theater. If you leave, the room will remain active, or you can end the room now to finalize the watch session.
                </p>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleHostDeparture}
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#202020] hover:bg-[#282828] border border-[#353535] hover:border-[#D6B56D] text-[#FFFFFF] transition-colors cursor-pointer"
                  >
                    {isLoading ? 'Leaving...' : 'Leave Room (Keep Open)'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenEndRoomModal();
                    }}
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-red-600/90 hover:bg-red-600 text-white transition-colors cursor-pointer"
                  >
                    End Room for Everyone
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-[#B9B9B9] leading-relaxed mb-3">
                  As the room host, you must transfer host privileges to an active participant before departing:
                </p>

                <div className="max-h-48 overflow-y-auto space-y-2 mb-4 pr-1">
                  {eligibleParticipants.map((p) => {
                    const isSelected = selectedSuccessorId === p.userId;
                    const username = p.user?.username || `User-${p.userId.substring(0, 5)}`;
                    const avatar =
                      p.user?.avatarUrl ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${p.userId}`;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedSuccessorId(p.userId)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#202020] border-[#D6B56D] shadow-md'
                            : 'bg-[#171717] border-[#353535] hover:border-[#D6B56D]/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={avatar}
                            alt={username}
                            className="w-7 h-7 rounded-full bg-[#202020] border border-[#353535] object-cover"
                          />
                          <div className="truncate">
                            <p className="text-xs font-bold text-[#FFFFFF] truncate">{username}</p>
                            <span className="text-[10px] text-[#B9B9B9]">Active Viewer</span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#D6B56D] flex items-center justify-center text-[#090909]">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleHostDeparture}
                    disabled={isLoading || !selectedSuccessorId}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#D6B56D] hover:bg-[#F0D89F] disabled:opacity-50 disabled:cursor-not-allowed text-[#090909] transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-[#090909] border-t-transparent rounded-full animate-spin" />
                        <span>Transferring Host & Leaving...</span>
                      </>
                    ) : (
                      <>
                        <Crown className="w-4 h-4" />
                        <span>Transfer Host & Leave Room</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between gap-3 mt-1">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isLoading}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-[#B9B9B9] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenEndRoomModal();
                      }}
                      disabled={isLoading}
                      className="px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                    >
                      End Room Instead
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
