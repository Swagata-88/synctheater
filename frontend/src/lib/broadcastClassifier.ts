import { BroadcastStatus, PlaybackMode } from '../types';

export interface BroadcastClassificationInput {
  playerState?: number; // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
  errorCode?: number; // YT.PlayerError: 2, 5, 100, 101, 150, or unknown
  autoplayBlocked?: boolean;
  isApplicationStop?: boolean; // true during player destroy, video change, or app-controlled stop
  urlPlaybackIntent: PlaybackMode;
  durationSamples: number[]; // successive getDuration() values observed while PLAYING
  currentStatus: BroadcastStatus;
}

export interface BroadcastClassificationResult {
  broadcastStatus: BroadcastStatus;
  recommendedMode: PlaybackMode;
  isConfirmed: boolean;
  errorCode?: number;
}

const RESTRICTED_ERROR_CODES = new Set([2, 5, 100, 101, 150]);

/**
 * Evidence-based runtime broadcast classification for YouTube IFrame Player events.
 *
 * Rules:
 * - Inconclusive evidence remains UNKNOWN_UNVERIFIED.
 * - /live/ URL intent, PLAYING alone, or repeated zero-duration samples do NOT prove ACTIVE_LIVE.
 * - ACTIVE_LIVE requires strictly positive, increasing getDuration() samples (first > 0 && latest > first) while PLAYING.
 * - ORDINARY_VOD requires static positive getDuration() samples (first > 0 && latest === first) while PLAYING.
 * - SCHEDULED_OR_WAITING is never inferred without a verified API source (remains UNKNOWN_UNVERIFIED).
 * - onAutoplayBlocked is a local browser permission constraint and never alters broadcastStatus.
 * - Application-controlled stops/teardowns never classify as ENDED.
 * - Any errorCode (known or unknown) is preserved for diagnostics and never becomes ENDED.
 */
export function classifyYouTubeBroadcast(
  input: BroadcastClassificationInput
): BroadcastClassificationResult {
  const {
    playerState,
    errorCode,
    autoplayBlocked,
    isApplicationStop,
    urlPlaybackIntent,
    durationSamples,
    currentStatus,
  } = input;

  // 1. Player error events: preserve errorCode and never classify as ENDED
  if (errorCode !== undefined) {
    if (RESTRICTED_ERROR_CODES.has(errorCode)) {
      return {
        broadcastStatus: 'RESTRICTED_OR_UNAVAILABLE',
        recommendedMode: urlPlaybackIntent,
        isConfirmed: true,
        errorCode,
      };
    }
    return {
      broadcastStatus: currentStatus,
      recommendedMode: urlPlaybackIntent,
      isConfirmed: false,
      errorCode,
    };
  }

  // 2. Local browser autoplay blocking never alters broadcast classification
  if (autoplayBlocked) {
    return {
      broadcastStatus: currentStatus,
      recommendedMode: urlPlaybackIntent,
      isConfirmed: false,
    };
  }

  // 3. Application-controlled stop, player replacement, or teardown never establishes ENDED
  if (isApplicationStop) {
    return {
      broadcastStatus: currentStatus,
      recommendedMode: urlPlaybackIntent,
      isConfirmed: false,
    };
  }

  // 4. Broadcast ENDED: only confirm if a genuine active/VOD stream was already verified
  if (playerState === 0) {
    if (currentStatus === 'ACTIVE_LIVE' || currentStatus === 'ORDINARY_VOD') {
      return {
        broadcastStatus: 'ENDED',
        recommendedMode: urlPlaybackIntent,
        isConfirmed: true,
      };
    }
    return {
      broadcastStatus: 'UNKNOWN_UNVERIFIED',
      recommendedMode: urlPlaybackIntent,
      isConfirmed: false,
    };
  }

  // 5. UNSTARTED (-1), CUED (5), PAUSED (2), or BUFFERING (3) alone are inconclusive
  if (playerState !== 1) {
    return {
      broadcastStatus: currentStatus,
      recommendedMode: urlPlaybackIntent,
      isConfirmed: false,
    };
  }

  // 6. Active PLAYING (1): require >= 2 strictly positive getDuration() samples
  //    - Increasing strictly positive samples (first > 0 && latest > first) => ACTIVE_LIVE
  //    - Static strictly positive samples (first > 0 && latest === first) => ORDINARY_VOD
  //    - Zero-duration samples or [0, positive] metadata-load transitions remain UNKNOWN_UNVERIFIED
  const positiveSamples = durationSamples.filter((d) => Number.isFinite(d) && d > 0);
  if (positiveSamples.length >= 2) {
    const first = positiveSamples[0];
    const latest = positiveSamples[positiveSamples.length - 1];

    if (latest > first) {
      return {
        broadcastStatus: 'ACTIVE_LIVE',
        recommendedMode: 'LIVE',
        isConfirmed: true,
      };
    }

    if (latest === first) {
      return {
        broadcastStatus: 'ORDINARY_VOD',
        recommendedMode: 'VOD',
        isConfirmed: true,
      };
    }
  }

  return {
    broadcastStatus: currentStatus,
    recommendedMode: urlPlaybackIntent,
    isConfirmed: false,
  };
}
