import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { VideoPlayer } from '../src/components/theater/VideoPlayer';

describe('VideoPlayer Component & Provider Handling', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete (window as any).YT;
  });

  it('renders Google Drive preview guidance badge explaining automatic sync limitations', () => {
    render(
      <VideoPlayer
        provider="GOOGLE_DRIVE"
        videoId="1234567890abcdef"
        videoUrl="https://drive.google.com/file/d/1234567890abcdef/view"
        status="PAUSED"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={true}
      />
    );

    expect(screen.getByText(/Google Drive Preview:/i)).toBeDefined();
    expect(
      screen.getByText(/Automatic playback synchronization and seek control cannot be guaranteed/i)
    ).toBeDefined();
  });

  it('renders unsupported video source fallback when provider is UNSUPPORTED', () => {
    render(
      <VideoPlayer
        provider="UNSUPPORTED"
        videoId=""
        videoUrl="https://example.com/unsupported-page"
        status="PAUSED"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={false}
      />
    );

    expect(screen.getByText(/Unsupported Video Source/i)).toBeDefined();
    expect(screen.getByText(/SYNCTHEATER supports YouTube videos & Shorts/i)).toBeDefined();
  });

  it('renders direct HTML5 video element when provider is DIRECT', () => {
    const { container } = render(
      <VideoPlayer
        provider="DIRECT"
        videoId="sample.mp4"
        videoUrl="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
        status="PAUSED"
        currentPosition={15}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={true}
      />
    );

    const videoElement = container.querySelector('video');
    expect(videoElement).not.toBeNull();
  });
});

describe('VideoPlayer LIVE Initialization & VOD Drift Isolation', () => {
  let mockPlayerInstance: any;
  let capturedEvents: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockPlayerInstance = {
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      destroy: vi.fn(),
      getPlayerState: vi.fn(() => 1),
      getCurrentTime: vi.fn(() => 100),
      getDuration: vi.fn(() => 3600),
    };
    capturedEvents = null;

    (window as any).YT = {
      Player: vi.fn((_elId: string, opts: any) => {
        capturedEvents = opts.events;
        return mockPlayerInstance;
      }),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as any).YT;
  });

  it('LIVE initialization never calls seekTo(0) and does not use getDuration() as a seek target', () => {
    render(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="LIVE"
        videoId="5qap5aO4i9A"
        videoUrl="https://www.youtube.com/live/5qap5aO4i9A"
        status="PLAYING"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={true}
      />
    );

    expect(capturedEvents).not.toBeNull();
    act(() => {
      capturedEvents.onReady({ target: mockPlayerInstance });
    });

    expect(mockPlayerInstance.seekTo).not.toHaveBeenCalled();
    expect(mockPlayerInstance.getDuration).not.toHaveBeenCalled();
    expect(mockPlayerInstance.playVideo).toHaveBeenCalled();
  });

  it('LIVE mode bypasses the 1-second VOD drift-correction loop', () => {
    // Player is at 100s locally, while authoritative position is 0s (delta = 100s > 2.5s)
    mockPlayerInstance.getCurrentTime.mockReturnValue(100);

    render(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="LIVE"
        videoId="5qap5aO4i9A"
        videoUrl="https://www.youtube.com/live/5qap5aO4i9A"
        status="PLAYING"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={false}
      />
    );

    act(() => {
      capturedEvents.onReady({ target: mockPlayerInstance });
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockPlayerInstance.seekTo).not.toHaveBeenCalled();
  });

  it('VOD mode retains initial seekTo and the 2.5-second hard-seek drift threshold', () => {
    // Initialize at position 10s while paused
    mockPlayerInstance.getCurrentTime.mockReturnValue(10);

    render(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="VOD"
        videoId="dQw4w9WgXcQ"
        videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        status="PAUSED"
        currentPosition={10}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={true}
      />
    );

    act(() => {
      capturedEvents.onReady({ target: mockPlayerInstance });
    });

    // VOD initialization seeks to targetPos (10)
    expect(mockPlayerInstance.seekTo).toHaveBeenCalledWith(10, true);
    expect(mockPlayerInstance.pauseVideo).toHaveBeenCalled();
    mockPlayerInstance.seekTo.mockClear();

    // Drift = 2.0s (<= 2.5s) -> should NOT trigger hard seek
    mockPlayerInstance.getCurrentTime.mockReturnValue(12.0);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(mockPlayerInstance.seekTo).not.toHaveBeenCalled();

    // Drift = 3.0s (> 2.5s) -> MUST trigger hard seek to authoritative position (10)
    mockPlayerInstance.getCurrentTime.mockReturnValue(13.0);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(mockPlayerInstance.seekTo).toHaveBeenCalledWith(10, true);
  });
});

