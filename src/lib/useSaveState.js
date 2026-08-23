import { useState, useRef, useCallback, useEffect } from 'react';

// ── Autosave status, as a real state machine ────────────────────────────────
//
// Replaces the `savedAt ? 'Saved ✓' : ''` pattern, which had one fatal flaw:
// savedAt was set once on the first success and never cleared, so the indicator
// read "Saved ✓" permanently — during the debounce window when edits were NOT
// yet saved, and after a save that FAILED. Success and failure looked identical,
// and the only trace of a failure was a console.warn nobody reads.
//
// Four states, and the distinction that matters is `dirty` vs `saved`:
//   idle    nothing to save, nothing saved yet this session
//   dirty   edits exist that have NOT reached the server (debounce pending)
//   saving  a request is in flight
//   saved   the server has everything (cleared the moment you type again)
//   error   the last write failed — the patch is still held, not lost
export function useSaveState() {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  // Guards against a late response from an aborted/unmounted editor flipping
  // the indicator back to "saved" after the user has navigated away.
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const markDirty = useCallback(() => {
    if (!alive.current) return;
    // A failed save stays visible until it actually succeeds — typing again
    // shouldn't quietly erase the fact that something didn't persist.
    setStatus(s => (s === 'error' ? 'error' : 'dirty'));
  }, []);

  const markSaving = useCallback(() => { if (alive.current) setStatus('saving'); }, []);

  const markSaved = useCallback(() => {
    if (!alive.current) return;
    setStatus('saved');
    setError('');
  }, []);

  const markError = useCallback((message) => {
    if (!alive.current) return;
    setStatus('error');
    setError(message || 'Couldn’t save.');
  }, []);

  return { status, error, markDirty, markSaving, markSaved, markError };
}
