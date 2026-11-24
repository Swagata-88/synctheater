import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WatchHistorySection } from '../src/components/dashboard/WatchHistorySection';
import { SessionDetailsModal } from '../src/components/dashboard/SessionDetailsModal';
import * as api from '../src/lib/api';

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual('../src/lib/api');
  return {
    ...actual,
    fetchMyWatchHistory: vi.fn(),
    fetchSessionDetails: vi.fn(),
  };
});

describe('WatchHistorySection & SessionDetailsModal Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WatchHistorySection', () => {
    it('renders empty history state when user has no watch party records', async () => {
      (api.fetchMyWatchHistory as any).mockResolvedValue({
        success: true,
        history: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
      });

      render(<WatchHistorySection />);

      expect(screen.getByText(/Loading your personal watch history/i)).toBeDefined();

      await waitFor(() => {
        expect(screen.getByText(/No Watch History Yet/i)).toBeDefined();
        expect(screen.getByText(/Whenever you host or join a private watch room/i)).toBeDefined();
      });
    });

    it('renders watch history items with role badges, participant counts, and duration metrics', async () => {
      (api.fetchMyWatchHistory as any).mockResolvedValue({
        success: true,
        history: [
          {
            id: 'sess_1',
            roomId: 'rm_1',
            roomSlug: 'interstellar-party',
            roomName: 'Interstellar Party',
            originalHostId: 'usr_me',
            originalHostUsername: 'Me',
            finalHostId: 'usr_me',
            finalHostUsername: 'Me',
            createdAt: '2026-11-23T18:00:00.000Z',
            startedAt: '2026-11-23T18:05:00.000Z',
            endedAt: '2026-11-23T20:45:00.000Z',
            totalDurationSeconds: 9600,
            status: 'CLOSED',
            closureReason: 'HOST_CLOSED',
            userRole: 'ORIGINAL_HOST',
            userParticipationDuration: 9600,
            participantCount: 5,
          },
          {
            id: 'sess_2',
            roomId: 'rm_2',
            roomSlug: 'blade-runner-screening',
            roomName: 'Blade Runner Screening',
            originalHostId: 'usr_deckard',
            originalHostUsername: 'Deckard',
            finalHostId: 'usr_deckard',
            finalHostUsername: 'Deckard',
            createdAt: '2026-11-22T20:00:00.000Z',
            startedAt: '2026-11-22T20:10:00.000Z',
            endedAt: '2026-11-22T22:30:00.000Z',
            totalDurationSeconds: 8400,
            status: 'CLOSED',
            closureReason: 'HOST_CLOSED',
            userRole: 'PARTICIPANT',
            userParticipationDuration: 4200,
            participantCount: 3,
          },
        ],
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      });

      render(<WatchHistorySection />);

      await waitFor(() => {
        expect(screen.getByText('Interstellar Party')).toBeDefined();
        expect(screen.getByText('Blade Runner Screening')).toBeDefined();
      });

      // Role Badges
      expect(screen.getByText(/Room Creator/i)).toBeDefined();
      expect(screen.getByText(/Viewer/i)).toBeDefined();

      // Formatted durations
      expect(screen.getAllByText('2h 40m').length).toBeGreaterThanOrEqual(1); // 9600s
      expect(screen.getByText('1h 10m')).toBeDefined(); // 4200s (User time on blade runner)

      // Attendee count
      expect(screen.getByText(/5 attendees/i)).toBeDefined();
      expect(screen.getByText(/3 attendees/i)).toBeDefined();
    });

    it('renders pagination controls and triggers page change', async () => {
      (api.fetchMyWatchHistory as any).mockResolvedValue({
        success: true,
        history: [
          {
            id: 'sess_p1',
            roomName: 'Page 1 Session',
            originalHostUsername: 'HostA',
            finalHostUsername: 'HostA',
            createdAt: '2026-11-23T10:00:00.000Z',
            totalDurationSeconds: 3600,
            userParticipationDuration: 3600,
            participantCount: 2,
            userRole: 'PARTICIPANT',
          },
        ],
        pagination: { page: 1, limit: 1, total: 2, totalPages: 2 },
      });

      render(<WatchHistorySection />);

      await waitFor(() => {
        expect(screen.getByText('Page 1 Session')).toBeDefined();
      });

      const nextBtn = screen.getByRole('button', { name: /Next/i });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(api.fetchMyWatchHistory).toHaveBeenCalledWith(2, 10);
      });
    });

    it('displays error notice and retry button when fetch fails', async () => {
      (api.fetchMyWatchHistory as any).mockRejectedValue(new Error('Internal Server Error'));

      render(<WatchHistorySection />);

      await waitFor(() => {
        expect(screen.getByText(/Internal Server Error/i)).toBeDefined();
      });

      const retryBtn = screen.getByRole('button', { name: /Retry/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(api.fetchMyWatchHistory).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('SessionDetailsModal', () => {
    it('fetches and displays full session information, attendee intervals, and transfer logs', async () => {
      (api.fetchSessionDetails as any).mockResolvedValue({
        success: true,
        session: {
          id: 'sess_123',
          roomId: 'rm_123',
          roomSlug: 'dune-watch',
          roomName: 'Dune Part Two',
          originalHostId: 'usr_paul',
          originalHostUsername: 'PaulAtreides',
          finalHostId: 'usr_chani',
          finalHostUsername: 'Chani',
          createdAt: '2026-11-23T19:00:00.000Z',
          startedAt: '2026-11-23T19:05:00.000Z',
          endedAt: '2026-11-23T22:00:00.000Z',
          totalDurationSeconds: 10500,
          status: 'CLOSED',
          closureReason: 'HOST_CLOSED',
        },
        attendance: [
          {
            id: 'att_1',
            sessionId: 'sess_123',
            userId: 'usr_paul',
            displayName: 'PaulAtreides',
            joinedAt: '2026-11-23T19:05:00.000Z',
            leftAt: '2026-11-23T22:00:00.000Z',
            durationSeconds: 10500,
            isOriginalHost: true,
            becameHost: false,
          },
          {
            id: 'att_2',
            sessionId: 'sess_123',
            userId: 'usr_chani',
            displayName: 'Chani',
            joinedAt: '2026-11-23T19:10:00.000Z',
            leftAt: '2026-11-23T22:00:00.000Z',
            durationSeconds: 10200,
            isOriginalHost: false,
            becameHost: true,
          },
        ],
        transfers: [
          {
            id: 'ht_1',
            sessionId: 'sess_123',
            previousHostUsername: 'PaulAtreides',
            newHostUsername: 'Chani',
            transferredAt: '2026-11-23T20:30:00.000Z',
            reason: 'VOLUNTARY_TRANSFER',
          },
        ],
      });

      render(
        <SessionDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          sessionId="sess_123"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Dune Part Two')).toBeDefined();
        expect(screen.getByText(/Concluded by Host/i)).toBeDefined();
      });

      // Original and Final Host
      expect(screen.getAllByText('PaulAtreides').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Chani').length).toBeGreaterThanOrEqual(1);

      // Transfer Timeline
      expect(screen.getByText(/Host Transfer Timeline/i)).toBeDefined();

      // Attendance intervals
      expect(screen.getByText(/Creator/i)).toBeDefined();
      expect(screen.getByText(/Successor Host/i)).toBeDefined();

      // Read-only indicator
      expect(screen.getByText(/Historical records are permanent and read-only/i)).toBeDefined();
    });

    it('renders error notice when user is unauthorized to view session details', async () => {
      (api.fetchSessionDetails as any).mockRejectedValue(
        new Error('Access denied: You did not attend this watch party session.')
      );

      render(
        <SessionDetailsModal
          isOpen={true}
          onClose={vi.fn()}
          sessionId="sess_unauthorized"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Access denied: You did not attend this watch party session/i)).toBeDefined();
      });
    });
  });
});
