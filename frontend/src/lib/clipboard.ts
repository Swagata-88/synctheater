/**
 * SYNCTHEATER - Cross-Platform Resilient Clipboard Utility
 * 
 * Provides safe, feature-detected clipboard copy operations supporting:
 * 1. Modern Async Clipboard API (navigator.clipboard.writeText) in Secure Contexts.
 * 2. Fallback to document.execCommand('copy') with off-screen element for Android / HTTP / non-secure contexts.
 * 3. Graceful degradation without uncaught runtime errors.
 */

export interface CopyResult {
  success: boolean;
  method?: 'clipboard-api' | 'execCommand';
  error?: string;
}

/**
 * Checks if modern Async Clipboard API is available in the current environment
 */
export function isAsyncClipboardSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard !== 'undefined' &&
    typeof navigator.clipboard.writeText === 'function'
  );
}

/**
 * Copies text to clipboard with automatic feature detection and multi-layer fallback.
 * Never throws exceptions - always returns a resolved CopyResult.
 */
export async function copyToClipboard(text: string): Promise<CopyResult> {
  if (!text) {
    return { success: false, error: 'Empty text provided' };
  }

  // Layer 1: Modern Async Clipboard API
  if (isAsyncClipboardSupported()) {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true, method: 'clipboard-api' };
    } catch (err: unknown) {
      // Modern clipboard can reject with NotAllowedError (permission denied)
      // or SecurityError in non-secure or unfocused contexts.
      console.warn('Async Clipboard API failed or permission rejected, attempting fallback:', err);
    }
  }

  // Layer 2: Legacy execCommand('copy') fallback for Android HTTP / webviews
  if (typeof document !== 'undefined') {
    let textarea: HTMLTextAreaElement | null = null;
    try {
      textarea = document.createElement('textarea');
      textarea.value = text;
      // Position offscreen without causing scroll jumps or layout shifts on mobile
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '2em';
      textarea.style.height = '2em';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      textarea.setAttribute('readonly', '');
      textarea.setAttribute('aria-hidden', 'true');
      
      document.body.appendChild(textarea);

      textarea.focus();
      textarea.select();
      // Required for mobile devices (iOS/Android)
      textarea.setSelectionRange(0, text.length);

      const successful = document.execCommand('copy');
      if (successful) {
        return { success: true, method: 'execCommand' };
      }
    } catch (err: unknown) {
      console.warn('document.execCommand fallback copy failed:', err);
    } finally {
      if (textarea && textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
    }
  }

  return { success: false, error: 'Clipboard copy unavailable' };
}
