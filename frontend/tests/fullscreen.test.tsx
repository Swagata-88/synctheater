import React, { createRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { PlaybackControls } from '../src/components/theater/PlaybackControls';
import { VideoPlayer } from '../src/components/theater/VideoPlayer';

describe('Mobile & Participant Fullscreen + Landscape Orientation', () => {
  const originalRequestFullscreen = HTMLElement.prototype.requestFullscreen;
  const originalExitFullscreen = document.exitFullscreen;
  const originalScreenOrientation = Object.getOwnPropertyDescriptor(window.screen, 'orientation');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    HTMLElement.prototype.requestFullscreen = originalRequestFullscreen;
    document.exitFullscreen = originalExitFullscreen;
    if (originalScreenOrientation) {
      Object.defineProperty(window.screen, 'orientation', originalScreenOrientation);
    }
    document.body.style.overflow = '';
  });

  it('renders fullscreen toggle for non-host participants and triggers callback', () => {
    const onToggleFullscreen = vi.fn();
    render(
      <PlaybackControls
        status="PLAYING"
        playbackMode="LIVE"
        broadcastStatus="ACTIVE_LIVE"
        currentTime={0}
        duration={0}
        playbackRate={1}
        isOwnerOrMod={false}
        theaterSetting="classic"
        isFullscreen={false}
        onToggleFullscreen={onToggleFullscreen}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onSeek={vi.fn()}
        onEmergencyPause={vi.fn()}
        onChangeVideoClick={vi.fn()}
        onChangeRate={vi.fn()}
        onChangeTheme={vi.fn()}
      />
    );

    const btn = screen.getByTestId('fullscreen-btn');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('Enter fullscreen');
    fireEvent.click(btn);
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it('enters native fullscreen and locks landscape orientation after requestFullscreen resolves', async () => {
    const callOrder: string[] = [];
    const lockMock = vi.fn().mockImplementation(async () => {
      callOrder.push('orientation.lock');
    });
    const unlockMock = vi.fn().mockImplementation(() => {
      callOrder.push('orientation.unlock');
    });

    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: { lock: lockMock, unlock: unlockMock },
    });

    let fullscreenEl: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenEl,
    });

    HTMLElement.prototype.requestFullscreen = vi.fn().mockImplementation(async function (this: HTMLElement) {
      callOrder.push('requestFullscreen');
      fullscreenEl = this;
    });
    document.exitFullscreen = vi.fn().mockImplementation(async () => {
      callOrder.push('exitFullscreen');
      fullscreenEl = null;
    });

    const controllerRef = createRef<{ toggle: () => void } | null>() as React.MutableRefObject<{
      toggle: () => void;
    } | null>;
    const onFullscreenChange = vi.fn();

    render(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="LIVE"
        broadcastStatus="ACTIVE_LIVE"
        videoId="S_71wzZMf0M"
        videoUrl="https://www.youtube.com/live/S_71wzZMf0M"
        status="PLAYING"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={false}
        fullscreenControllerRef={controllerRef}
        onFullscreenChange={onFullscreenChange}
      />
    );

    await act(async () => {
      controllerRef.current?.toggle();
    });

    await waitFor(() => {
      expect(callOrder).toEqual(['requestFullscreen', 'orientation.lock']);
    });
    expect(lockMock).toHaveBeenCalledWith('landscape');
    expect(onFullscreenChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('video-player-container').getAttribute('data-fullscreen')).toBe('true');
    expect(screen.getByTestId('exit-fullscreen-btn')).toBeTruthy();

    // Exit via floating exit button
    await act(async () => {
      fireEvent.click(screen.getByTestId('exit-fullscreen-btn'));
    });

    expect(unlockMock).toHaveBeenCalledTimes(1);
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(onFullscreenChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByTestId('video-player-container').getAttribute('data-fullscreen')).toBe('false');
  });

  it('falls back to CSS immersive fullscreen on iOS/unsupported browsers without crashing and exits on Escape', async () => {
    // Simulate iOS Safari where container.requestFullscreen is unavailable
    (HTMLElement.prototype as any).requestFullscreen = undefined;
    (HTMLElement.prototype as any).webkitRequestFullscreen = undefined;

    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: undefined,
    });

    const controllerRef = createRef<{ toggle: () => void } | null>() as React.MutableRefObject<{
      toggle: () => void;
    } | null>;
    const onFullscreenChange = vi.fn();

    render(
      <VideoPlayer
        provider="YOUTUBE"
        playbackMode="VOD"
        videoId="dQw4w9WgXcQ"
        videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        status="PLAYING"
        currentPosition={15}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={false}
        fullscreenControllerRef={controllerRef}
        onFullscreenChange={onFullscreenChange}
      />
    );

    await act(async () => {
      controllerRef.current?.toggle();
    });

    const container = screen.getByTestId('video-player-container');
    expect(container.getAttribute('data-fullscreen')).toBe('true');
    expect(container.className).toContain('fixed inset-0');
    expect(document.body.style.overflow).toBe('hidden');

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(container.getAttribute('data-fullscreen')).toBe('false');
    expect(document.body.style.overflow).toBe('');
    expect(onFullscreenChange).toHaveBeenLastCalledWith(false);
  });

  it('uses webkitEnterFullscreen for Direct/HLS video when requestFullscreen is unavailable', async () => {
    (HTMLElement.prototype as any).requestFullscreen = undefined;
    (HTMLElement.prototype as any).webkitRequestFullscreen = undefined;
    const webkitEnterMock = vi.fn();

    const controllerRef = createRef<{ toggle: () => void } | null>() as React.MutableRefObject<{
      toggle: () => void;
    } | null>;

    const { container } = render(
      <VideoPlayer
        provider="DIRECT"
        playbackMode="VOD"
        videoId="https://example.com/movie.mp4"
        videoUrl="https://example.com/movie.mp4"
        status="PLAYING"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={false}
        fullscreenControllerRef={controllerRef}
      />
    );

    const videoEl = container.querySelector('video') as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    };
    expect(videoEl).toBeTruthy();
    videoEl.webkitEnterFullscreen = webkitEnterMock;

    await act(async () => {
      controllerRef.current?.toggle();
    });

    expect(webkitEnterMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('video-player-container').getAttribute('data-fullscreen')).toBe('true');
  });

  it('displays Emergency Paused indicator inside fullscreen when Emergency Pause is active', async () => {
    (HTMLElement.prototype as any).requestFullscreen = undefined;

    const controllerRef = createRef<{ toggle: () => void } | null>() as React.MutableRefObject<{
      toggle: () => void;
    } | null>;

    render(
      <VideoPlayer
        provider="GOOGLE_DRIVE"
        playbackMode="VOD"
        videoId="drive123"
        videoUrl="https://drive.google.com/file/d/drive123/view"
        status="PAUSED"
        currentPosition={0}
        playbackRate={1}
        lastServerTimestamp={Date.now()}
        isOwnerOrMod={false}
        isEmergencyPaused={true}
        fullscreenControllerRef={controllerRef}
      />
    );

    await act(async () => {
      controllerRef.current?.toggle();
    });

    expect(screen.getByTestId('fullscreen-emergency-badge')).toBeTruthy();
    expect(screen.getByTestId('exit-fullscreen-btn')).toBeTruthy();
  });
});
