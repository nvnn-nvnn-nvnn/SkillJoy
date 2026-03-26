import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile, getSkillName } from '@/lib/stores';
import UserCard from '@/components/Usercard';
import UserModal from '@/components/Usermodal';
import SliderSearch from '@/components/SliderSearch';

// ── Match scoring (mirrors overlapScore from Svelte stores) ─────────────────

function skillName(s) {
    return getSkillName(s);
}

function overlapScore(listA, listB) {
    const namesA = (listA ?? []).map(s => getSkillName(s).toLowerCase());
    const namesB = (listB ?? []).map(s => getSkillName(s).toLowerCase());
    return namesA.filter(n => namesB.includes(n)).length;
}

function getMatchInfo(profile, them) {
    if (!profile || !them) return { score: 0, label: 'Explore profile', color: 'gray' };

    const myLearn = profile.skills_learn ?? [];
    const myTeachRated = profile.skills_teach ?? [];
    const theirTeach = them.skills_teach ?? [];
    const theirLearn = them.skills_learn ?? [];

    const theyTeachScore = overlapScore(theirTeach, myLearn);
    const iTeachScore = overlapScore(myTeachRated, theirLearn);
    const score = theyTeachScore + iTeachScore;

    const mutual = theyTeachScore > 0 && iTeachScore > 0;
    if (mutual) return { score, label: 'Perfect Match ✨', color: 'indigo' };
    if (theyTeachScore) return { score, label: 'They can teach you', color: 'green' };
    if (iTeachScore) return { score, label: 'You can teach them', color: 'blue' };
    return { score: 0, label: 'Explore profile', color: 'gray' };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Swaps() {
    const user = useUser();
    const profile = useProfile();
    const navigate = useNavigate();

    const [allUsers, setAllUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [busy, setBusy] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState('success');

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        (async () => {
            const { data, error } = await supabase.from('profiles').select('*').neq('id', user.id);
            if (!error && data) setAllUsers(data);
            setBusy(false);
        })();
    }, [user]);

    const filteredUsers = useMemo(() => {
        if (!searchQuery) return allUsers;
        const q = searchQuery.toLowerCase();
        return allUsers.filter(u =>
            u.full_name?.toLowerCase().includes(q) ||
            (u.skills_teach ?? []).some(s => getSkillName(s).toLowerCase().includes(q)) ||
            (u.skills_learn ?? []).some(s => getSkillName(s).toLowerCase().includes(q))
        );
    }, [allUsers, searchQuery]);

    const sortedUsers = useMemo(() =>
        [...filteredUsers].sort((a, b) => getMatchInfo(profile, b).score - getMatchInfo(profile, a).score),
        [filteredUsers, profile]
    );


    // Category Seach Query    
    function handleCategorySelect(categoryQuery) {
        setSearchQuery(categoryQuery);
    };


    function showToast(msg, type = 'success') {
        setToast(msg);
        setToastType(type);
        setTimeout(() => setToast(''), 3500);
    }

    async function handlePropose({ swapTeach, swapLearn, swapMessage }) {
        if (!swapTeach || !swapLearn || !selectedUser) return;
        setSubmitting(true);
        const { error: e } = await supabase.from('swaps').insert({
            requester_id: user.id,
            receiver_id: selectedUser.id,
            teach_skill: swapTeach,
            learn_skill: swapLearn,
            message: swapMessage,
        });
        setSubmitting(false);
        if (e) { showToast(e.message, 'error'); return; }
        const name = selectedUser.full_name;
        setSelectedUser(null);
        showToast(`Swap proposed to ${name}!`, 'success');
    }

    return (
        <>
            <title>Swaps — SkillJoy</title>

            <div className="page">
                <div style={{ display: 'flex', alignItems: 'flex-start',  flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ }}>
                        <h1 className="page-title" style={{ textAlign: 'left' }}>Discover Swaps</h1>
                        {profile?.skills_learn?.length > 0 && (
                            <p className="page-subtitle" style={{ color: "#fff" }}>
                                Based on your desire to learn <strong>{profile.skills_learn.map(s => getSkillName(s)).join(', ')}</strong>
                            </p>
                        )}
                    </div>
                    <button className="btn btn-primary" style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #000' }} onClick={() => navigate('/my-swaps')}>
                        My Swaps →
                    </button>
                </div>

                <div style={{ marginBottom: '40px' }}>
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="Search skills or users…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Sliding Box */}
                <SliderSearch onCategorySelect={handleCategorySelect} />

                {busy ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                    </div>
                ) : sortedUsers.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">🔍</span>
                        <h3>No users found</h3>
                        <p>Try adjusting your search or check back later.</p>
                    </div>
                ) : (
                    <div className="users-grid">
                        {sortedUsers.map(u => (
                            <UserCard
                                key={u.id}
                                user={u}
                                match={getMatchInfo(profile, u)}
                                onViewProfile={setSelectedUser}
                            />
                        ))}
                    </div>
                )}
            </div >

            <UserModal
                user={selectedUser}
                onClose={() => setSelectedUser(null)}
                onPropose={handlePropose}
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
        .search-box { width: 100%; max-width: 340px; }
        .users-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
      `}</style>
        </>
    );
}