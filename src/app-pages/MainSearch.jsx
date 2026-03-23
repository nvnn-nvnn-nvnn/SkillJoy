import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile } from '@/lib/stores'; // adjust to your hooks
import UserCard from '@/components/Usercard';
import UserModal from '@/components/Usermodal';

// ── Match scoring (mirrors overlapScore from Svelte stores) ─────────────────

function skillName(s) {
    return typeof s === 'string' ? s : s.name;
}

function overlapScore(listA, listB) {
    const namesA = (listA ?? []).map(skillName).map(s => s.toLowerCase());
    const namesB = (listB ?? []).map(s => s.toLowerCase());
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

export default function DiscoverPage() {
    const user = useUser();
    const profile = useProfile();
    const navigate = useNavigate();

    const [allUsers, setAllUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [busy, setBusy] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);

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
            (u.skills_teach ?? []).some(s => skillName(s).toLowerCase().includes(q)) ||
            (u.skills_learn ?? []).some(s => s.toLowerCase().includes(q))
        );
    }, [allUsers, searchQuery]);

    const sortedUsers = useMemo(() =>
        [...filteredUsers].sort((a, b) => getMatchInfo(profile, b).score - getMatchInfo(profile, a).score),
        [filteredUsers, profile]
    );

    return (
        <>
            <title>Discover — SkillJoy</title>

            <div className="page">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Discover Swaps</h1>
                        {profile?.skills_learn?.length > 0 && (
                            <p className="page-subtitle">
                                Based on your desire to learn <strong>{profile.skills_learn.join(', ')}</strong>
                            </p>
                        )}
                    </div>
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="Search skills or users…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

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
            </div>

            <UserModal user={selectedUser} onClose={() => setSelectedUser(null)} />

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