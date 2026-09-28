/**
 * רישום service worker + האזנה ל־beforeinstallprompt (ווב בלבד).
 */
export type BeforeInstallPromptLike = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptLike;
  }
  interface Window {
    __maaserDeferredInstall?: BeforeInstallPromptLike | null;
    __maaserInstallListeners?: Set<(e: BeforeInstallPromptLike | null) => void>;
  }
}

let registered = false;

export function registerWebPwa(): void {
  if (typeof window === 'undefined' || registered) return;
  registered = true;

  window.__maaserInstallListeners = window.__maaserInstallListeners ?? new Set();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__maaserDeferredInstall = e;
    window.__maaserInstallListeners?.forEach((fn) => fn(e));
  });

  window.addEventListener('appinstalled', () => {
    window.__maaserDeferredInstall = null;
    window.__maaserInstallListeners?.forEach((fn) => fn(null));
  });

  if ('serviceWorker' in navigator) {
    const run = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    };
    if (document.readyState === 'complete') run();
    else window.addEventListener('load', run, { once: true });
  }
}

export function subscribeInstallPrompt(
  listener: (e: BeforeInstallPromptLike | null) => void
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const set = window.__maaserInstallListeners ?? new Set();
  window.__maaserInstallListeners = set;
  set.add(listener);
  if (window.__maaserDeferredInstall) listener(window.__maaserDeferredInstall);
  return () => {
    set.delete(listener);
  };
}

export function getDeferredInstall(): BeforeInstallPromptLike | null {
  if (typeof window === 'undefined') return null;
  return window.__maaserDeferredInstall ?? null;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !!(mq || ios);
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const chrome = /CriOS|Chrome|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && !chrome;
}