describe('VideoPlayer Bounded LIVE Stall Recovery & Manual Reconnect', () => {
  let mockPlayerInstance: any;
  let capturedEvents: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockPlayerInstance = {
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      loadVideoById: vi.fn(),
      destroy: vi.fn(),
      getPlayerState: vi.fn(() => 3), // BUFFERING
      getCurrentTime: vi.fn(() => 0),
      getDuration: vi.fn(() => 3600),
      getVideoLoadedFraction: vi.fn(() => 0.2),
    };
    capturedEvents = null;

    (window as any).YT = {
      Player: vi.fn((_elId: string, opts: any) => {
        capturedEvents = opts.events;
        return mockPlayerInstance;
      }),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as any).YT;
  });

  it('executes max 2 playVideo() attempts with 15s cooldown, never calls seekTo, and shows manual reconnect after exhaustion', () => {
    render(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="LIVE"
        broadcastStatus="ACTIVE_LIVE"
        videoId="5qap5aO4i9A"
        videoUrl="https://www.youtube.com/live/5qap5aO4i9A"
        status="PLAYING"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={false}
      />
    );

    act(() => {
      capturedEvents.onReady({ target: mockPlayerInstance });
    });
    mockPlayerInstance.playVideo.mockClear();

    // Advance 9s (< 10s stall threshold) -> ordinary buffering, 0 recovery attempts
    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(mockPlayerInstance.playVideo).not.toHaveBeenCalled();

    // Advance 2s (total 11s stalled with 0 progress) -> Attempt 1 triggers playVideo()
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockPlayerInstance.playVideo).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('manual-reconnect-btn')).toBeNull();

    // Advance 12s (< 15s cooldown) -> cooldown blocks Attempt 2
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(mockPlayerInstance.playVideo).toHaveBeenCalledTimes(1);

    // Advance 5s (total 17s since Attempt 1, >= 15s cooldown and >= 10s stalled) -> Attempt 2
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(mockPlayerInstance.playVideo).toHaveBeenCalledTimes(2);
    expect(mockPlayerInstance.loadVideoById).not.toHaveBeenCalled();

    // Advance 20s -> automated attempts exhausted, no 3rd playVideo(), manual reconnect button appears
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(mockPlayerInstance.playVideo).toHaveBeenCalledTimes(2);
    expect(mockPlayerInstance.seekTo).not.toHaveBeenCalled();
    expect(mockPlayerInstance.loadVideoById).not.toHaveBeenCalled();

    const reconnectBtn = screen.getByTestId('manual-reconnect-btn');
    expect(reconnectBtn).toBeDefined();

    // Clicking manual reconnect calls loadVideoById({ videoId }) once; duplicate clicks are rejected
    act(() => {
      reconnectBtn.click();
      reconnectBtn.click();
    });
    expect(mockPlayerInstance.loadVideoById).toHaveBeenCalledTimes(1);
    expect(mockPlayerInstance.loadVideoById).toHaveBeenCalledWith({ videoId: '5qap5aO4i9A' });
    expect(mockPlayerInstance.seekTo).not.toHaveBeenCalled();
  });

  it('prevents recovery during intentional host pause and Emergency Pause', () => {
    const { rerender } = render(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="LIVE"
        broadcastStatus="ACTIVE_LIVE"
        videoId="5qap5aO4i9A"
        videoUrl="https://www.youtube.com/live/5qap5aO4i9A"
        status="PAUSED"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={false}
        isEmergencyPaused={false}
      />
    );

    act(() => {
      capturedEvents.onReady({ target: mockPlayerInstance });
    });
    mockPlayerInstance.playVideo.mockClear();

    // Host pause: advancing 30s must NEVER trigger recovery playVideo()
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(mockPlayerInstance.playVideo).not.toHaveBeenCalled();
    expect(screen.queryByTestId('manual-reconnect-btn')).toBeNull();

    // Emergency Pause while status is PLAYING -> must NEVER trigger recovery or resume playback
    rerender(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="LIVE"
        broadcastStatus="ACTIVE_LIVE"
        videoId="5qap5aO4i9A"
        videoUrl="https://www.youtube.com/live/5qap5aO4i9A"
        status="PLAYING"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={false}
        isEmergencyPaused={true}
      />
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(mockPlayerInstance.playVideo).not.toHaveBeenCalled();
    expect(screen.queryByTestId('manual-reconnect-btn')).toBeNull();
  });

  it('does NOT trigger LIVE stall recovery or manual reconnect in VOD mode', () => {
    render(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="VOD"
        broadcastStatus="ORDINARY_VOD"
        videoId="dQw4w9WgXcQ"
        videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        status="PLAYING"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={true}
      />
    );

    act(() => {
      capturedEvents.onReady({ target: mockPlayerInstance });
    });

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(screen.queryByTestId('manual-reconnect-btn')).toBeNull();
    expect(mockPlayerInstance.loadVideoById).not.toHaveBeenCalled();
  });
});

