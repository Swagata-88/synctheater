import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard, isAsyncClipboardSupported } from '../src/lib/clipboard';

describe('Clipboard Utility (copyToClipboard)', () => {
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

  it('detects when Async Clipboard API is supported', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });

    expect(isAsyncClipboardSupported()).toBe(true);
  });

  it('detects when Async Clipboard API is not supported (undefined on HTTP/Android)', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(isAsyncClipboardSupported()).toBe(false);
  });

  it('copies successfully using modern navigator.clipboard.writeText', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    const result = await copyToClipboard('https://synctheater.com/room/movie-night');

    expect(result.success).toBe(true);
    expect(result.method).toBe('clipboard-api');
    expect(writeTextMock).toHaveBeenCalledWith('https://synctheater.com/room/movie-night');
  });

  it('falls back to document.execCommand when navigator.clipboard is undefined', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const result = await copyToClipboard('https://synctheater.com/room/test-room');

    expect(result.success).toBe(true);
    expect(result.method).toBe('execCommand');
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });

  it('falls back to document.execCommand when navigator.clipboard.writeText rejects (permission denied)', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('NotAllowedError: Permission denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const result = await copyToClipboard('https://synctheater.com/room/secure-room');

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.method).toBe('execCommand');
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });

  it('returns graceful failure without throwing when both copy methods fail', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    document.execCommand = vi.fn().mockReturnValue(false);

    const result = await copyToClipboard('https://synctheater.com/room/fail-room');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles empty text safely without crashing', async () => {
    const result = await copyToClipboard('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Empty text provided');
  });
});
