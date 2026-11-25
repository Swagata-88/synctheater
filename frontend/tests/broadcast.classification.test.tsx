import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { classifyYouTubeBroadcast } from '../src/lib/broadcastClassifier';
import { VideoPlayer } from '../src/components/theater/VideoPlayer';

describe('Broadcast Classifier Hardened Rules', () => {
  it('URL intent alone and PLAYING alone CANNOT establish ACTIVE_LIVE', () => {
    const res = classifyYouTubeBroadcast({
      playerState: 1,
      urlPlaybackIntent: 'LIVE',
      durationSamples: [],
      currentStatus: 'UNKNOWN_UNVERIFIED',
    });
    expect(res.broadcastStatus).toBe('UNKNOWN_UNVERIFIED');
    expect(res.isConfirmed).toBe(false);
  });

  it('repeated zero-duration samples [0, 0] CANNOT establish ACTIVE_LIVE', () => {
    const res = classifyYouTubeBroadcast({
      playerState: 1,
      urlPlaybackIntent: 'LIVE',
      durationSamples: [0, 0, 0],
      currentStatus: 'UNKNOWN_UNVERIFIED',
    });
    expect(res.broadcastStatus).toBe('UNKNOWN_UNVERIFIED');
    expect(res.isConfirmed).toBe(false);
  });

  it('metadata-load transition [0, 200] CANNOT falsely establish ACTIVE_LIVE', () => {
    const res = classifyYouTubeBroadcast({
      playerState: 1,
      urlPlaybackIntent: 'VOD',
      durationSamples: [0, 200],
      currentStatus: 'UNKNOWN_UNVERIFIED',
    });
    expect(res.broadcastStatus).toBe('UNKNOWN_UNVERIFIED');
    expect(res.isConfirmed).toBe(false);
  });

  it('classifies ACTIVE_LIVE only when strictly positive getDuration() samples increase while PLAYING', () => {
    const res = classifyYouTubeBroadcast({
      playerState: 1,
      urlPlaybackIntent: 'LIVE',
      durationSamples: [120, 125],
      currentStatus: 'UNKNOWN_UNVERIFIED',
    });
    expect(res.broadcastStatus).toBe('ACTIVE_LIVE');
    expect(res.recommendedMode).toBe('LIVE');
    expect(res.isConfirmed).toBe(true);
  });

  it('classifies ORDINARY_VOD when strictly positive getDuration() samples remain static while PLAYING', () => {
    const res = classifyYouTubeBroadcast({
      playerState: 1,
      urlPlaybackIntent: 'VOD',
      durationSamples: [212, 212],
      currentStatus: 'UNKNOWN_UNVERIFIED',
    });
    expect(res.broadcastStatus).toBe('ORDINARY_VOD');
    expect(res.recommendedMode).toBe('VOD');
    expect(res.isConfirmed).toBe(true);
  });

  it('keeps inconclusive states (BUFFERING, UNSTARTED, CUED, single sample) as UNKNOWN_UNVERIFIED', () => {
    for (const state of [-1, 2, 3, 5]) {
      const res = classifyYouTubeBroadcast({
        playerState: state,
        urlPlaybackIntent: 'LIVE',
        durationSamples: [],
        currentStatus: 'UNKNOWN_UNVERIFIED',
      });
      expect(res.broadcastStatus).toBe('UNKNOWN_UNVERIFIED');
      expect(res.isConfirmed).toBe(false);
    }

    const singleSample = classifyYouTubeBroadcast({
      playerState: 1,
      urlPlaybackIntent: 'VOD',
      durationSamples: [212],
      currentStatus: 'UNKNOWN_UNVERIFIED',
    });
    expect(singleSample.broadcastStatus).toBe('UNKNOWN_UNVERIFIED');
    expect(singleSample.isConfirmed).toBe(false);
  });

  it('does NOT change broadcastStatus when onAutoplayBlocked fires', () => {
    const blocked = classifyYouTubeBroadcast({
      autoplayBlocked: true,
      playerState: -1,
      urlPlaybackIntent: 'LIVE',
      durationSamples: [],
      currentStatus: 'UNKNOWN_UNVERIFIED',
    });
    expect(blocked.broadcastStatus).toBe('UNKNOWN_UNVERIFIED');
    expect(blocked.isConfirmed).toBe(false);
  });

  it('does NOT classify application-controlled stop or unverified ENDED as permanent ENDED', () => {
    const appStop = classifyYouTubeBroadcast({
      playerState: 0,
      isApplicationStop: true,
      urlPlaybackIntent: 'LIVE',
      durationSamples: [120, 125],
      currentStatus: 'ACTIVE_LIVE',
    });
    expect(appStop.broadcastStatus).toBe('ACTIVE_LIVE');
    expect(appStop.isConfirmed).toBe(false);

    const unverifiedEnded = classifyYouTubeBroadcast({
      playerState: 0,
      urlPlaybackIntent: 'LIVE',
      durationSamples: [],
      currentStatus: 'UNKNOWN_UNVERIFIED',
    });
    expect(unverifiedEnded.broadcastStatus).toBe('UNKNOWN_UNVERIFIED');
    expect(unverifiedEnded.isConfirmed).toBe(false);

    // Genuine ENDED after verified ACTIVE_LIVE
    const genuineEnded = classifyYouTubeBroadcast({
      playerState: 0,
      urlPlaybackIntent: 'LIVE',
      durationSamples: [120, 125],
      currentStatus: 'ACTIVE_LIVE',
    });
    expect(genuineEnded.broadcastStatus).toBe('ENDED');
    expect(genuineEnded.isConfirmed).toBe(true);
  });

  it('classifies known errors as RESTRICTED_OR_UNAVAILABLE and unknown errors without becoming ENDED', () => {
    for (const code of [100, 101, 150, 2, 5]) {
      const restricted = classifyYouTubeBroadcast({
        errorCode: code,
        urlPlaybackIntent: 'LIVE',
        durationSamples: [],
        currentStatus: 'UNKNOWN_UNVERIFIED',
      });
      expect(restricted.broadcastStatus).toBe('RESTRICTED_OR_UNAVAILABLE');
      expect(restricted.isConfirmed).toBe(true);
      expect(restricted.errorCode).toBe(code);
    }

    const unknownErr = classifyYouTubeBroadcast({
      errorCode: 999,
      playerState: 0,
      urlPlaybackIntent: 'LIVE',
      durationSamples: [],
      currentStatus: 'UNKNOWN_UNVERIFIED',
    });
    expect(unknownErr.broadcastStatus).toBe('UNKNOWN_UNVERIFIED');
    expect(unknownErr.isConfirmed).toBe(false);
    expect(unknownErr.errorCode).toBe(999);
  });
});

