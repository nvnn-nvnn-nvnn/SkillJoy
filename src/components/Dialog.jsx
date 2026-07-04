import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// App dialog system — replaces the browser's native alert()/confirm() with an
// on-brand modal. Mount <DialogProvider> once near the root; call useDialog()
// anywhere to get { alert, confirm }.
//
//   const { confirm, alert } = useDialog();
//   if (!(await confirm({ title, message, danger:true }))) return;   // → boolean
//   await alert({ title:'Heads up', message:'…', tone:'warning' });  // → void
//
// Both accept a plain string as shorthand for { message }. `tone` is
// 'default' | 'warning' | 'danger' (styles the icon + confirm button).
// ─────────────────────────────────────────────────────────────────────────────

const DialogCtx = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useDialog() {
  const ctx = useContext(DialogCtx);
  if (!ctx) throw new Error('useDialog must be used inside <DialogProvider>');
  return ctx;
}

const normalize = (opts) => (typeof opts === 'string' ? { message: opts } : (opts || {}));

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);

  const settle = useCallback((result) => {
    setDialog(null);
    const r = resolver.current;
    resolver.current = null;
    if (r) r(result);
  }, []);

  const alert = useCallback((opts) => new Promise((res) => {
    resolver.current = res;
    setDialog({ mode: 'alert', tone: 'default', confirmLabel: 'OK', ...normalize(opts) });
  }), []);

  const confirm = useCallback((opts) => new Promise((res) => {
    resolver.current = res;
    const o = normalize(opts);
    setDialog({
      mode: 'confirm', tone: o.danger ? 'danger' : 'default',
      confirmLabel: 'Confirm', cancelLabel: 'Cancel', ...o,
    });
  }), []);

  return (
    <DialogCtx.Provider value={{ alert, confirm }}>
      {children}
      {dialog && (
        <DialogModal
          dialog={dialog}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </DialogCtx.Provider>
  );
}

const TONE_ICON = { default: 'ℹ️', warning: '⚠️', danger: '⚠️' };

function DialogModal({ dialog, onConfirm, onCancel }) {
  const { mode, tone, title, message, confirmLabel, cancelLabel } = dialog;
  const confirmRef = useRef(null);

  // Esc closes (cancel); focus the primary action on open.
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="dlg-backdrop" onMouseDown={onCancel}>
      <div className="dlg-card" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className={`dlg-icon dlg-icon-${tone}`}>{TONE_ICON[tone] ?? TONE_ICON.default}</div>
        {title && <h2 className="dlg-title">{title}</h2>}
        {message && <p className="dlg-message">{message}</p>}
        <div className="dlg-actions">
          {mode === 'confirm' && (
            <button className="dlg-btn dlg-btn-cancel" onClick={onCancel}>{cancelLabel}</button>
          )}
          <button ref={confirmRef}
            className={`dlg-btn ${tone === 'danger' ? 'dlg-btn-danger' : 'dlg-btn-confirm'}`}
            onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        .dlg-backdrop { position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px; background:rgba(20,18,12,.42); backdrop-filter:blur(2px); animation:dlg-bg .12s ease; }
        .dlg-card { width:100%; max-width:420px; background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg); box-shadow:var(--shadow-lg); padding:26px 24px 20px; text-align:center; animation:dlg-pop .16s cubic-bezier(.2,.8,.3,1); }
        .dlg-icon { width:52px; height:52px; margin:0 auto 14px; display:flex; align-items:center; justify-content:center; font-size:24px; border-radius:var(--r-full); }
        .dlg-icon-default { background:var(--accent-light); }
        .dlg-icon-warning { background:#FBF0D9; }
        .dlg-icon-danger  { background:#FBE4E0; }
        .dlg-title { font-size:19px; font-weight:800; font-family:var(--font-display); color:var(--text); margin-bottom:6px; }
        .dlg-message { font-size:14.5px; color:var(--text-secondary); line-height:1.55; margin:0 auto; max-width:34ch; }
        .dlg-actions { display:flex; gap:10px; justify-content:center; margin-top:22px; }
        .dlg-btn { flex:1; max-width:180px; padding:11px 18px; font-size:14px; font-weight:700; border-radius:var(--r-full); border:1.5px solid transparent; cursor:pointer; white-space:nowrap; transition:transform .1s ease, background .12s ease, border-color .12s ease; }
        .dlg-btn:active { transform:scale(.98); }
        .dlg-btn-confirm { background:var(--accent); color:var(--accent-foreground); }
        .dlg-btn-confirm:hover { background:var(--accent-hover); }
        .dlg-btn-danger { background:#CE4A3E; color:#fff; }
        .dlg-btn-danger:hover { background:#B33C31; }
        .dlg-btn-cancel { background:var(--surface); color:var(--text-secondary); border-color:var(--border-strong); }
        .dlg-btn-cancel:hover { border-color:var(--text-muted); color:var(--text); }
        .dlg-btn:focus-visible { outline:none; box-shadow:0 0 0 3px var(--accent-light); }
        @keyframes dlg-bg { from { opacity:0; } to { opacity:1; } }
        @keyframes dlg-pop { from { opacity:0; transform:translateY(8px) scale(.97); } to { opacity:1; transform:none; } }
      `}</style>
    </div>
  );
}
