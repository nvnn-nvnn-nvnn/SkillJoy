import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile, getSkillName } from '@/lib/stores';

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MySwaps() {
    const user = useUser();
    const profile = useProfile();
    const navigate = useNavigate();

    const [tab, setTab] = useState('received');
    const [received, setReceived] = useState([]);
    const [sent, setSent] = useState([]);
    const [completed, setCompleted] = useState([]);
    const [busy, setBusy] = useState(true);
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('success');
    const [selectedSwap, setSelectedSwap] = useState(null);
    const [selectedProfile, setSelectedProfile] = useState(null);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        loadSwaps();
    }, [user]);

    async function loadSwaps() {
        setBusy(true);
        const { data, error } = await supabase
            .from('swaps')
            .select(`
                *,
                requester:profiles!requester_id(*),
                receiver:profiles!receiver_id(*)
            `)
            .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setReceived(data.filter(s => s.receiver_id === user.id && s.status !== 'completed'));
            setSent(data.filter(s => s.requester_id === user.id && s.status !== 'completed'));
            setCompleted(data.filter(s => s.status === 'completed'));
        }
        setBusy(false);
    }

    function showToast(msg, type = 'success') {
        setToast(msg);
        setToastType(type);
        setTimeout(() => setToast(''), 3500);
    }

    async function respond(swapId, status) {
        const { error: e } = await supabase.from('swaps').update({ status }).eq('id', swapId);
        if (e) { showToast(e.message, 'error'); return; }
        await loadSwaps();
        showToast(status === 'accepted' ? 'Swap accepted!' : 'Swap declined.', 'success');
    }

    async function handleRemoveSwap(swapId) {
        const { error: e } = await supabase.from('swaps').delete().eq('id', swapId);
        if (e) { showToast(e.message, 'error'); return; }
        await loadSwaps();
        showToast('Swap removed.', 'success');
    }

    function openChat(swapId) {
        navigate(`/chat?swap=${swapId}`);
    }

    function starsFor(skillsTeach, skillName) {
        if (!skillsTeach) return null;
        const entry = skillsTeach.find(s => (typeof s === 'string' ? s : s.name) === skillName);
        if (!entry) return null;
        return typeof entry === 'string' ? 3 : (entry.stars ?? 3);
    }

    function openProfileModal(swap, otherProfile) {
        setSelectedSwap(swap);
        setSelectedProfile(otherProfile);
    }

    function closeModal() {
        setSelectedSwap(null);
        setSelectedProfile(null);
    }

    function getCompletionCount(swap) {
        if (!swap) return 0;
        let count = 0;
        if (swap.requester_completed) count++;
        if (swap.receiver_completed) count++;
        return count;
    }

    async function markSwapComplete(swapId) {
        const swap = [...received, ...sent].find(s => s.id === swapId);
        if (!swap) return;
        const isRequester = swap.requester_id === user.id;
        const fieldToUpdate = isRequester ? 'requester_completed' : 'receiver_completed';
        const otherFieldCompleted = isRequester ? swap.receiver_completed : swap.requester_completed;
        const updates = { [fieldToUpdate]: true };
        if (otherFieldCompleted) {
            updates.status = 'completed';
            const teacherSkillEntry = swap.requester?.skills_teach?.find(s => (typeof s === 'string' ? s : s.name) === swap.teach_skill);
            const teacherStars = teacherSkillEntry ? (typeof teacherSkillEntry === 'string' ? 3 : teacherSkillEntry.stars ?? 3) : 3;
            const requesterPoints = 50;
            const receiverPoints = 30 + (teacherStars * 10);
            await Promise.all([
                supabase.rpc('increment_points', { user_id: swap.requester_id, points: requesterPoints }),
                supabase.rpc('increment_points', { user_id: swap.receiver_id, points: receiverPoints }),
            ]);
        }
        const { error: e } = await supabase.from('swaps').update(updates).eq('id', swapId);
        if (e) { showToast(e.message, 'error'); return; }
        await loadSwaps();
        closeModal();
        if (otherFieldCompleted) {
            showToast('Swap completed! Points awarded.', 'success');
        } else {
            showToast('Marked as complete. Waiting for other party. (1/2)', 'success');
        }
    }

    const activeList = tab === 'received' ? received : tab === 'sent' ? sent : completed;
    const pendingCount = received.filter(s => s.status === 'pending').length;

    return (
        <>
            <title>My Swaps — SkillJoy</title>

            <div className="page">
                <div className='swaps-hero-section'>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <h1 className="page-title">My Swaps</h1>
                            <p className="page-subtitle" style={{ color: '#000' }}>Manage your skill exchange proposals</p>
                        </div>
                        <button className="btn btn-secondary" style={{ backgroundColor: '#fff', border: '1px solid #000' }} onClick={() => navigate('/swaps')}>
                            ← Back to Discover
                        </button>
                    </div>

                    <div className="tabs" style={{ border: "1px solid #000", backgroundColor: "#ec9146" }}>
                        <button className={`tab ${tab === 'received' ? 'active' : ''}`} onClick={() => setTab('received')}>
                            Received
                            {pendingCount > 0 && <span className="pending-dot">{pendingCount}</span>}
                        </button>
                        <button className={`tab ${tab === 'sent' ? 'active' : ''}`} onClick={() => setTab('sent')}>
                            Sent
                        </button>
                        <button className={`tab ${tab === 'completed' ? 'active' : ''}`} onClick={() => setTab('completed')}>
                            Completed
                        </button>
                    </div>


                </div>

                {busy ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                    </div>
                ) : activeList.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">{tab === 'received' ? '📬' : '📮'}</span>
                        <h3>{tab === 'received' ? 'No requests yet' : tab === 'sent' ? 'No proposals sent' : 'No completed swaps'}</h3>
                        <p>{tab === 'received' ? "When someone proposes a swap with you, it'll appear here." : tab === 'sent' ? 'Go discover users and propose a skill swap!' : 'Completed swaps will appear here.'}</p>
                    </div>
                ) : (
                    <div className="swaps-list">
                        {activeList.map((swap) => {
                            const other = tab === 'received' ? swap.requester : swap.receiver;
                            const teacherProf = tab === 'received' ? swap.requester : profile;
                            const learnerProf = tab === 'received' ? profile : swap.receiver;
                            const teachStars = starsFor(teacherProf?.skills_teach, swap.teach_skill);
                            const learnStars = starsFor(learnerProf?.skills_teach, swap.learn_skill);
                            return (
                                <div key={swap.id} className="swap-card">
                                    <div className="swap-header">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div className="avatar">{initials(other?.full_name)}</div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <button className="swap-name-btn" onClick={() => openProfileModal(swap, other)}>
                                                        {other?.full_name ?? 'Unknown'}
                                                    </button>
                                                    <span className={`badge badge-${swap.status}`}>{swap.status}</span>
                                                </div>
                                                <p className="swap-date">{formatDate(swap.created_at)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="swap-skills">
                                        <div className="swap-skill-item">
                                            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                                                {tab === 'received' ? 'They teach you' : 'You teach them'}
                                            </span>
                                            <span className="skill-tag skill-teach">{swap.teach_skill}</span>
                                            {teachStars && <div style={{ marginTop: 4 }}>{'⭐'.repeat(teachStars)}</div>}
                                        </div>
                                        <div className="swap-exchange-icon">⇄</div>
                                        <div className="swap-skill-item">
                                            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                                                {tab === 'received' ? 'You teach them' : 'They teach you'}
                                            </span>
                                            <span className="skill-tag skill-learn">{swap.learn_skill}</span>
                                            {learnStars && <div style={{ marginTop: 4 }}>{'⭐'.repeat(learnStars)}</div>}
                                        </div>
                                    </div>

                                    {swap.message && <div className="swap-message">{swap.message}</div>}

                                    <div className="swap-actions">
                                        {tab === 'received' && swap.status === 'pending' ? (
                                            <>
                                                <button className="btn btn-primary" onClick={() => respond(swap.id, 'accepted')}>Accept</button>
                                                <button className="btn btn-secondary" onClick={() => respond(swap.id, 'declined')}>Decline</button>
                                            </>
                                        ) : swap.status === 'accepted' ? (
                                            <div className="accepted-row">
                                                <div className="accepted-note">✓ Swap accepted — Start chatting!</div>
                                                <button className="btn btn-primary" onClick={() => openChat(swap.id)}>Open Chat</button>
                                                {(() => {
                                                    const isReq = swap.requester_id === user.id;
                                                    const done = isReq ? swap.requester_completed : swap.receiver_completed;
                                                    return !done ? (
                                                        <button className="btn btn-secondary" onClick={() => markSwapComplete(swap.id)}>
                                                            Complete Swap
                                                        </button>
                                                    ) : (
                                                        <span className="completed-message" style={{ fontSize: 13, padding: '8px 12px' }}>✓ Marked complete</span>
                                                    );
                                                })()}</div>
                                        ) : tab === 'sent' && swap.status === 'pending' ? (
                                            <button className="btn btn-secondary" onClick={() => handleRemoveSwap(swap.id)}>Remove</button>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {selectedSwap && selectedProfile && (
                <div className="modal-backdrop" onClick={closeModal}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={closeModal}>✕</button>
                        <div className="modal-header">
                            <div className="avatar avatar-lg">{initials(selectedProfile.full_name)}</div>
                            <div style={{ flex: 1 }}>
                                <h2>{selectedProfile.full_name}</h2>
                                {selectedSwap.status === 'accepted' && (
                                    <div className="completion-status">
                                        <span className="completion-badge-large">Complete {getCompletionCount(selectedSwap)}/2</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedProfile.bio && (
                            <div className="modal-section">
                                <p className="bio">{selectedProfile.bio}</p>
                            </div>
                        )}

                        {selectedProfile.availability && selectedProfile.availability.length > 0 && (
                            <div className="modal-section" style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border)' }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>📅</span>
                                    Availability
                                </h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                    {selectedProfile.availability.map((time, i) => (
                                        <span key={i} style={{
                                            padding: '4px 10px',
                                            backgroundColor: 'var(--surface)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            color: 'var(--text-secondary)'
                                        }}>
                                            {time}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="modal-section">
                            <h3>Can teach</h3>
                            <div className="skill-tags">
                                {(selectedProfile.skills_teach || []).map((skill, i) => (
                                    <span key={i} className="skill-tag skill-teach">{getSkillName(skill)}</span>
                                ))}
                            </div>
                        </div>

                        <div className="modal-section">
                            <h3>Wants to learn</h3>
                            <div className="skill-tags">
                                {(selectedProfile.skills_learn || []).map((skill, i) => (
                                    <span key={i} className="skill-tag skill-learn">{getSkillName(skill)}</span>
                                ))}
                            </div>
                        </div>

                        {selectedSwap.status === 'accepted' && (() => {
                            const isReq = selectedSwap.requester_id === user.id;
                            const done = isReq ? selectedSwap.requester_completed : selectedSwap.receiver_completed;
                            return (
                                <div className="modal-actions">
                                    {done ? (
                                        <div className="completed-message">✓ You've marked this swap as complete</div>
                                    ) : (
                                        <button className="btn btn-primary" onClick={() => markSwapComplete(selectedSwap.id)}>
                                            Mark Swap as Complete
                                        </button>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {toast && <div className={`toast ${toastType}`}>{toast}</div>}

            <style>{`

                .swaps-hero-section {
                    background: #f0ede8;
                    padding: 24px;
                    border-radius: 16px;
                    margin-bottom: 24px;
                }
                .pending-dot {
                    background: var(--accent); color: white; font-size: 11px; font-weight: 600;
                    width: 18px; height: 18px; border-radius: 50%;
                    display: inline-flex; align-items: center; justify-content: center; margin-left: 6px;
                }
                .swaps-list { display: flex; flex-direction: column; gap: 16px; max-width: 680px; }
                .swap-card {
                    background: var(--surface); border: 1px solid var(--border);
                    border-radius: var(--r-lg); padding: 24px; box-shadow: var(--shadow-sm); transition: box-shadow 0.2s;
                }
                .swap-card:hover { box-shadow: var(--shadow); }
                .swap-header { margin-bottom: 16px; }
                .swap-date { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
                .swap-skills {
                    display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px;
                    padding: 16px; background: var(--surface-alt); border-radius: var(--r); border: 1px solid var(--border);
                }
                .swap-skill-item { flex: 1; display: flex; flex-direction: column; }
                .swap-exchange-icon { font-size: 20px; color: var(--text-muted); padding-top: 20px; flex-shrink: 0; }
                .swap-message {
                    font-size: 14px; color: var(--text-secondary); font-style: italic;
                    border-left: 3px solid var(--border-strong); padding-left: 14px; margin-bottom: 16px; line-height: 1.6;
                }
                .swap-actions { display: flex; gap: 10px; }
                .accepted-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .accepted-note {
                    flex: 1; font-size: 13px; color: var(--green); background: var(--green-light);
                    border: 1px solid var(--green-mid); border-radius: var(--r); padding: 10px 14px; font-weight: 500;
                }
                .swap-name-btn {
                    background: none; border: none; color: var(--text); font-size: 16px; font-weight: 600;
                    cursor: pointer; text-decoration: underline; padding: 0;
                }
                .swap-name-btn:hover { color: var(--primary); }
                .modal-backdrop {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5);
                    display: flex; align-items: center; justify-content: center; z-index: 1000;
                }
                .modal {
                    background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 24px;
                    box-shadow: var(--shadow); max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;
                    position: relative;
                }

                .modal-header {
                    display: flex; align-items: center; gap: 16px; margin-bottom: 24px;
                }
                .modal-section {
                    margin-bottom: 24px;
                }
                .modal-actions {
                    display: flex; gap: 10px; margin-top: 24px;
                }
                .completion-status {
                    display: flex; align-items: center; gap: 8px; margin-top: 8px;
                }
                .completion-badge-large {
                    background: var(--green-light); border: 1px solid var(--green-mid); border-radius: var(--r); padding: 8px 12px;
                    font-size: 14px; font-weight: 500; color: var(--green);
                }
                .completed-message {
                    font-size: 14px; color: var(--green); background: var(--green-light);
                    border: 1px solid var(--green-mid); border-radius: var(--r); padding: 10px 14px; font-weight: 500;
                }
            `}</style>
        </>
    );
}