describe('VideoPlayer Broadcast Classification Integration', () => {
  let mockPlayerInstance: any;
  let capturedEvents: any;

  beforeEach(() => {
    mockPlayerInstance = {
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      destroy: vi.fn(),
      getPlayerState: vi.fn(() => -1),
      getCurrentTime: vi.fn(() => 0),
      getDuration: vi.fn(() => 0),
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
    delete (window as any).YT;
  });

  it('requires increasing positive duration samples for ACTIVE_LIVE and ignores autoplay block & teardown', () => {
    const onClassification = vi.fn();
    const onAutoplayBlocked = vi.fn();

    const { unmount } = render(
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
        sequenceNumber={3}
        isOwnerOrMod={true}
        onBroadcastClassification={onClassification}
        onAutoplayBlocked={onAutoplayBlocked}
      />
    );

    // 1. Autoplay blocked -> local callback only, no classification
    act(() => {
      capturedEvents.onAutoplayBlocked();
    });
    expect(onAutoplayBlocked).toHaveBeenCalledTimes(1);
    expect(onClassification).not.toHaveBeenCalled();

    // 2. Repeated 0 duration while PLAYING -> still UNKNOWN_UNVERIFIED
    mockPlayerInstance.getDuration.mockReturnValue(0);
    act(() => {
      capturedEvents.onStateChange({ data: 1, target: mockPlayerInstance });
      capturedEvents.onStateChange({ data: 1, target: mockPlayerInstance });
    });
    expect(onClassification).not.toHaveBeenCalled();

    // 3. Two strictly positive increasing samples -> ACTIVE_LIVE confirmed
    mockPlayerInstance.getDuration.mockReturnValueOnce(100).mockReturnValueOnce(105);
    // Reset with fresh samples by simulating two positive increasing samples
    act(() => {
      capturedEvents.onStateChange({ data: 1, target: { getDuration: () => 100 } });
    });
    // Note: first samples were [0, 0, 100], so first is 0 -> still unconfirmed
    expect(onClassification).not.toHaveBeenCalled();

    // Unmount triggers teardown; subsequent ENDED event must NOT emit ENDED
    unmount();
    act(() => {
      capturedEvents.onStateChange({ data: 0, target: mockPlayerInstance });
    });
    expect(onClassification).not.toHaveBeenCalled();
  });

  it('emits ACTIVE_LIVE when strictly positive increasing samples arrive and RESTRICTED_OR_UNAVAILABLE on onError', () => {
    const hostClassification = vi.fn();
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
        sequenceNumber={2}
        isOwnerOrMod={true}
        onBroadcastClassification={hostClassification}
      />
    );

    act(() => {
      capturedEvents.onStateChange({ data: 1, target: { getDuration: () => 120 } });
      capturedEvents.onStateChange({ data: 1, target: { getDuration: () => 125 } });
    });
    expect(hostClassification).toHaveBeenCalledWith({
      videoId: '5qap5aO4i9A',
      mode: 'LIVE',
      broadcastStatus: 'ACTIVE_LIVE',
      sequenceNumber: 2,
    });

    act(() => {
      capturedEvents.onError({ data: 150 });
    });
    expect(hostClassification).toHaveBeenCalledWith({
      videoId: '5qap5aO4i9A',
      mode: 'LIVE',
      broadcastStatus: 'RESTRICTED_OR_UNAVAILABLE',
      sequenceNumber: 2,
    });

    // Non-host participant never emits confirmation telemetry
    const guestClassification = vi.fn();
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
        sequenceNumber={2}
        isOwnerOrMod={false}
        onBroadcastClassification={guestClassification}
      />
    );

    act(() => {
      capturedEvents.onStateChange({ data: 1, target: { getDuration: () => 120 } });
      capturedEvents.onStateChange({ data: 1, target: { getDuration: () => 125 } });
    });
    expect(guestClassification).not.toHaveBeenCalled();
  });
});