describe('VideoPlayer Phase 16.4.6 Sampling, Readiness & Reconnect Hardening', () => {
  let players: Array<{ instance: any; events: any }>;

  beforeEach(() => {
    vi.useFakeTimers();
    players = [];

    (window as any).YT = {
      Player: vi.fn((_elId: string, opts: any) => {
        const instance = {
          seekTo: vi.fn(),
          playVideo: vi.fn(),
          pauseVideo: vi.fn(),
          loadVideoById: vi.fn(),
          destroy: vi.fn(),
          getPlayerState: vi.fn(() => 1),
          getCurrentTime: vi.fn(() => 0),
          getDuration: vi.fn(() => 100),
          getVideoLoadedFraction: vi.fn(() => 0.2),
        };
        players.push({ instance, events: opts.events });
        return instance;
      }),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as any).YT;
  });

  it('continuous PLAYING with only one initial onStateChange(1) collects periodic samples and confirms ACTIVE_LIVE', () => {
    const onClassification = vi.fn();

    render(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="LIVE"
        broadcastStatus="UNKNOWN_UNVERIFIED"
        videoId="5qap5aO4i9A"
        videoUrl="https://www.youtube.com/live/5qap5aO4i9A"
        status="PLAYING"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        sequenceNumber={1}
        isOwnerOrMod={true}
        onBroadcastClassification={onClassification}
      />
    );

    const p = players[0];
    p.instance.getDuration.mockReturnValue(120);

    act(() => {
      p.events.onReady({ target: p.instance });
      p.events.onStateChange({ data: 1, target: p.instance });
    });

    // Only 1 sample so far -> still UNKNOWN_UNVERIFIED
    expect(onClassification).not.toHaveBeenCalled();

    // Advance 2.5s while duration increases to 123 -> second sample confirms ACTIVE_LIVE
    p.instance.getDuration.mockReturnValue(123);
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(onClassification).toHaveBeenCalledTimes(1);
    expect(onClassification).toHaveBeenCalledWith({
      videoId: '5qap5aO4i9A',
      mode: 'LIVE',
      broadcastStatus: 'ACTIVE_LIVE',
      sequenceNumber: 1,
    });
  });

  it('zero, static, or decreasing duration samples never falsely confirm ACTIVE_LIVE', () => {
    const onClassification = vi.fn();

    render(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="LIVE"
        broadcastStatus="UNKNOWN_UNVERIFIED"
        videoId="5qap5aO4i9A"
        videoUrl="https://www.youtube.com/live/5qap5aO4i9A"
        status="PLAYING"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        sequenceNumber={1}
        isOwnerOrMod={true}
        onBroadcastClassification={onClassification}
      />
    );

    const p = players[0];
    p.instance.getDuration.mockReturnValue(0);
    act(() => {
      p.events.onReady({ target: p.instance });
      p.events.onStateChange({ data: 1, target: p.instance });
      vi.advanceTimersByTime(5000);
    });
    expect(onClassification).not.toHaveBeenCalled();

    // Decreasing sample (200 -> 150) must not confirm ACTIVE_LIVE
    p.instance.getDuration.mockReturnValueOnce(200).mockReturnValueOnce(150);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onClassification).not.toHaveBeenCalledWith(
      expect.objectContaining({ broadcastStatus: 'ACTIVE_LIVE' })
    );
  });

  it('stops sampling on pause, buffering, video change, and unmount', () => {
    const onClassification = vi.fn();

    const { rerender, unmount } = render(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="LIVE"
        broadcastStatus="UNKNOWN_UNVERIFIED"
        videoId="5qap5aO4i9A"
        videoUrl="https://www.youtube.com/live/5qap5aO4i9A"
        status="PLAYING"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        sequenceNumber={1}
        isOwnerOrMod={true}
        onBroadcastClassification={onClassification}
      />
    );

    const p1 = players[0];
    p1.instance.getDuration.mockReturnValue(100);
    act(() => {
      p1.events.onReady({ target: p1.instance });
      p1.events.onStateChange({ data: 1, target: p1.instance });
    });
    p1.instance.getDuration.mockClear();

    // Buffering (3) stops sampling
    p1.instance.getPlayerState.mockReturnValue(3);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(p1.instance.getDuration).not.toHaveBeenCalled();

    // Video change resets samples and destroys old player
    rerender(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="LIVE"
        broadcastStatus="UNKNOWN_UNVERIFIED"
        videoId="jfKfPfyJRdk"
        videoUrl="https://www.youtube.com/live/jfKfPfyJRdk"
        status="PLAYING"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        sequenceNumber={2}
        isOwnerOrMod={true}
        onBroadcastClassification={onClassification}
      />
    );

    expect(p1.instance.destroy).toHaveBeenCalled();

    // Unmount stops all intervals
    const p2 = players[1];
    unmount();
    p2.instance.getDuration.mockClear();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(p2.instance.getDuration).not.toHaveBeenCalled();
  });

  it('prevents an obsolete player callback from marking a replacement player ready', () => {
    const onPlayerReady = vi.fn();

    const { rerender } = render(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="LIVE"
        broadcastStatus="UNKNOWN_UNVERIFIED"
        videoId="5qap5aO4i9A"
        videoUrl="https://www.youtube.com/live/5qap5aO4i9A"
        status="PAUSED"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={true}
        onPlayerReady={onPlayerReady}
      />
    );

    const oldPlayer = players[0];

    rerender(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="LIVE"
        broadcastStatus="UNKNOWN_UNVERIFIED"
        videoId="jfKfPfyJRdk"
        videoUrl="https://www.youtube.com/live/jfKfPfyJRdk"
        status="PAUSED"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={true}
        onPlayerReady={onPlayerReady}
      />
    );

    // Late onReady from obsolete player must be ignored
    act(() => {
      oldPlayer.events.onReady({ target: oldPlayer.instance });
    });
    expect(onPlayerReady).not.toHaveBeenCalled();

    // Current replacement player onReady succeeds
    const newPlayer = players[1];
    act(() => {
      newPlayer.events.onReady({ target: newPlayer.instance });
    });
    expect(onPlayerReady).toHaveBeenCalledTimes(1);
  });

  it('restores reconnect button with error on silent timeout, and clears timeout on recovery, video change, or unmount', () => {
    const { rerender, unmount } = render(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="LIVE"
        broadcastStatus="ACTIVE_LIVE"
        videoId="5qap5aO4i9A"
        videoUrl="https://www.youtube.com/live/5qap5aO4i9A"
        status="PLAYING"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={false}
      />
    );

    const p1 = players[0];
    p1.instance.getPlayerState.mockReturnValue(3); // BUFFERING

    act(() => {
      p1.events.onReady({ target: p1.instance });
    });

    // Exhaust 2 automated attempts (11s + 16s + 11s)
    act(() => {
      vi.advanceTimersByTime(45000);
    });

    const btn = screen.getByTestId('manual-reconnect-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);

    // Click reconnect; duplicate click is blocked while pending
    act(() => {
      btn.click();
      btn.click();
    });
    expect(p1.instance.loadVideoById).toHaveBeenCalledTimes(1);
    expect((screen.getByTestId('manual-reconnect-btn') as HTMLButtonElement).disabled).toBe(true);

    // Silent failure: advance 12.5s -> timeout restores button and shows error
    act(() => {
      vi.advanceTimersByTime(12500);
    });
    expect((screen.getByTestId('manual-reconnect-btn') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('reconnect-error').textContent).toContain('Reconnect timed out');

    // Retry reconnect, then simulate successful PLAYING recovery -> clears timeout & hides overlay
    act(() => {
      screen.getByTestId('manual-reconnect-btn').click();
    });
    act(() => {
      p1.events.onStateChange({ data: 1, target: p1.instance });
    });
    expect(screen.queryByTestId('manual-reconnect-btn')).toBeNull();
    expect(screen.queryByTestId('reconnect-error')).toBeNull();

    // Advance past timeout -> no stale error appears
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(screen.queryByTestId('reconnect-error')).toBeNull();

    // Video change & unmount clean up cleanly
    rerender(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="LIVE"
        broadcastStatus="UNKNOWN_UNVERIFIED"
        videoId="jfKfPfyJRdk"
        videoUrl="https://www.youtube.com/live/jfKfPfyJRdk"
        status="PLAYING"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={false}
      />
    );
    unmount();
  });
});
