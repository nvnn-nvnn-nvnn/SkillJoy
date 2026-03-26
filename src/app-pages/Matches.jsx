import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile, getSkillName } from '@/lib/stores';
import MatchCard from '@/components/Matchcard';
import SwapModal from '@/components/Swapmodal';

// ── Pure scoring helpers ──────────────────────────────────────────────────────

function skillName(s) {
    return getSkillName(s);
}

function skillStars(s) {
    return typeof s === 'string' ? 3 : (s.stars ?? 3);
}

function overlapScore(listA, listB) {
    const namesB = (listB ?? []).map(s => getSkillName(s).toLowerCase());
    return (listA ?? []).reduce((sum, s) => {
        const name = getSkillName(s).toLowerCase();
        const stars = skillStars(s);
        return namesB.includes(name) ? sum + stars : sum;
    }, 0);
}

function buildMatches(allUsers, me) {
    if (!me) return [];

    const myTeachRated = me.skills_teach ?? [];
    const myLearn = me.skills_learn ?? [];

    return allUsers
        .map(p => {
            const theirTeachRated = p.skills_teach ?? [];
            const theirLearn = p.skills_learn ?? [];

            const theyTeachScore = overlapScore(theirTeachRated, myLearn);
            const iTeachScore = overlapScore(myTeachRated, theirLearn);
            const score = theyTeachScore + iTeachScore;

            const myLearnLower = myLearn.map(s => getSkillName(s).toLowerCase());
            const theirLearnLower = theirLearn.map(s => getSkillName(s).toLowerCase());

            const theyCanTeach = theirTeachRated
                .filter(s => myLearnLower.includes(getSkillName(s).toLowerCase()))
                .map(s => ({ name: getSkillName(s), stars: skillStars(s) }));

            const iCanTeach = myTeachRated
                .filter(s => theirLearnLower.includes(getSkillName(s).toLowerCase()))
                .map(s => ({ name: getSkillName(s), stars: skillStars(s) }));

            return { ...p, score, theyCanTeach, iCanTeach };
        })
        .filter(p => p.theyCanTeach.length > 0 && p.iCanTeach.length > 0)
        .sort((a, b) => b.score - a.score);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MatchesPage() {
    const user = useUser();
    const profile = useProfile();
    const navigate = useNavigate();

    const [allUsers, setAllUsers] = useState([]);
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('success');
    const [modalMatch, setModalMatch] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        if (profile && !profile.full_name) { navigate('/onboarding'); return; }
        (async () => {
            const { data, error: e } = await supabase.from('profiles').select('*').neq('id', user.id);
            if (e) setError(e.message);
            else setAllUsers(data ?? []);
            setBusy(false);
        })();
    }, [user, profile]);

    const matches = useMemo(() => buildMatches(allUsers, profile), [allUsers, profile]);
    const maxScore = useMemo(() => Math.max(...matches.map(m => m.score), 0.01), [matches]);

    function showToast(msg, type = 'success') {
        setToast(msg); setToastType(type);
        setTimeout(() => setToast(''), 3500);
    }

    async function handlePropose({ swapTeach, swapLearn, swapMessage }) {
        if (!swapTeach || !swapLearn || !modalMatch) return;
        setSubmitting(true);
        const { error: e } = await supabase.from('swaps').insert({
            requester_id: user.id,
            receiver_id: modalMatch.id,
            teach_skill: swapTeach,
            learn_skill: swapLearn,
            message: swapMessage,
        });
        setSubmitting(false);
        if (e) { showToast(e.message, 'error'); return; }
        const name = modalMatch.full_name;
        setModalMatch(null);
        showToast(`Swap proposed to ${name}!`, 'success');
    }

    return (
        <>
            <title>Your Matches — SkillJoy</title>

            <div className="page">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Your matches</h1>
                        <p className="page-subtitle">
                            Students who can teach you what you want — and want what you can teach.
                            Ranked by skill quality.
                        </p>
                    </div>
                    {!busy && matches.length > 0 && (
                        <div className="match-count">
                            {matches.length} match{matches.length !== 1 ? 'es' : ''}
                        </div>
                    )}
                </div>

                {busy ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                    </div>
                ) : error ? (
                    <p style={{ color: 'var(--accent)' }}>{error}</p>
                ) : matches.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">🤝</span>
                        <h3>No matches yet</h3>
                        <p>As more students join and fill out their profiles,<br />mutual matches will appear here.</p>
                        <Link to="/onboarding" className="btn btn-secondary" style={{ marginTop: 24 }}>
                            Update your skills
                        </Link>
                    </div>
                ) : (
                    <div className="matches-grid">
                        {matches.map((match, i) => (
                            <MatchCard
                                key={match.id}
                                match={match}
                                maxScore={maxScore}
                                index={i}
                                onPropose={setModalMatch}
                            />
                        ))}
                    </div>
                )}
            </div>

            <SwapModal
                match={modalMatch}
                onClose={() => setModalMatch(null)}
                onSubmit={handlePropose}
                submitting={submitting}
            />

            {toast && <div className={`toast ${toastType}`}>{toast}</div>}

            <style>{`
        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 40px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .match-count {
          background: var(--primary-light);
          color: var(--primary);
          border: 1px solid var(--primary-mid);
          padding: 6px 16px;
          border-radius: var(--r-full);
          font-size: 14px;
          font-weight: 500;
          align-self: center;
        }
        .matches-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }
      `}</style>
        </>
    );
}