import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LeaveRoomModal } from '../src/components/theater/LeaveRoomModal';
import { EndRoomModal } from '../src/components/theater/EndRoomModal';
import { Participant } from '../src/components/theater/ParticipantPanel';

describe('LeaveRoomModal & EndRoomModal Component Tests', () => {
  const mockParticipants: Participant[] = [
    {
      id: 'p1',
      userId: 'usr_host',
      role: 'OWNER',
      joinedAt: new Date(),
      user: { id: 'usr_host', username: 'HostUser' },
    },
    {
      id: 'p2',
      userId: 'usr_viewer1',
      role: 'PARTICIPANT',
      joinedAt: new Date(),
      user: { id: 'usr_viewer1', username: 'ViewerOne' },
    },
    {
      id: 'p3',
      userId: 'usr_viewer2',
      role: 'PARTICIPANT',
      joinedAt: new Date(),
      user: { id: 'usr_viewer2', username: 'ViewerTwo' },
    },
  ];

  describe('LeaveRoomModal — Ordinary Participant', () => {
    it('renders participant leave confirmation and triggers onConfirmLeave', async () => {
      const handleLeave = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();

      render(
        <LeaveRoomModal
          isOpen={true}
          onClose={handleClose}
          isHost={false}
          participants={mockParticipants}
          currentUserId="usr_viewer1"
          onConfirmLeave={handleLeave}
          onTransferAndLeave={vi.fn()}
          onOpenEndRoomModal={vi.fn()}
        />
      );

      expect(screen.getByText(/Leave Watch Room/i)).toBeDefined();
      expect(screen.getByText(/Are you sure you want to leave this watch party/i)).toBeDefined();

      const leaveBtn = screen.getByRole('button', { name: /^Leave Room$/i });
      fireEvent.click(leaveBtn);

      await waitFor(() => {
        expect(handleLeave).toHaveBeenCalledTimes(1);
      });
    });

    it('cancels leave dialog when Cancel button is clicked', () => {
      const handleClose = vi.fn();

      render(
        <LeaveRoomModal
          isOpen={true}
          onClose={handleClose}
          isHost={false}
          participants={mockParticipants}
          currentUserId="usr_viewer1"
          onConfirmLeave={vi.fn()}
          onTransferAndLeave={vi.fn()}
          onOpenEndRoomModal={vi.fn()}
        />
      );

      const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('LeaveRoomModal — Host Departure & Transfer', () => {
    it('requires host to select an active successor before leaving', async () => {
      const handleTransferAndLeave = vi.fn().mockResolvedValue(undefined);

      render(
        <LeaveRoomModal
          isOpen={true}
          onClose={vi.fn()}
          isHost={true}
          participants={mockParticipants}
          currentUserId="usr_host"
          onConfirmLeave={vi.fn()}
          onTransferAndLeave={handleTransferAndLeave}
          onOpenEndRoomModal={vi.fn()}
        />
      );

      expect(screen.getByText(/Host Departure/i)).toBeDefined();
      expect(screen.getByText(/ViewerOne/i)).toBeDefined();
      expect(screen.getByText(/ViewerTwo/i)).toBeDefined();

      // "Transfer Host & Leave Room" button should be disabled until a successor is chosen
      const transferBtn = screen.getByRole('button', { name: /Transfer Host & Leave Room/i });
      expect(transferBtn).toBeDefined();
      expect((transferBtn as HTMLButtonElement).disabled).toBe(true);

      // Select ViewerOne
      const viewerOneItem = screen.getByText('ViewerOne');
      fireEvent.click(viewerOneItem);

      // Button should now be enabled
      expect((transferBtn as HTMLButtonElement).disabled).toBe(false);

      fireEvent.click(transferBtn);
      await waitFor(() => {
        expect(handleTransferAndLeave).toHaveBeenCalledWith('usr_viewer1');
      });
    });

    it('displays error feedback when host transfer fails without leaving', async () => {
      const handleTransferAndLeave = vi.fn().mockRejectedValue(new Error('Network error during transfer'));

      render(
        <LeaveRoomModal
          isOpen={true}
          onClose={vi.fn()}
          isHost={true}
          participants={mockParticipants}
          currentUserId="usr_host"
          onConfirmLeave={vi.fn()}
          onTransferAndLeave={handleTransferAndLeave}
          onOpenEndRoomModal={vi.fn()}
        />
      );

      const viewerTwoItem = screen.getByText('ViewerTwo');
      fireEvent.click(viewerTwoItem);

      const transferBtn = screen.getByRole('button', { name: /Transfer Host & Leave Room/i });
      fireEvent.click(transferBtn);

      await waitFor(() => {
        expect(screen.getByText(/Network error during transfer/i)).toBeDefined();
      });
    });

    it('offers End Room or Leave Room when host is the only participant', () => {
      const handleOpenEndRoom = vi.fn();
      const soloParticipants = [mockParticipants[0]]; // Only host

      render(
        <LeaveRoomModal
          isOpen={true}
          onClose={vi.fn()}
          isHost={true}
          participants={soloParticipants}
          currentUserId="usr_host"
          onConfirmLeave={vi.fn()}
          onTransferAndLeave={vi.fn()}
          onOpenEndRoomModal={handleOpenEndRoom}
        />
      );

      expect(screen.getByText(/only person in this theater/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /Leave Room \(Keep Open\)/i })).toBeDefined();

      const endRoomBtn = screen.getByRole('button', { name: /End Room for Everyone/i });
      fireEvent.click(endRoomBtn);
      expect(handleOpenEndRoom).toHaveBeenCalledTimes(1);
    });
  });

  describe('EndRoomModal', () => {
    it('renders permanent closure warning and calls onConfirmEndRoom', async () => {
      const handleEnd = vi.fn().mockResolvedValue(undefined);

      render(
        <EndRoomModal
          isOpen={true}
          onClose={vi.fn()}
          roomName="Cinema Paradiso"
          onConfirmEndRoom={handleEnd}
        />
      );

      expect(screen.getByText(/End Watch Room For Everyone\?/i)).toBeDefined();
      expect(screen.getByText(/Cinema Paradiso/i)).toBeDefined();
      expect(screen.getByText(/Ending the room is permanent/i)).toBeDefined();

      const endBtn = screen.getByRole('button', { name: /End Room For Everyone/i });
      fireEvent.click(endBtn);

      await waitFor(() => {
        expect(handleEnd).toHaveBeenCalledTimes(1);
      });
    });

    it('displays error message if room closure fails', async () => {
      const handleEnd = vi.fn().mockRejectedValue(new Error('Permission denied by server.'));

      render(
        <EndRoomModal
          isOpen={true}
          onClose={vi.fn()}
          roomName="Cinema Paradiso"
          onConfirmEndRoom={handleEnd}
        />
      );

      const endBtn = screen.getByRole('button', { name: /End Room For Everyone/i });
      fireEvent.click(endBtn);

      await waitFor(() => {
        expect(screen.getByText(/Permission denied by server/i)).toBeDefined();
      });
    });
  });
});
