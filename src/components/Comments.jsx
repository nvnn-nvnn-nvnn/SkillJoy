import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/stores';
import ReportModal from '@/components/ReportModal';
import { Flag, Trash2 } from 'lucide-react';

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Comments({ targetType, targetId }) {
    const user = useUser();
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [body, setBody] = useState('');
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState('');
    const [reportTarget, setReportTarget] = useState(null);

    useEffect(() => {
        if (!targetId) return;
        loadComments();
    }, [targetType, targetId]); // eslint-disable-line react-hooks/exhaustive-deps

    async function loadComments() {
        setLoading(true);
        const { data, error } = await supabase
            .from('comments')
            .select('id, body, created_at, author_id, author:profiles!author_id(id, full_name, avatar_url)')
            .eq('target_type', targetType)
            .eq('target_id', targetId)
            .order('created_at', { ascending: false });
        if (!error && data) setComments(data);
        setLoading(false);
    }

    async function handlePost(e) {
        e.preventDefault();
        const trimmed = body.trim();
        if (!trimmed) return;
        if (trimmed.length > 1000) { setError('Comment too long (max 1000 chars).'); return; }

        setPosting(true);
        setError('');
        const { data, error: insertError } = await supabase
            .from('comments')
            .insert({ author_id: user.id, target_type: targetType, target_id: targetId, body: trimmed })
            .select('id, body, created_at, author_id, author:profiles!author_id(id, full_name, avatar_url)')
            .single();

        setPosting(false);
        if (insertError) { setError(insertError.message); return; }
        setComments(prev => [data, ...prev]);
        setBody('');
    }

    async function handleDelete(commentId) {
        if (!window.confirm('Delete this comment?')) return;
        const { error: deleteError } = await supabase.from('comments').delete().eq('id', commentId).eq('author_id', user.id);
        if (deleteError) { setError(deleteError.message); return; }
        setComments(prev => prev.filter(c => c.id !== commentId));
    }

    return (
        <div className="cm-wrap">
            <div className="cm-header">
                <h3 className="cm-title">Comments</h3>
                <span className="cm-count">{comments.length}</span>
            </div>

            <form onSubmit={handlePost} className="cm-form">
                <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Leave a comment…"
                    maxLength={1000}
                    rows={2}
                    className="cm-input"
                />
                <div className="cm-form-row">
                    <span className="cm-counter">{body.length}/1000</span>
                    <button
                        type="submit"
                        className="cm-post-btn"
                        disabled={posting || !body.trim()}
                    >
                        {posting ? 'Posting…' : 'Post'}
                    </button>
                </div>
                {error && <p className="cm-error">{error}</p>}
            </form>

            {loading ? (
                <div className="cm-empty">Loading…</div>
            ) : comments.length === 0 ? (
                <div className="cm-empty">No comments yet. Be the first to leave one.</div>
            ) : (
                <ul className="cm-list">
                    {comments.map(c => (
                        <li key={c.id} className="cm-item">
                            <div className="cm-avatar">
                                {c.author?.avatar_url
                                    ? <img src={c.author.avatar_url} alt="" />
                                    : <span>{initials(c.author?.full_name)}</span>}
                            </div>
                            <div className="cm-body">
                                <div className="cm-meta">
                                    <Link to={`/profile/${c.author?.id}`} className="cm-author">
                                        {c.author?.full_name ?? 'Unknown'}
                                    </Link>
                                    <span className="cm-dot">·</span>
                                    <span className="cm-time">{timeAgo(c.created_at)}</span>
                                </div>
                                <p className="cm-text">{c.body}</p>
                                <div className="cm-actions">
                                    {c.author_id === user?.id ? (
                                        <button className="cm-action cm-action-delete" onClick={() => handleDelete(c.id)} title="Delete">
                                            <Trash2 size={13} /> Delete
                                        </button>
                                    ) : (
                                        <button className="cm-action" onClick={() => setReportTarget(c)} title="Report">
                                            <Flag size={13} /> Report
                                        </button>
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <ReportModal
                isOpen={!!reportTarget}
                onClose={() => setReportTarget(null)}
                reportedType="comment"
                reportedId={reportTarget?.id}
                reportedName={reportTarget?.body?.slice(0, 60) ?? ''}
            />

            <style>{`
                .cm-wrap {
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 14px;
                    padding: 22px 24px;
                    margin-top: 16px;
                }
                .cm-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
                .cm-title { font-size: 16px; font-weight: 700; margin: 0; }
                .cm-count {
                    font-size: 12px; font-weight: 600;
                    background: var(--surface-alt); color: var(--text-secondary);
                    padding: 2px 9px; border-radius: 100px;
                }
                .cm-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
                .cm-input {
                    width: 100%; padding: 10px 12px;
                    border: 1px solid var(--border); border-radius: 10px;
                    font-family: inherit; font-size: 14px; resize: vertical;
                    background: var(--surface); color: var(--text);
                    box-sizing: border-box; min-height: 60px;
                }
                .cm-input:focus { outline: none; border-color: var(--accent-mid); }
                .cm-form-row { display: flex; justify-content: space-between; align-items: center; }
                .cm-counter { font-size: 11px; color: var(--text-muted); }
                .cm-post-btn {
                    padding: 7px 18px; border-radius: 8px; border: none;
                    background: var(--accent); color: #fff;
                    font-size: 13px; font-weight: 600; cursor: pointer;
                    font-family: inherit; transition: background 0.14s;
                }
                .cm-post-btn:hover:not(:disabled) { background: var(--accent-hover); }
                .cm-post-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                .cm-error { color: #dc2626; font-size: 13px; margin: 4px 0 0; }
                .cm-empty { padding: 24px 0; text-align: center; color: var(--text-muted); font-size: 14px; }
                .cm-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 16px; }
                .cm-item { display: flex; gap: 12px; padding-top: 16px; border-top: 1px solid var(--border); }
                .cm-item:first-child { border-top: none; padding-top: 0; }
                .cm-avatar {
                    width: 36px; height: 36px; border-radius: 50%;
                    background: var(--surface-alt); border: 1px solid var(--border);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 12px; font-weight: 700; color: var(--text-secondary);
                    flex-shrink: 0; overflow: hidden;
                }
                .cm-avatar img { width: 100%; height: 100%; object-fit: cover; }
                .cm-body { flex: 1; min-width: 0; }
                .cm-meta { display: flex; align-items: center; gap: 6px; font-size: 13px; }
                .cm-author { font-weight: 600; color: var(--text); text-decoration: none; }
                .cm-author:hover { color: var(--accent); }
                .cm-dot { color: var(--text-muted); }
                .cm-time { color: var(--text-muted); font-size: 12px; }
                .cm-text { font-size: 14px; line-height: 1.5; margin: 4px 0 6px; color: var(--text); white-space: pre-wrap; word-break: break-word; }
                .cm-actions { display: flex; gap: 10px; }
                .cm-action {
                    display: inline-flex; align-items: center; gap: 4px;
                    background: none; border: none; padding: 0;
                    font-size: 12px; color: var(--text-muted); cursor: pointer;
                    font-family: inherit; transition: color 0.14s;
                }
                .cm-action:hover { color: var(--accent); }
                .cm-action-delete:hover { color: #dc2626; }
            `}</style>
        </div>
    );
}
