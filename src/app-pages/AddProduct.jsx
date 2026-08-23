import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/lib/stores';
import { createSkill } from '@/lib/skills';
import { PRODUCT_TYPES } from '@/lib/productTypes';
import BackLink from '@/components/BackLink';
import { useAuthGate } from '@/lib/useAuthGate';

// Phase A — dedicated, type-first "Add product" page (/build/new), modeled on
// Stan's Add-Product flow: you commit to WHAT you're making before you see any
// form. Picking a built type creates a draft skill of that kind and drops you
// into the tailored builder. Unbuilt types show "Soon" and can't be created yet.
export default function AddProduct() {
  const user = useUser();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(null); // kind id currently being created
  const [err, setErr] = useState('');

  const gate = useAuthGate();
  if (gate) return gate;

  async function pick(type) {
    if (!type.built || creating) return;
    setCreating(type.id);
    setErr('');
    try {
      const s = await createSkill(user.id, { kind: type.id, title: '' });
      navigate(`/build/${s.id}`);
    } catch (e) {
      setErr(e.message);
      setCreating(null);
    }
  }

  return (
    <div className="ap-wrap">
      <title>Add a product — SkillJoy</title>

      <BackLink to="/build">Back to products</BackLink>

      <header className="ap-head">
        <h1 className="ap-h1">What do you want to sell?</h1>
        <p className="ap-sub">Pick a product type to get started. You can change the details later — this just sets up the right builder for you.</p>
      </header>

      <div className={`ap-grid${creating ? " ap-grid-busy" : ""}`}>
        {PRODUCT_TYPES.map(t => {
          const Icon = t.icon;
          const busy = creating === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`ap-card${t.built ? "" : " ap-card-soon"}${busy ? " ap-card-busy" : ""}`}
              onClick={() => pick(t)}
              disabled={!t.built || !!creating}
              aria-disabled={!t.built}
              aria-busy={busy}
            >
              <span className="ap-icon"><Icon size={22} /></span>
              <span className="ap-name">
                {t.label}
                {!t.built && <span className="ap-soon">Soon</span>}
              </span>
              <span className="ap-blurb">{t.blurb}</span>
              {busy && <span className="ap-creating">Creating…</span>}
            </button>
          );
        })}
      </div>

      {err && <p className="ap-err">{err}</p>}

      <Styles />
    </div>
  );
}

function Styles() {
  return <style>{`
    .ap-wrap { max-width:760px; margin:0 auto; padding:40px 20px 96px; }
    .ap-head { margin-bottom:36px; }
    .ap-h1 { font-size:30px; font-weight:800; font-family:var(--font-display); color:var(--text); letter-spacing:-.01em; line-height:1.2; }
    .ap-sub { color:var(--text-secondary); font-size:15px; margin-top:12px; max-width:52ch; line-height:1.6; }

    .ap-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(228px,1fr)); gap:18px; }

    .ap-card { position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:12px; text-align:left; white-space:normal; padding:24px; min-width:0; overflow-wrap:anywhere; border:1.5px solid var(--border); border-radius:var(--r-lg); background:var(--surface); cursor:pointer; box-shadow:var(--shadow-sm); transition:transform .12s ease, box-shadow .12s ease, border-color .12s ease; }
    .ap-card:hover:not(:disabled) { transform:translateY(-3px); box-shadow:var(--shadow-lg); border-color:var(--accent-mid); }
    .ap-card:focus-visible { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgb(var(--accent-rgb) / 0.30); }
    .ap-card:disabled { cursor:default; }
    .ap-card-soon { opacity:.62; background:var(--surface-alt); box-shadow:none; }

    .ap-icon { display:flex; align-items:center; justify-content:center; width:44px; height:44px; border-radius:var(--r); background:var(--accent-light); color:var(--accent-hover); }
    .ap-card-soon .ap-icon { background:var(--border); color:var(--text-muted); }

    .ap-name { width:100%; display:flex; align-items:center; flex-wrap:wrap; gap:8px; font-weight:700; font-size:16px; color:var(--text); }
    .ap-soon { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); background:var(--border); padding:2px 7px; border-radius:var(--r-full); }
    .ap-blurb { width:100%; font-size:13px; color:var(--text-secondary); line-height:1.55; }
    /* Absolutely positioned so appearing mid-create does not grow the card and
       shove the grid around. The card is already position:relative. */
    .ap-creating { position:absolute; top:12px; right:12px; font-size:11px; font-weight:800; letter-spacing:.03em;
                   color:var(--accent-hover); background:var(--accent-light); border-radius:var(--r-full); padding:3px 9px; }

    /* While one card is creating, every card is disabled — say so visually
       instead of leaving them looking clickable. */
    .ap-grid-busy .ap-card:not(.ap-card-busy) { opacity:.45; }
    .ap-grid-busy .ap-card:not(.ap-card-busy):hover { transform:none; box-shadow:var(--shadow-sm); border-color:var(--border); }
    .ap-card-busy { border-color:var(--accent); box-shadow:var(--shadow-lg); }

    .ap-err { margin-top:18px; color:var(--danger-hover); background:var(--danger-light); border:1px solid var(--danger-mid); border-radius:var(--r-sm); padding:10px 14px; font-size:14px; }

    @media (max-width:520px) { .ap-h1 { font-size:24px; } .ap-grid { grid-template-columns:1fr; } }
  `}</style>;
}
