import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoPlayer } from '../src/components/theater/VideoPlayer';

describe('VideoPlayer Component & Provider Handling', () => {
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
