import { AlertCircle, Check, Loader2 } from 'lucide-react';

// Visible autosave state. Pairs with useSaveState().
//
// The design rule: "saved" must be the ONLY state that looks reassuring. An
// unsaved edit and a failed save each have to look different from success,
// because the old indicator's whole problem was that everything looked like
// success. `onRetry` is offered on error so a failure is recoverable in place
// rather than by guessing which field didn't stick.
export default function SaveStatus({ status, error, onRetry }) {
  if (status === 'idle') return null;

  return (
    <span className={`svst svst-${status}`} role={status === 'error' ? 'alert' : 'status'}>
      {status === 'dirty' && <>Unsaved changes</>}
      {status === 'saving' && <><Loader2 size={13} className="svst-spin" /> Saving…</>}
      {status === 'saved' && <><Check size={13} /> Saved</>}
      {status === 'error' && (
        <>
          <AlertCircle size={13} />
          <span className="svst-msg">{error || 'Couldn’t save'}</span>
          {onRetry && <button type="button" className="svst-retry" onClick={onRetry}>Retry</button>}
        </>
      )}
      <style>{`
        .svst { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; white-space:nowrap; }
        .svst-dirty  { color:var(--text-muted); }
        .svst-saving { color:var(--text-muted); }
        .svst-saved  { color:var(--green, #3d8168); }
        /* Error is the one state allowed to wrap and take space — it carries a
           message and an action, and must not be squeezed to an ellipsis. */
        .svst-error  { color:var(--danger); background:var(--danger-light); border:1px solid var(--danger-mid);
                       border-radius:var(--r-full); padding:4px 10px; white-space:normal; }
        .svst-msg { font-weight:600; }
        .svst-retry { border:none; background:none; padding:0 0 0 2px; font-size:12.5px; font-weight:800;
                      color:var(--danger); text-decoration:underline; cursor:pointer; }
        .svst-spin { animation:svst-rot 0.8s linear infinite; }
        @keyframes svst-rot { to { transform:rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .svst-spin { animation:none; } }
      `}</style>
    </span>
  );
}
