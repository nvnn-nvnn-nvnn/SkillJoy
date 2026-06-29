import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { listPosts, createPost, deletePost } from '@/lib/community';
import { initials } from '@/lib/stores';

// ── Per-Skill community space (v3) ──────────────────────────────────────────
// One lightweight thread per Skill: top-level posts + one level of replies.
// Buyer/creator gated by RLS. NOT a forum. Realtime so new posts appear live.

export default function CommunityThread({ skillId, creatorId, user }) {
  const [posts, setPosts] = useState(null);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyBody, setReplyBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    listPosts(skillId).then(setPosts).catch(e => setErr(e.message));
  }, [skillId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`community-${skillId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'community_posts', filter: `skill_id=eq.${skillId}` },
        () => load())
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [skillId, load]);

  async function post(parentId, text, reset) {
    const value = text.trim();
    if (!value) return;
    setBusy(true); setErr('');
    try {
      await createPost(skillId, user.id, value, parentId);
      notify(parentId, value);
      reset();
      setReplyTo(null);
      load(); // realtime will also fire; this is the optimistic refresh
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  // Best-effort: ping the creator on a new post, or the parent author on a reply.
  function notify(parentId, snippet) {
    let recipient, title, message;
    const short = snippet.slice(0, 80);
    if (!parentId) {
      if (creatorId === user.id) return; // creator posting in their own space
      recipient = creatorId;
      title = 'New community post';
      message = `Someone posted in your Skill's community: "${short}"`;
    } else {
      const parent = (posts ?? []).find(p => p.id === parentId);
      if (!parent || parent.author_id === user.id) return;
      recipient = parent.author_id;
      title = 'New reply';
      message = `Someone replied to your post: "${short}"`;
    }
    supabase.from('notifications')
      .insert({ user_id: recipient, type: 'community_reply', title, message, related_id: skillId, related_type: null })
      .then(({ error }) => { if (error) console.warn('community notify:', error.message); });
  }

  async function remove(postId) {
    if (!confirm('Delete this post?')) return;
    try { await deletePost(postId); load(); } catch (e) { setErr(e.message); }
  }

  // Group into top-level posts + their replies.
  const tops = (posts ?? []).filter(p => !p.parent_post_id);
  const repliesOf = (id) => (posts ?? []).filter(p => p.parent_post_id === id);

  function canDelete(p) {
    return p.author_id === user.id || creatorId === user.id;
  }

  return (
    <div className="ct">
      <h2 className="ct-h">💬 Community</h2>
      <p className="ct-sub">A private space for buyers and the creator of this Skill.</p>

      {/* New post */}
      <div className="ct-compose">
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={2}
          placeholder="Share a win, ask a question…" />
        <button className="btn btn-primary btn-sm" disabled={busy || !body.trim()}
          onClick={() => post(null, body, () => setBody(''))}>Post</button>
      </div>
      {err && <p className="ct-err">{err}</p>}

      {posts === null && <p className="ct-muted">Loading…</p>}
      {posts && tops.length === 0 && <p className="ct-muted">No posts yet — start the conversation.</p>}

      <div className="ct-list">
        {tops.map(p => (
          <div key={p.id} className="ct-post">
            <PostRow p={p} creatorId={creatorId} canDelete={canDelete(p)} onDelete={() => remove(p.id)} />
            <div className="ct-replies">
              {repliesOf(p.id).map(r => (
                <PostRow key={r.id} p={r} creatorId={creatorId} reply canDelete={canDelete(r)} onDelete={() => remove(r.id)} />
              ))}
              {replyTo === p.id ? (
                <div className="ct-replybox">
                  <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} rows={2} placeholder="Write a reply…" autoFocus />
                  <div className="ct-replybtns">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setReplyTo(null); setReplyBody(''); }}>Cancel</button>
                    <button className="btn btn-secondary btn-sm" disabled={busy || !replyBody.trim()}
                      onClick={() => post(p.id, replyBody, () => setReplyBody(''))}>Reply</button>
                  </div>
                </div>
              ) : (
                <button className="ct-replylink" onClick={() => { setReplyTo(p.id); setReplyBody(''); }}>Reply</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .ct { margin-top:8px; }
        .ct-h { font-size:18px; font-weight:700; }
        .ct-sub { color:var(--text-secondary); font-size:14px; margin:2px 0 16px; }
        .ct-muted { color:var(--text-muted); font-size:14px; }
        .ct-err { color:var(--accent); font-size:13px; }
        .ct-compose { display:flex; gap:10px; align-items:flex-end; margin-bottom:8px; }
        .ct-compose textarea { flex:1; resize:vertical; font-family:inherit; }
        .ct-list { display:flex; flex-direction:column; gap:14px; margin-top:14px; }
        .ct-post { border:1px solid var(--border); border-radius:var(--r-lg); padding:14px; background:var(--surface); }
        .ct-replies { margin-left:46px; margin-top:10px; display:flex; flex-direction:column; gap:10px; }
        .ct-replylink { align-self:flex-start; background:none; border:none; color:var(--text-muted); font-weight:600; font-size:13px; cursor:pointer; padding:0; }
        .ct-replylink:hover { color:var(--accent); }
        .ct-replybox textarea { width:100%; resize:vertical; font-family:inherit; }
        .ct-replybtns { display:flex; gap:8px; justify-content:flex-end; margin-top:8px; }
      `}</style>
    </div>
  );
}

function PostRow({ p, creatorId, reply, canDelete, onDelete }) {
  const name = p.author?.full_name || 'Member';
  const isCreator = p.author_id === creatorId;
  return (
    <div className="ctr">
      <div className="ctr-av" style={p.author?.avatar_url ? { backgroundImage: `url(${p.author.avatar_url})` } : {}}>
        {!p.author?.avatar_url && initials(name)}
      </div>
      <div className="ctr-body">
        <div className="ctr-head">
          <span className="ctr-name">{name}</span>
          {isCreator && <span className="ctr-badge">Creator</span>}
          <span className="ctr-time">{timeAgo(p.created_at)}</span>
          {canDelete && <button className="ctr-del" onClick={onDelete} aria-label="Delete">✕</button>}
        </div>
        <p className="ctr-text">{p.body}</p>
      </div>
      <style>{`
        .ctr { display:flex; gap:12px; }
        .ctr-av { width:${reply ? 30 : 36}px; height:${reply ? 30 : 36}px; flex-shrink:0; border-radius:50%; background:var(--accent-light) center/cover no-repeat; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; color:var(--accent); }
        .ctr-body { flex:1; min-width:0; }
        .ctr-head { display:flex; align-items:center; gap:8px; }
        .ctr-name { font-weight:700; font-size:14px; color:var(--text); }
        .ctr-badge { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--accent); background:var(--accent-light); padding:1px 7px; border-radius:var(--r-full); }
        .ctr-time { font-size:12px; color:var(--text-muted); }
        .ctr-del { margin-left:auto; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:12px; }
        .ctr-del:hover { color:var(--accent); }
        .ctr-text { margin-top:3px; color:var(--text-secondary); line-height:1.5; white-space:pre-wrap; word-break:break-word; }
      `}</style>
    </div>
  );
}

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}
