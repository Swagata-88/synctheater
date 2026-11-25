/**
 * Cross-browser Fullscreen and Screen Orientation helpers.
 * Handles standard Fullscreen API, WebKit prefixes (iOS/Safari),
 * Screen Orientation locking after entering fullscreen, and
 * graceful CSS-fullscreen fallback when native APIs are unavailable.
 */

export type FullscreenMode = 'native' | 'webkit-video' | 'fallback';

export function getNativeFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export async function tryLockLandscape(): Promise<boolean> {
  if (typeof screen === 'undefined' || !screen.orientation) return false;
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: 'landscape' | 'portrait' | 'any') => Promise<void>;
  };
  if (typeof orientation.lock !== 'function') return false;
  try {
    await orientation.lock('landscape');
    return true;
  } catch {
    return false;
  }
}

export function tryUnlockOrientation(): void {
  if (typeof screen === 'undefined' || !screen.orientation) return;
  try {
    if (typeof screen.orientation.unlock === 'function') {
      screen.orientation.unlock();
    }
  } catch {
    // Ignore on browsers/devices that do not support unlock()
  }
}

export async function enterElementFullscreen(
  container: HTMLElement,
  videoEl?: HTMLVideoElement | null
): Promise<FullscreenMode> {
  const el = container as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };

  if (typeof el.requestFullscreen === 'function') {
    try {
      await el.requestFullscreen();
      return 'native';
    } catch {
      // Fall through to webkit/video/CSS fallback
    }
  } else if (typeof el.webkitRequestFullscreen === 'function') {
    try {
      await el.webkitRequestFullscreen();
      return 'native';
    } catch {
      // Fall through to video/CSS fallback
    }
  }

  if (videoEl) {
    const webkitVideo = videoEl as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    };
    if (typeof webkitVideo.webkitEnterFullscreen === 'function') {
      try {
        webkitVideo.webkitEnterFullscreen();
        return 'webkit-video';
      } catch {
        // Fall through to CSS fallback
      }
    }
  }

  return 'fallback';
}

export async function exitElementFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
  };
  if (!getNativeFullscreenElement()) return;

  try {
    if (typeof doc.exitFullscreen === 'function') {
      await doc.exitFullscreen();
    } else if (typeof doc.webkitExitFullscreen === 'function') {
      await doc.webkitExitFullscreen();
    }
  } catch {
    // Ignore if already exited
  }
}
