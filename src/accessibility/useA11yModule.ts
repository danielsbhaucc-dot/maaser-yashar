import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

const ENDPOINT = '/api/module-status';
const POLL_MS = 60_000;

/** Keep built-in access on until a valid central assignment is received. */
export function useA11yModule() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let controller: AbortController | null = null;
    let mounted = true;
    const refresh = async () => {
      if (!mounted || controller || AppState.currentState === 'background') return;
      const request = new AbortController();
      controller = request;
      const timeout = setTimeout(() => request.abort(), 5500);
      try {
        const url = Platform.OS === 'web' ? ENDPOINT : `https://maaser-yashar.netlify.app${ENDPOINT}`;
        const response = await fetch(url, { signal: request.signal });
        if (!response.ok) return;
        const result: { a11y?: unknown } = await response.json();
        if (mounted && !request.signal.aborted && typeof result.a11y === 'boolean') setEnabled(result.a11y);
      } catch {
        // Keep the last valid runtime assignment during a temporary outage.
      } finally {
        clearTimeout(timeout);
        if (controller === request) controller = null;
      }
    };
    void refresh();
    const interval = setInterval(refresh, POLL_MS);
    const appState = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => {
      mounted = false;
      clearInterval(interval);
      appState.remove();
      controller?.abort();
    };
  }, []);
  return enabled;
}
