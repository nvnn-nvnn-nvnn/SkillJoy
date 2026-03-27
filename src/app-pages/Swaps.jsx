import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile, getSkillName } from '@/lib/stores';
import UserCard from '@/components/Usercard';
import UserModal from '@/components/Usermodal';
import SliderSearch from '@/components/SliderSearch';

// ── Match scoring ─────────────────────────────────────────────────────────────

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

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIMES = ['Mornings', 'Midday', 'Afternoon', 'Evening', 'Night', 'No preference'];

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
    const [showFilters, setShowFilters] = useState(false);
    const [availabilityDays, setAvailabilityDays] = useState([]);
    const [timeFilter, setTimeFilter] = useState('');
    // const [locationFilter, setLocationFilter]    = useState('');
    const [favorites, setFavorites] = useState([]);
    const [recentSearches, setRecentSearches] = useState([]);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [panelHeight, setPanelHeight] = useState(0);

    const filterInnerRef = useRef(null);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        (async () => {
            const { data, error } = await supabase.from('profiles').select('*').neq('id', user.id);
            if (!error && data) setAllUsers(data);
            setBusy(false);
        })();
        loadFavorites();
        loadRecentSearches();
    }, [user]);

    // measure inner panel so slide animation has accurate target height
    useEffect(() => {
        if (filterInnerRef.current) {
            setPanelHeight(filterInnerRef.current.scrollHeight);
        }
    }, [showFilters]);

    async function loadFavorites() {
        const { data } = await supabase.from('favorites').select('favorited_id').eq('user_id', user?.id);
        if (data) setFavorites(data.map(f => f.favorited_id));
    }

    async function loadRecentSearches() {
        const stored = localStorage.getItem(`recent_searches_${user?.id}`);
        if (stored) setRecentSearches(JSON.parse(stored));
    }

    async function toggleFavorite(userId) {
        const isFav = favorites.includes(userId);
        if (isFav) {
            await supabase.from('favorites').delete().eq('user_id', user.id).eq('favorited_id', userId);
            setFavorites(favorites.filter(id => id !== userId));
            showToast('Removed from favorites', 'success');
        } else {
            await supabase.from('favorites').insert({ user_id: user.id, favorited_id: userId });
            setFavorites([...favorites, userId]);
            showToast('Added to favorites ⭐', 'success');
        }
    }

    function addRecentSearch(query) {
        if (!query?.trim()) return;
        const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem(`recent_searches_${user?.id}`, JSON.stringify(updated));
    }

    function clearRecentSearches() {
        setRecentSearches([]);
        localStorage.removeItem(`recent_searches_${user?.id}`);
    }

    function toggleDay(day) {
        setAvailabilityDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    }

    function clearFilters() {
        setAvailabilityDays([]);
        setTimeFilter('');
        // setLocationFilter('');
    }

    const hasActiveFilters = availabilityDays.length > 0 || !!timeFilter;

    const filteredUsers = useMemo(() => {
        let users = allUsers;

        if (showFavoritesOnly) users = users.filter(u => favorites.includes(u.id));

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            users = users.filter(u =>
                u.full_name?.toLowerCase().includes(q) ||
                (u.skills_teach ?? []).some(s => getSkillName(s).toLowerCase().includes(q)) ||
                (u.skills_learn ?? []).some(s => getSkillName(s).toLowerCase().includes(q))
            );
        }

        if (availabilityDays.length > 0) {
            users = users.filter(u =>
                availabilityDays.some(day =>
                    u.availability?.some(slot => slot.toLowerCase().includes(day.toLowerCase()))
                )
            );
        }

        if (timeFilter && timeFilter !== 'No preference') {
            users = users.filter(u =>
                u.availability?.some(slot => slot.toLowerCase().includes(timeFilter.toLowerCase()))
            );
        }

        // if (locationFilter) {
        //     users = users.filter(u =>
        //         u.location?.toLowerCase().includes(locationFilter.toLowerCase())
        //     );
        // }

        return users;
    }, [allUsers, searchQuery, availabilityDays, timeFilter, favorites, showFavoritesOnly]);

    const sortedUsers = useMemo(() =>
        [...filteredUsers].sort((a, b) => getMatchInfo(profile, b).score - getMatchInfo(profile, a).score),
        [filteredUsers, profile]
    );

    function handleCategorySelect(q) { setSearchQuery(q); }

    function showToast(msg, type = 'success') {
        setToast(msg); setToastType(type);
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

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                    <div>
                        <h1 className="page-title" style={{ textAlign: 'left' }}>Discover Swaps</h1>
                        {profile?.skills_learn?.length > 0 && (
                            <p className="page-subtitle" style={{ color: '#000' }}>
                                Based on your desire to learn <strong>{profile.skills_learn.map(s => getSkillName(s)).join(', ')}</strong>
                            </p>
                        )}
                    </div>
                    <button
                        className="btn btn-primary"
                        style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #000' }}
                        onClick={() => navigate('/my-swaps')}
                    >
                        My Swaps →
                    </button>
                </div>

                {/* Search row */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                        <div className="search-box" style={{ flex: 1 }}>
                            <input
                                type="text"
                                placeholder="Search skills or users…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addRecentSearch(searchQuery); }}
                            />
                        </div>
                        <button
                            className={`btn btn-secondary sj-filter-btn ${showFilters ? 'sj-filter-btn-open' : ''}`}
                            onClick={() => setShowFilters(v => !v)}
                        >
                            {hasActiveFilters && <span className="sj-filter-dot" />}
                            🔍 Filters
                            <span className={`sj-chevron ${showFilters ? 'sj-chevron-up' : ''}`}>▾</span>
                        </button>
                        <button
                            className={`btn ${showFavoritesOnly ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setShowFavoritesOnly(v => !v)}
                            style={{ padding: '10px 16px' }}
                        >
                            ⭐ Favorites {showFavoritesOnly ? '✓' : ''}
                        </button>
                    </div>

                    {/* Recent searches */}
                    {recentSearches.length > 0 && !searchQuery && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Recent:</span>
                            {recentSearches.map((s, i) => (
                                <button key={i} className="sj-recent-chip" onClick={() => setSearchQuery(s)}>{s}</button>
                            ))}
                            <button className="sj-clear-btn" onClick={clearRecentSearches}>Clear</button>
                        </div>
                    )}

                    {/* Slide-down filter panel */}
                    <div
                        className="sj-filter-panel"
                        style={{ maxHeight: showFilters ? `${panelHeight}px` : '0px' }}
                    >
                        <div className="sj-filter-inner" ref={filterInnerRef}>

                            {/* Availability — M–F day chips */}
                            <div className="sj-filter-group">
                                <label className="sj-filter-label">Availability</label>
                                <div className="sj-chips">
                                    {DAYS.map(day => (
                                        <button
                                            key={day}
                                            className={`sj-chip ${availabilityDays.includes(day) ? 'sj-chip-on' : ''}`}
                                            onClick={() => toggleDay(day)}
                                        >
                                            {day.slice(0, 3)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Time of day */}
                            <div className="sj-filter-group">
                                <label className="sj-filter-label">Time of day</label>
                                <div className="sj-chips">
                                    {TIMES.map(time => (
                                        <button
                                            key={time}
                                            className={`sj-chip ${timeFilter === time ? 'sj-chip-on' : ''}`}
                                            onClick={() => setTimeFilter(timeFilter === time ? '' : time)}
                                        >
                                            {time}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Location — commented out */}
                            {/* <div className="sj-filter-group">
                                <label className="sj-filter-label">Location</label>
                                <input
                                    type="text"
                                    placeholder="e.g., New York, Remote"
                                    value={locationFilter}
                                    onChange={e => setLocationFilter(e.target.value)}
                                    className="sj-filter-input"
                                />
                            </div> */}

                            {hasActiveFilters && (
                                <button className="sj-clear-filters-btn" onClick={clearFilters}>
                                    Clear all filters
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Category slider */}
                <SliderSearch onCategorySelect={handleCategorySelect} />

                {/* Results */}
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
                            <div key={u.id} style={{ position: 'relative' }}>
                                <button
                                    className={`sj-fav-btn ${favorites.includes(u.id) ? 'sj-fav-btn-active' : ''}`}
                                    onClick={e => { e.stopPropagation(); toggleFavorite(u.id); }}
                                    title={favorites.includes(u.id) ? 'Remove from favorites' : 'Add to favorites'}
                                >
                                    {favorites.includes(u.id) ? '⭐' : '☆'}
                                </button>
                                <UserCard
                                    user={u}
                                    match={getMatchInfo(profile, u)}
                                    onViewProfile={setSelectedUser}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <UserModal
                user={selectedUser}
                onClose={() => setSelectedUser(null)}
                onPropose={handlePropose}
                submitting={submitting}
            />

            {toast && <div className={`toast ${toastType}`}>{toast}</div>}

            <style>{`
                .search-box { width: 100%; }

                .users-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                    margin-top: 24px;
                }

                /* ── Filter button ── */
                .sj-filter-btn {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 16px;
                    white-space: nowrap;
                }
                .sj-filter-btn-open {
                    border-color: var(--primary) !important;
                    color: var(--primary) !important;
                }
                .sj-filter-dot {
                    width: 6px; height: 6px;
                    background: var(--primary);
                    border-radius: 50%;
                    flex-shrink: 0;
                }
                .sj-chevron {
                    font-size: 12px;
                    display: inline-block;
                    transition: transform 0.22s ease;
                    margin-left: 2px;
                }
                .sj-chevron-up { transform: rotate(180deg); }

                /* ── Slide-down panel ── */
                .sj-filter-panel {
                    overflow: hidden;
                    transition: max-height 0.30s cubic-bezier(0.4, 0, 0.2, 1);
                    max-height: 0;
                }
                .sj-filter-inner {
                    padding: 20px;
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    margin-bottom: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                }
                .sj-filter-group { display: flex; flex-direction: column; gap: 8px; }
                .sj-filter-label {
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: var(--text-muted);
                }

                /* ── Chips ── */
                .sj-chips { display: flex; flex-wrap: wrap; gap: 8px; }
                .sj-chip {
                    padding: 6px 14px;
                    border-radius: 100px;
                    border: 1.5px solid var(--border);
                    background: var(--surface-alt, #f5f4f0);
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-family: inherit;
                    transition: background 0.14s, border-color 0.14s, color 0.14s, transform 0.1s;
                }
                .sj-chip:hover {
                    border-color: var(--primary);
                    color: var(--primary);
                    transform: translateY(-1px);
                }
                .sj-chip-on {
                    background: var(--primary);
                    border-color: var(--primary);
                    color: #fff;
                    transform: translateY(-1px);
                }
                .sj-chip-on:hover { opacity: 0.88; color: #fff; }

                /* ── Clear filters ── */
                .sj-clear-filters-btn {
                    align-self: flex-start;
                    padding: 6px 14px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: transparent;
                    font-size: 13px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-family: inherit;
                    transition: border-color 0.14s, color 0.14s;
                }
                .sj-clear-filters-btn:hover {
                    border-color: var(--text-secondary);
                    color: var(--text-primary);
                }

                /* ── Recent searches ── */
                .sj-recent-chip {
                    padding: 4px 10px;
                    background: var(--surface-alt);
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    font-size: 13px;
                    cursor: pointer;
                    color: var(--text-secondary);
                    font-family: inherit;
                    transition: border-color 0.14s;
                }
                .sj-recent-chip:hover { border-color: var(--text-secondary); }
                .sj-clear-btn {
                    padding: 4px 8px;
                    background: transparent;
                    border: none;
                    font-size: 12px;
                    cursor: pointer;
                    color: var(--text-muted);
                    font-family: inherit;
                }
                .sj-clear-btn:hover { color: var(--text-primary); }

                /* ── Favorite button ── */
                .sj-fav-btn {
                    position: absolute;
                    top: 12px; right: 12px;
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 50%;
                    width: 32px; height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 16px;
                    z-index: 10;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.08);
                    transition: transform 0.12s, background 0.14s;
                }
                .sj-fav-btn:hover { transform: scale(1.12); }
                .sj-fav-btn-active { background: #fbbf24; border-color: #fbbf24; }

                /* ── Filter input (location, for re-enabling later) ── */
                .sj-filter-input {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    font-size: 14px;
                    font-family: inherit;
                    background: var(--surface-alt);
                    color: var(--text-primary);
                    box-sizing: border-box;
                }
                .sj-filter-input:focus {
                    outline: none;
                    border-color: var(--primary);
                }
            `}</style>
        </>
    );
}