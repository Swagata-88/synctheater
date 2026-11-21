import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlaybackControls } from '../src/components/theater/PlaybackControls';

describe('PlaybackControls Component', () => {
  const originalClipboard = navigator.clipboard;
  const originalExecCommand = document.execCommand;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
    document.execCommand = originalExecCommand;
  });

  it('renders playback time formatted correctly', () => {
    render(
      <PlaybackControls
        status="PAUSED"
        currentTime={65}
        duration={130}
        playbackRate={1}
        isOwnerOrMod={true}
        theaterSetting="classic"
        onPlay={() => {}}
        onPause={() => {}}
        onSeek={() => {}}
        onEmergencyPause={() => {}}
        onChangeVideoClick={() => {}}
        onChangeRate={() => {}}
        onChangeTheme={() => {}}
      />
    );

    expect(screen.getByText('01:05')).toBeDefined();
    expect(screen.getByText('02:10')).toBeDefined();
  });

  it('triggers onEmergencyPause callback when emergency pause button is clicked', () => {
    const handleEmergencyPause = vi.fn();

    render(
      <PlaybackControls
        status="PLAYING"
        currentTime={10}
        duration={100}
        playbackRate={1}
        isOwnerOrMod={false}
        theaterSetting="classic"
        onPlay={() => {}}
        onPause={() => {}}
        onSeek={() => {}}
        onEmergencyPause={handleEmergencyPause}
        onChangeVideoClick={() => {}}
        onChangeRate={() => {}}
        onChangeTheme={() => {}}
      />
    );

    const emergencyBtn = screen.getByText(/Emergency Pause/i);
    fireEvent.click(emergencyBtn);
    expect(handleEmergencyPause).toHaveBeenCalledTimes(1);
  });

  it('allows owner/moderator to trigger play action', () => {
    const handlePlay = vi.fn();

    render(
      <PlaybackControls
        status="PAUSED"
        currentTime={0}
        duration={100}
        playbackRate={1}
        isOwnerOrMod={true}
        theaterSetting="classic"
        onPlay={handlePlay}
        onPause={() => {}}
        onSeek={() => {}}
        onEmergencyPause={() => {}}
        onChangeVideoClick={() => {}}
        onChangeRate={() => {}}
        onChangeTheme={() => {}}
      />
    );

    const playButton = screen.getByTitle('Play Video');
    fireEvent.click(playButton);
    expect(handlePlay).toHaveBeenCalledTimes(1);
  });

  describe('Invite Sharing & Clipboard Handling', () => {
    it('shows "Copied Link!" upon successful copying via Async Clipboard API', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });

      render(
        <PlaybackControls
          status="PLAYING"
          currentTime={0}
          duration={100}
          playbackRate={1}
          isOwnerOrMod={true}
          theaterSetting="classic"
          inviteUrl="https://synctheater.com/room/sci-fi-party"
          onPlay={() => {}}
          onPause={() => {}}
          onSeek={() => {}}
          onEmergencyPause={() => {}}
          onChangeVideoClick={() => {}}
          onChangeRate={() => {}}
          onChangeTheme={() => {}}
        />
      );

      const inviteBtn = screen.getByTestId('invite-btn');
      expect(inviteBtn.textContent).toContain('Invite');

      fireEvent.click(inviteBtn);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith('https://synctheater.com/room/sci-fi-party');
        expect(screen.getByTestId('invite-btn').textContent).toContain('Copied Link!');
      });

      // Does not show manual fallback modal when copy succeeds
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('handles undefined navigator.clipboard on Android/HTTP without throwing and opens manual copy modal if execCommand fails', async () => {
      // Simulate Android browser where navigator.clipboard is undefined
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      // Also simulate execCommand not working
      document.execCommand = vi.fn().mockReturnValue(false);

      render(
        <PlaybackControls
          status="PLAYING"
          currentTime={0}
          duration={100}
          playbackRate={1}
          isOwnerOrMod={true}
          theaterSetting="classic"
          inviteUrl="https://synctheater.com/room/android-test"
          onPlay={() => {}}
          onPause={() => {}}
          onSeek={() => {}}
          onEmergencyPause={() => {}}
          onChangeVideoClick={() => {}}
          onChangeRate={() => {}}
          onChangeTheme={() => {}}
        />
      );

      const inviteBtn = screen.getByTestId('invite-btn');

      // Clicking must not throw TypeError: Cannot read properties of undefined (reading 'writeText')
      expect(() => fireEvent.click(inviteBtn)).not.toThrow();

      // Manual fallback modal appears with selectable input pointing to the correct room URL
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeDefined();
        const input = screen.getByTestId('manual-invite-input') as HTMLInputElement;
        expect(input.value).toBe('https://synctheater.com/room/android-test');
      });

      // The main button does NOT show "Copied Link!" because copy failed
      expect(inviteBtn.textContent).toContain('Invite');
    });

    it('handles clipboard writeText permission rejection without crashing and displays manual copy option', async () => {
      // Simulate permission rejection in browser
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError: write permission denied')),
        },
        writable: true,
        configurable: true,
      });

      // Simulate execCommand unavailable
      document.execCommand = vi.fn().mockReturnValue(false);

      render(
        <PlaybackControls
          status="PLAYING"
          currentTime={0}
          duration={100}
          playbackRate={1}
          isOwnerOrMod={true}
          theaterSetting="classic"
          inviteUrl="https://synctheater.com/room/permission-rejection"
          onPlay={() => {}}
          onPause={() => {}}
          onSeek={() => {}}
          onEmergencyPause={() => {}}
          onChangeVideoClick={() => {}}
          onChangeRate={() => {}}
          onChangeTheme={() => {}}
        />
      );

      const inviteBtn = screen.getByTestId('invite-btn');
      fireEvent.click(inviteBtn);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeDefined();
        const input = screen.getByTestId('manual-invite-input') as HTMLInputElement;
        expect(input.value).toBe('https://synctheater.com/room/permission-rejection');
      });
    });

    it('supports modal interactions (closing modal and input selection)', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      document.execCommand = vi.fn().mockReturnValue(false);

      render(
        <PlaybackControls
          status="PAUSED"
          currentTime={0}
          duration={100}
          playbackRate={1}
          isOwnerOrMod={true}
          theaterSetting="classic"
          inviteUrl="https://synctheater.com/room/modal-interaction"
          onPlay={() => {}}
          onPause={() => {}}
          onSeek={() => {}}
          onEmergencyPause={() => {}}
          onChangeVideoClick={() => {}}
          onChangeRate={() => {}}
          onChangeTheme={() => {}}
        />
      );

      fireEvent.click(screen.getByTestId('invite-btn'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeDefined();
      });

      // Close modal using close button
      const closeBtn = screen.getByTestId('close-invite-modal');
      fireEvent.click(closeBtn);

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('copies successfully using execCommand fallback when navigator.clipboard is undefined', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const execCommandMock = vi.fn().mockReturnValue(true);
      document.execCommand = execCommandMock;

      render(
        <PlaybackControls
          status="PLAYING"
          currentTime={0}
          duration={100}
          playbackRate={1}
          isOwnerOrMod={true}
          theaterSetting="classic"
          inviteUrl="https://synctheater.com/room/exec-command-success"
          onPlay={() => {}}
          onPause={() => {}}
          onSeek={() => {}}
          onEmergencyPause={() => {}}
          onChangeVideoClick={() => {}}
          onChangeRate={() => {}}
          onChangeTheme={() => {}}
        />
      );

      const inviteBtn = screen.getByTestId('invite-btn');
      fireEvent.click(inviteBtn);

      await waitFor(() => {
        expect(execCommandMock).toHaveBeenCalledWith('copy');
        expect(screen.getByTestId('invite-btn').textContent).toContain('Copied Link!');
      });

      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
