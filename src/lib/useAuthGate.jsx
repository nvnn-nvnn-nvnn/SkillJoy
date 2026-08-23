import { Link, useLocation } from 'react-router-dom';
import { Lock, ArrowRight, Sparkles } from 'lucide-react';
import { useUser, useAuth } from '@/lib/stores';

// ── Signed-out gate for creator surfaces ────────────────────────────────────
//
// Replaces four inconsistent hand-rolled guards, two of which were broken:
//
//   SkillBuilder   if (!user) return null;   ← blank white page
//   AddProduct     if (!user) return null;   ← blank white page
//   LessonEditor   "Please log in."          ← dead end, no way to sign up
//   ServicesDash   "Please log in to…"       ← dead end
//
// The subtler bug all four shared: `user` is null while auth is still LOADING
// (stores.jsx starts with user=null, loading=true). So a signed-IN creator
// reloading /build/abc got a flash of "please log in" — or a blank screen —
// before their own page appeared. Checking `loading` first is the whole fix,
// and it's the same trap PhoneLock hit on the products dashboard.
//
// Usage:  const gate = useAuthGate(); if (gate) return gate;
//
// A hook rather than a wrapper component: these pages compute state before
// their first return, so wrapping them would mean hoisting all of that or
// calling hooks conditionally.

/**
 * Returns a node to render INSTEAD of the page (loading or signed-out), or
 * null when the user is authenticated and the page should render normally.
 *
 * A hook rather than only a wrapper because these pages compute state before
 * their first return, and wrapping them would mean either hoisting all of that
 * or calling hooks conditionally.
 */
export function useAuthGate() {
    const user = useUser();
    const { loading } = useAuth();
    const { pathname } = useLocation();

    if (loading) {
        return (
            <div className="ra ra-loading" role="status" aria-live="polite">
                <span className="ra-spinner" aria-hidden="true" />
                <p className="ra-loadingtext">Loading…</p>
                <style>{RA_CSS}</style>
            </div>
        );
    }
    if (user) return null;

    return (
        <div className="ra">
            <div className="ra-card">
                <span className="ra-badge"><Lock size={20} /></span>
                <h1 className="ra-title">Sign in to start building</h1>
                <p className="ra-lede">
                    This is where you create and manage everything you sell. Make an account and
                    you&rsquo;ll have a page at your own link in about a minute.
                </p>

                <ul className="ra-perks">
                    <li><Sparkles size={14} /> Free to build and customize</li>
                    <li><Sparkles size={14} /> Your own skilljoy.me link</li>
                    <li><Sparkles size={14} /> Only pay when you start selling</li>
                </ul>

                {/* Carries the intended destination so signing in returns here
                    instead of dumping people on a generic dashboard. */}
                <Link className="ra-cta" to={`/login?next=${encodeURIComponent(pathname)}`}>
                    Get started <ArrowRight size={15} />
                </Link>
                <p className="ra-alt">
                    Already have an account?{' '}
                    <Link to={`/login?next=${encodeURIComponent(pathname)}`}>Sign in</Link>
                </p>
            </div>
            <style>{RA_CSS}</style>
        </div>
    );
}

const RA_CSS = `
    .ra { display:flex; align-items:center; justify-content:center; padding:56px 20px 96px; min-height:60vh; }
    .ra-loading { flex-direction:column; gap:12px; }
    .ra-spinner { width:26px; height:26px; border-radius:var(--r-full);
      border:2.5px solid var(--border); border-top-color:var(--accent); animation:raSpin .7s linear infinite; }
    @keyframes raSpin { to { transform:rotate(360deg); } }
    .ra-loadingtext { font-size:14px; color:var(--text-muted); margin:0; }

    .ra-card { width:100%; max-width:460px; text-align:center; padding:38px 30px 30px;
      background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg); box-shadow:var(--shadow-lg); }
    .ra-badge { display:inline-flex; align-items:center; justify-content:center; width:50px; height:50px;
      border-radius:var(--r-full); background:var(--accent-light); color:var(--accent-hover); margin-bottom:18px; }
    .ra-title { font-size:23px; font-weight:800; letter-spacing:-.015em; line-height:1.25; color:var(--text);
      font-family:var(--font-display); margin:0 0 10px; }
    .ra-lede { font-size:14.5px; line-height:1.65; color:var(--text-secondary); margin:0 auto 22px; max-width:40ch; }

    .ra-perks { list-style:none; margin:0 0 24px; padding:0; display:inline-flex; flex-direction:column;
      gap:9px; text-align:left; }
    .ra-perks li { display:flex; gap:9px; align-items:center; font-size:13.5px; color:var(--text-secondary); }
    .ra-perks svg { flex-shrink:0; color:var(--accent); }

    .ra-cta { display:inline-flex; align-items:center; justify-content:center; gap:8px; width:100%;
      padding:13px 24px; border-radius:var(--r-full); background:var(--accent); color:var(--accent-foreground);
      font-size:15px; font-weight:700; text-decoration:none; transition:background .15s ease; }
    .ra-cta:hover { background:var(--accent-hover); text-decoration:none; color:var(--accent-foreground); }
    .ra-alt { font-size:13px; color:var(--text-muted); margin:14px 0 0; }
    .ra-alt a { color:var(--accent); font-weight:700; text-decoration:underline; text-underline-offset:2px; }

    @media (prefers-reduced-motion: reduce) { .ra-spinner { animation:none; } }
  `;
