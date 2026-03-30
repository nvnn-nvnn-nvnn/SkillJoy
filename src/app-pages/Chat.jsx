import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile, useAuth, getSkillName } from '@/lib/stores';
import { apiFetch } from '@/lib/api';

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(iso) {
    const d = new Date(iso), now = new Date();
    if (d.toDateString() === now.toDateString())
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatLastMsg(lastMsg, userId) {
    if (!lastMsg) return 'No messages yet';
    const prefix = lastMsg.sender_id === userId ? 'You: ' : '';
    const text = lastMsg.content.length > 40 ? lastMsg.content.slice(0, 40) + '…' : lastMsg.content;
    return prefix + text;
}

const RATING_LABELS = ['', 'Terrible experience', 'Poor experience', 'Average experience', 'Good experience', 'Greatest experience!'];

function isGigCompleted(c) { return c.requester_completed && c.provider_completed || c.status === 'withdrawn' || c.status === 'completed' || c.payment_status === 'withdrawn' || c.payment_status === 'refunded'; }
function isSwapCompleted(c) { return c.requester_completed && c.receiver_completed; }

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
    const user = useUser();
    const profile = useProfile();
    const { setProfile } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Replace your initial state declarations with these:
    const [chatMode, setChatMode] = useState(() => localStorage.getItem('chat_mode') || 'swaps');
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('chat_tab') || 'active');
    const [gigRoleTab, setGigRoleTab] = useState(() => localStorage.getItem('chat_role_tab') || 'hiring');


    const [conversations, setConversations] = useState([]);
    const [gigConversations, setGigConversations] = useState([]);
    const [activeSwapId, setActiveSwapId] = useState(null);
    const [activeGigReqId, setActiveGigReqId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [loadingConvos, setLoadingConvos] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [error, setError] = useState('');


    const [showProfileModal, setShowProfileModal] = useState(false);
    const [modalProfile, setModalProfile] = useState(null);
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
    const [pendingWithdrawId, setPendingWithdrawId] = useState(null);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [pendingCancelId, setPendingCancelId] = useState(null);
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    const [pendingDisputeId, setPendingDisputeId] = useState(null);
    const [disputeReason, setDisputeReason] = useState('');
    const [disputeSubmitting, setDisputeSubmitting] = useState(false);
    const [ratingValue, setRatingValue] = useState(0);
    const [ratingComment, setRatingComment] = useState('');

    const msgEndRef = useRef(null);
    const inputRef = useRef(null);
    const realtimeSub = useRef(null);
    const swapSub = useRef(null);
    const hasMounted = useRef(false);

    // Derived
    const activeConvo = chatMode === 'swaps'
        ? (conversations.find(c => c.swap_id === activeSwapId) ?? null)
        : (gigConversations.find(c => c.gig_request_id === activeGigReqId) ?? null);
    const filteredConvos = chatMode === 'swaps'
        ? conversations.filter(c => activeTab === 'completed' ? isSwapCompleted(c) : !isSwapCompleted(c))
        : gigConversations.filter(c => {
            const done = isGigCompleted(c);
            const statusMatch = activeTab === 'completed' ? done : !done;
            if (!statusMatch) return false;
            if (gigRoleTab === 'hiring') return !c.isProvider;
            if (gigRoleTab === 'providing') return c.isProvider;
            return true;
        });

    // ── Scroll ────────────────────────────────────────────────────────────────

    function scrollToBottom() {
        setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }

    // ── Toast helper ─────────────────────────────────────────────────────────

    function showToast(msg) {
        setError(msg);
        setTimeout(() => setError(''), 3000);
    }

    // ── Load conversations ────────────────────────────────────────────────────

    const loadConversations = useCallback(async (silent = false) => {
        if (!user) return;
        if (!silent) setLoadingConvos(true);
        const { data, error: e } = await supabase
            .from('swaps')
            .select(`
        id, status, teach_skill, learn_skill,
        requester_id, receiver_id,
        requester_completed, receiver_completed,
        requester:profiles!requester_id(id, full_name, bio, skills_teach, skills_learn),
        receiver:profiles!receiver_id(id, full_name, bio, skills_teach, skills_learn)
      `)
            .in('status', ['accepted', 'completed'])
            .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .order('created_at', { ascending: false });

        setLoadingConvos(false);
        if (e) { setError(e.message); return; }

        const enriched = await Promise.all((data ?? []).map(async swap => {
            const iAmRequester = swap.requester_id === user.id;
            const other = iAmRequester ? swap.receiver : swap.requester;

            const myTeachEntry = (profile?.skills_teach ?? []).find(s => (typeof s === 'string' ? s : s.name) === swap.teach_skill);
            const theirTeachEntry = (other?.skills_teach ?? []).find(s => (typeof s === 'string' ? s : s.name) === swap.learn_skill);

            const teachStars = myTeachEntry ? (typeof myTeachEntry === 'string' ? 3 : myTeachEntry.stars ?? 3) : null;
            const learnStars = theirTeachEntry ? (typeof theirTeachEntry === 'string' ? 3 : theirTeachEntry.stars ?? 3) : null;

            const { data: lastMsgs } = await supabase
                .from('messages').select('content, created_at, sender_id')
                .eq('swap_id', swap.id).order('created_at', { ascending: false }).limit(1);

            return {
                swap_id: swap.id, status: swap.status, other,
                teach_skill: swap.teach_skill, learn_skill: swap.learn_skill,
                requester_id: swap.requester_id, receiver_id: swap.receiver_id,
                requester_completed: swap.requester_completed,
                receiver_completed: swap.receiver_completed,
                teachStars, learnStars, lastMsg: lastMsgs?.[0] ?? null,
            };
        }));

        setConversations(enriched);
        return enriched;
    }, [user, profile]);

    // ── Load gig conversations ─────────────────────────────────────────────────

    const loadGigConversations = useCallback(async (silent = false) => {
        if (!user) return;
        if (!silent) setLoadingConvos(true);
        const { data, error: e } = await supabase
            .from('gig_requests')
            .select(`
                id, status,
                gig:gigs!gig_id(id, title, price, category),
                requester:profiles!requester_id(id, full_name, bio),
                provider:profiles!provider_id(id, full_name, bio),
                requester_id, provider_id,
                requester_completed, provider_completed,
                payment_status, confirmation_deadline
            `)
            .in('status', ['accepted', 'in_progress', 'delivered', 'completed', 'withdrawn', 'refunded', 'disputed'])
            .or(`requester_id.eq.${user.id},provider_id.eq.${user.id}`)
            .order('created_at', { ascending: false });

        setLoadingConvos(false);
        if (e) { setError(e.message); return; }

        const enriched = await Promise.all((data ?? []).map(async req => {
            const isProvider = req.provider_id === user.id;
            const other = isProvider ? req.requester : req.provider;

            const { data: lastMsgs } = await supabase
                .from('messages')
                .select('content, created_at, sender_id')
                .eq('gig_request_id', req.id)
                .order('created_at', { ascending: false })
                .limit(1);


                // Profile Ratings
            const {data: ratings} = await supabase
                .from("ratings")
                .select('rating')
                .eq('rated_id', other.id)

            const avgRating = ratings?.length
                ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
                : null;
                
            const ratingCount = ratings?.length ?? 0;


        

            return {
                gig_request_id: req.id, status: req.status,
                gig: req.gig,
                requester_id: req.requester_id, provider_id: req.provider_id,
                requester_completed: req.requester_completed,
                provider_completed: req.provider_completed,
                payment_status: req.payment_status,
                confirmation_deadline: req.confirmation_deadline,
                isProvider,
                lastMsg: lastMsgs?.[0] ?? null,
                other: { ...other, avgRating, ratingCount }
            };



            
        }));

        setGigConversations(enriched);
        return enriched;
    }, [user]);

    // ── Messages ─────────────────────────────────────────────────────────────

    async function fetchMessages(id, mode) {
        const col = mode === 'gigs' ? 'gig_request_id' : 'swap_id';
        const { data, error: e } = await supabase
            .from('messages').select('id, content, sender_id, created_at')
            .eq(col, id).order('created_at', { ascending: true });
        if (e) { setError(e.message); return; }
        setMessages(data ?? []);
    }

    function subscribeToMessages(id, mode) {
        const col = mode === 'gigs' ? 'gig_request_id' : 'swap_id';
        const channel = supabase
            .channel(`messages-${id}`)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `${col}=eq.${id}` },
                (payload) => {
                    setMessages(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
                    scrollToBottom();
                    if (mode === 'gigs') {
                        setGigConversations(prev => prev.map(c => c.gig_request_id === id ? { ...c, lastMsg: payload.new } : c));
                    } else {
                        setConversations(prev => prev.map(c => c.swap_id === id ? { ...c, lastMsg: payload.new } : c));
                    }
                }
            ).subscribe();
        realtimeSub.current = channel;
    }

    function subscribeToSwapUpdates(swapId) {
        const channel = supabase
            .channel(`swap-${swapId}`)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'swaps', filter: `id=eq.${swapId}` },
                async (payload) => {
                    setConversations(prev => prev.map(c =>
                        c.swap_id === swapId
                            ? { ...c, requester_completed: payload.new.requester_completed, receiver_completed: payload.new.receiver_completed, status: payload.new.status }
                            : c
                    ));
                    if (payload.new.status === 'completed' && payload.old.status !== 'completed') {
                        const { data: updatedProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                        if (updatedProfile) setProfile(updatedProfile);
                    }
                }
            ).subscribe();
        swapSub.current = channel;
    }

    function subscribeToGigUpdates(gigReqId) {
        const channel = supabase
            .channel(`gig-${gigReqId}`)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'gig_requests', filter: `id=eq.${gigReqId}` },
                (payload) => {
                    setGigConversations(prev => prev.map(c =>
                        c.gig_request_id === gigReqId
                            ? { ...c, requester_completed: payload.new.requester_completed, provider_completed: payload.new.provider_completed, status: payload.new.status, payment_status: payload.new.payment_status }
                            : c
                    ));
                }
            ).subscribe();
        swapSub.current = channel;
    }

    function cleanupSubs() {
        if (realtimeSub.current) { supabase.removeChannel(realtimeSub.current); realtimeSub.current = null; }
        if (swapSub.current) { supabase.removeChannel(swapSub.current); swapSub.current = null; }
    }

    async function selectConversation(id, mode) {
        const m = mode ?? chatMode;
        if (m === 'swaps' && activeSwapId === id) return;
        if (m === 'gigs' && activeGigReqId === id) return;

        if (m === 'swaps') { setActiveSwapId(id); setActiveGigReqId(null); }
        else { setActiveGigReqId(id); setActiveSwapId(null); }

        setMessages([]);
        setLoadingMsgs(true);
        cleanupSubs();
        await fetchMessages(id, m);
        subscribeToMessages(id, m);
        if (m === 'swaps') subscribeToSwapUpdates(id);
        else subscribeToGigUpdates(id);
        setLoadingMsgs(false);
        scrollToBottom();
        inputRef.current?.focus();
    }

    // ── Send message ──────────────────────────────────────────────────────────

    async function sendMessage() {
        const content = newMessage.trim();
        const activeId = chatMode === 'swaps' ? activeSwapId : activeGigReqId;
        if (!content || sending || !activeId) return;
        setSending(true);
        setNewMessage('');
        const tempId = crypto.randomUUID();
        setMessages(prev => [...prev, { id: tempId, content, sender_id: user.id, created_at: new Date().toISOString() }]);
        scrollToBottom();

        const insertPayload = { sender_id: user.id, content };
        if (chatMode === 'gigs') insertPayload.gig_request_id = activeGigReqId;
        else insertPayload.swap_id = activeSwapId;

        const { data, error: e } = await supabase
            .from('messages').insert(insertPayload).select().single();
        setSending(false);
        if (e) {
            setMessages(prev => prev.filter(m => m.id !== tempId));
            setError(e.message);
            setNewMessage(content);
            return;
        }
        setMessages(prev => prev.map(m => m.id === tempId ? data : m));
        if (chatMode === 'gigs') {
            setGigConversations(prev => prev.map(c => c.gig_request_id === activeGigReqId ? { ...c, lastMsg: data } : c));
        } else {
            setConversations(prev => prev.map(c => c.swap_id === activeSwapId ? { ...c, lastMsg: data } : c));
        }
    }

    function handleKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    }

    // ── Complete swap ─────────────────────────────────────────────────────────

    async function submitRating() {
        if (!activeConvo || ratingValue === 0) { showToast('Please select a rating'); return; }
        const otherUserId = chatMode === 'swaps'
            ? (activeConvo.requester_id === user.id ? activeConvo.receiver_id : activeConvo.requester_id)
            : (activeConvo.requester_id === user.id ? activeConvo.provider_id : activeConvo.requester_id);

        // FIXED: Check if rating already exists to prevent duplicate key constraint violation
        const checkQuery = supabase.from('ratings').select('id').eq('rater_id', user.id).eq('rated_id', otherUserId);
        if (chatMode === 'swaps') checkQuery.eq('swap_id', activeSwapId);
        else checkQuery.eq('gig_request_id', activeGigReqId);
        const { data: existingRating } = await checkQuery.maybeSingle();

        if (existingRating) {
            showToast('You have already rated this exchange');
            setShowRatingModal(false);
            return;
        }

        const payload = { rater_id: user.id, rated_id: otherUserId, rating: ratingValue, comment: ratingComment };
        if (chatMode === 'swaps') payload.swap_id = activeSwapId;
        else payload.gig_request_id = activeGigReqId;
        const { error: e } = await supabase.from('ratings').insert(payload);
        if (e) { showToast(e.message); return; }
        setShowRatingModal(false);
        setRatingValue(0);
        setRatingComment('');
        showToast('Thank you for your rating!');
    }

    function closeRatingModal() { setShowRatingModal(false); setRatingValue(0); setRatingComment(''); }

    // ── Complete gig ──────────────────────────────────────────────────────────

    async function markGigComplete(gigReqId) {
        if (!activeConvo) return;
        const isRequester = activeConvo.requester_id === user.id;
        const fieldToUpdate = isRequester ? 'requester_completed' : 'provider_completed';

        // Update our completed field (ownership check ensures only this user's row is touched)
        const ownerField = isRequester ? 'requester_id' : 'provider_id';
        const { error: e } = await supabase.from('gig_requests').update({ [fieldToUpdate]: true }).eq('id', gigReqId).eq(ownerField, user.id);
        if (e) { setError(e.message); return; }

        // Verify the update actually persisted (RLS may silently block it)
        const { data: row } = await supabase.from('gig_requests').select('requester_completed, provider_completed').eq('id', gigReqId).single();
        const myFieldActuallyUpdated = row?.[fieldToUpdate] === true;

        if (!myFieldActuallyUpdated) {
            // RLS blocked the update — try via RPC as fallback
            const { error: rpcErr } = await supabase.rpc('mark_gig_completed', {
                gig_req_id: gigReqId,
                field_name: fieldToUpdate
            });
            if (rpcErr) {
                setError('Could not save your vote. Please check database permissions for gig_requests updates.');
                return;
            }
            // Re-fetch after RPC
            const { data: row2 } = await supabase.from('gig_requests').select('requester_completed, provider_completed').eq('id', gigReqId).single();
            if (!row2?.[fieldToUpdate]) {
                setError('Could not save your vote. Please check database permissions for gig_requests updates.');
                return;
            }
            Object.assign(row, row2);
        }

        const bothDone = row?.requester_completed && row?.provider_completed;

        // Update local state immediately
        setGigConversations(prev => prev.map(c =>
            c.gig_request_id === gigReqId
                ? { ...c, requester_completed: row.requester_completed, provider_completed: row.provider_completed }
                : c
        ));
        setShowProfileModal(false);
        setModalProfile(null);

        if (bothDone) {
            setActiveTab('completed');
            showToast('Gig completed!');
            await checkAndShowGigRatingModal(gigReqId);
        } else {
            showToast('Marked as complete. Waiting for other party. (1/2)');
        }
    }

    async function unmarkGigComplete(gigReqId) {
        if (!activeConvo) return;
        const isReq = activeConvo.requester_id === user.id;
        const field = isReq ? 'requester_completed' : 'provider_completed';
        const upd = { [field]: false };
        if (activeConvo.status === 'completed') upd.status = 'accepted';

        const ownerField = isReq ? 'requester_id' : 'provider_id';
        const { error: err } = await supabase.from('gig_requests').update(upd).eq('id', gigReqId).eq(ownerField, user.id);
        if (err) { setError(err.message); return; }
        setGigConversations(prev => prev.map(c =>
            c.gig_request_id === gigReqId
                ? { ...c, [field]: false, ...(activeConvo.status === 'completed' ? { status: 'accepted' } : {}) }
                : c
        ));
        showToast('Vote removed.');
    }

    async function checkAndShowGigRatingModal(gigReqId) {
        const { data: existing, error: err } = await supabase
            .from('ratings').select('id')
            .eq('gig_request_id', gigReqId).eq('rater_id', user.id).maybeSingle();
        if (!existing && !err) setShowRatingModal(true);
    }

    // ── Payment escrow actions ────────────────────────────────────────────────


    async function disputePayment(gigReqId, reason) {
        setDisputeSubmitting(true);
        const res = await apiFetch('/api/payments/dispute', {
            method: 'POST',
            body: JSON.stringify({ orderId: gigReqId, reason }),
        });
        const data = await res.json();
        setDisputeSubmitting(false);
        if (!res.ok) { showToast(data.error || 'Failed to file dispute'); return; }
        setShowDisputeModal(false);
        setDisputeReason('');
        setPendingDisputeId(null);
        setGigConversations(prev => prev.map(c =>
            c.gig_request_id === gigReqId ? { ...c, payment_status: 'disputed' } : c
        ));
        showToast('Dispute filed. Payment is on hold for review.');
    }

    // ── Seller: Mark as Delivered ─────────────────────────────────────────────

    async function markAsDelivered(gigReqId) {
        if (!activeConvo) return;
        const { error: err } = await supabase
            .from('gig_requests')
            .update({ status: 'delivered', provider_completed: true })
            .eq('id', gigReqId)
            .eq('provider_id', user.id);
        if (err) { setError(err.message); return; }

        setGigConversations(prev => prev.map(c =>
            c.gig_request_id === gigReqId
                ? { ...c, status: 'delivered', provider_completed: true }
                : c
        ));
        showToast('Marked as delivered! Waiting for buyer to release funds.');
    }



    // Seller: Mark as Undelivered

    async function revertMarkAsDelivered(gigReqId) {

        if (!activeConvo) return;

        const { error: err } = await supabase
            .from('gig_requests')
            .update({ status: 'accepted', provider_completed: false })
            .eq('id', gigReqId)
            .eq('provider_id', user.id);

        if (err) { showToast(err.message); return; }

        setGigConversations(prev => prev.map(c =>
            c.gig_request_id === gigReqId
                ? { ...c, status: 'accepted', provider_completed: false }
                : c
        ));
        showToast('Delivery reverted. Order back to accepted.');




    }

    // ── Seller: Cancel Order ──────────────────────────────────────────────────

    async function cancelOrder(gigReqId) {
        const res = await apiFetch('/api/payments/cancel', {
            method: 'POST',
            body: JSON.stringify({ orderId: gigReqId, reason: 'Cancelled by seller' }),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Failed to cancel order'); return; }
        setGigConversations(prev => prev.map(c =>
            c.gig_request_id === gigReqId
                ? { ...c, status: 'cancelled', payment_status: c.payment_status === 'escrowed' ? 'withdrawn' : c.payment_status }
                : c
        ));
        showToast('Order cancelled.');
    }

    // ── Buyer: Release Funds & Complete ───────────────────────────────────────

    async function releaseFundsAndComplete(gigReqId) {
        if (!activeConvo) return;

        try {
            const res = await apiFetch('/api/payments/release', {
                method: 'POST',
                body: JSON.stringify({ orderId: gigReqId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to release payment');

            setGigConversations(prev => prev.map(c =>
                c.gig_request_id === gigReqId
                    ? { ...c, status: 'completed', payment_status: 'released', requester_completed: true }
                    : c
            ));

            setActiveTab('completed');
            showToast('Payment released! Gig completed.');
            await checkAndShowGigRatingModal(gigReqId);
        } catch (err) {
            setError(err.message);
        }
    }

    // ── Buyer: Refund ─────────────────────────────────────────────────────────

    async function handleRefund(gigReqId) {
        if (!activeConvo) return;

        try {
            const res = await apiFetch('/api/payments/refund', {
                method: 'POST',
                body: JSON.stringify({ orderId: gigReqId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to process withdrawal');

            setGigConversations(prev => prev.map(c =>
                c.gig_request_id === gigReqId
                    ? { ...c, status: 'withdrawn', payment_status: 'withdrawn', requester_completed: true }
                    : c
            ));

            setActiveTab('completed');
            showToast('Withdrawal processed. Order marked as withdrawn.');
        } catch (err) {
            setError(err.message);
        }
    }

    // ── Mount ─────────────────────────────────────────────────────────────────

    function handleSwitchMode(mode) {
        if (mode === chatMode) return;
        cleanupSubs();
        setChatMode(mode);
        setActiveSwapId(null);
        setActiveGigReqId(null);
        setMessages([]);
        setActiveTab('active');
    }


    // Tab information
    useEffect(() => {
        localStorage.setItem('chat_mode', chatMode);
        localStorage.setItem('chat_tab', activeTab);
        localStorage.setItem('chat_role_tab', gigRoleTab);
    }, [chatMode, activeTab, gigRoleTab]);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        (async () => {
            const convos = await loadConversations();
            await loadGigConversations();
            const swapParam = searchParams.get('swap');
            const gigParam = searchParams.get('gig');
            if (gigParam) {
                setChatMode('gigs');
                const gigConvos = await loadGigConversations();
                const found = gigConvos?.find(c => c.gig?.id === gigParam);
                if (found) await selectConversation(found.gig_request_id, 'gigs');
            } else if (swapParam) {
                const found = convos?.find(c => c.swap_id === swapParam);
                if (found) await selectConversation(found.swap_id, 'swaps');
            } else if (convos?.length > 0) {
                await selectConversation(convos[0].swap_id, 'swaps');
            }
        })();
        return () => cleanupSubs();
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!hasMounted.current) { hasMounted.current = true; return; }
        if (!user) return;
        (async () => {
            if (chatMode === 'swaps') {
                const convos = await loadConversations();
                if (convos?.length > 0 && !activeSwapId) await selectConversation(convos[0].swap_id, 'swaps');
            } else {
                const convos = await loadGigConversations();
                if (convos?.length > 0 && !activeGigReqId) await selectConversation(convos[0].gig_request_id, 'gigs');
            }
        })();
    }, [chatMode]); // eslint-disable-line react-hooks/exhaustive-deps

    // ...
    return (
        <>
            <title>Chat — SkillJoy</title>

            <div className="chat-shell">
                {/* ── Sidebar ── */}
                <aside className="sidebar">
                    <div className="sidebar-header">
                        <h2 className="sidebar-title">Chats</h2>
                        <div className="chat-mode-toggle">
                            <button className={`mode-btn${chatMode === 'swaps' ? ' active' : ''}`} onClick={() => handleSwitchMode('swaps')}>Swaps</button>
                            <button className={`mode-btn${chatMode === 'gigs' ? ' active' : ''}`} onClick={() => handleSwitchMode('gigs')}>Gigs</button>
                        </div>
                        <div className="chat-tabs">
                            {['active', 'completed'].map(tab => (
                                <button
                                    key={tab}
                                    className={`chat-tab${activeTab === tab ? ' active' : ''}`}
                                    onClick={() => setActiveTab(tab)}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>
                        {chatMode === 'gigs' && (
                            <div className="chat-role-tabs">
                                {['providing', 'hiring',].map(rt => (
                                    <button
                                        key={rt}
                                        className={`role-tab${gigRoleTab === rt ? ' active' : ''}`}
                                        onClick={() => setGigRoleTab(rt)}
                                    >
                                        {rt.charAt(0).toUpperCase() + rt.slice(1)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {loadingConvos ? (
                        <div className="sidebar-loading">
                            <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
                        </div>
                    ) : filteredConvos.length === 0 ? (
                        <div className="sidebar-empty">
                            <span style={{ fontSize: 32 }}>{chatMode === 'swaps' ? '💬' : '💼'}</span>
                            <p>No {activeTab} {chatMode} chats.</p>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                {chatMode === 'swaps'
                                    ? (activeTab === 'active' ? 'Accept a swap to unlock chat.' : 'Completed swaps will appear here.')
                                    : (activeTab === 'active' ? 'Accept a gig request to unlock chat.' : 'Completed gigs will appear here.')}
                            </p>
                            {activeTab === 'active' && (
                                <a href={chatMode === 'swaps' ? '/swaps' : '/gigs'} className="btn btn-secondary btn-sm" style={{ marginTop: 16 }}>
                                    {chatMode === 'swaps' ? 'View swaps' : 'Browse gigs'}
                                </a>
                            )}
                        </div>
                    ) : chatMode === 'swaps' ? (
                        <ul className="convo-list">
                            {filteredConvos.map(convo => {
                                const key = convo.swap_id;
                                const isActive = activeSwapId === key;
                                return (
                                    <li key={key}>
                                        <button className={`convo-item${isActive ? ' active' : ''}`} onClick={() => selectConversation(key, 'swaps')}>
                                            <div className="avatar avatar-sm">{initials(convo.other?.full_name)}</div>
                                            <div className="convo-info">
                                                <p className="convo-name">{convo.other?.full_name ?? 'Unknown'}</p>
                                                <p className="convo-preview">{formatLastMsg(convo.lastMsg, user?.id)}</p>
                                            </div>
                                            {convo.lastMsg && <span className="convo-time">{formatTime(convo.lastMsg.created_at)}</span>}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <ul className="convo-list">
                            {filteredConvos.map(convo => (
                                <li key={convo.gig_request_id}>
                                    <button className={`convo-item${activeGigReqId === convo.gig_request_id ? ' active' : ''}`} onClick={() => selectConversation(convo.gig_request_id, 'gigs')}>
                                        <div className="avatar avatar-sm">{initials(convo.other?.full_name)}</div>
                                        <div className="convo-info">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <p className="convo-name">{convo.other?.full_name ?? 'Unknown'}</p>
                                                <span className={`convo-role-badge ${convo.isProvider ? 'role-providing' : 'role-hiring'}`}>
                                                    {convo.isProvider ? 'Providing' : 'Hiring'}
                                                </span>
                                            </div>
                                            {convo.gig && <p className="convo-gig-label">{convo.gig.title}</p>}
                                            <p className="convo-preview">{formatLastMsg(convo.lastMsg, user?.id)}</p>
                                        </div>
                                        {convo.lastMsg && <span className="convo-time">{formatTime(convo.lastMsg.created_at)}</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>

                {/* ── Main ── */}
                <main className="chat-main">
                    {!activeConvo ? (
                        <div className="chat-empty">
                            <span style={{ fontSize: 48 }}>{chatMode === 'swaps' ? '💬' : '💼'}</span>
                            <h3>Select a conversation</h3>
                            <p>Choose a chat from the sidebar to get started.</p>
                        </div>
                    ) : (
                        <>
                            <header className="chat-header">
                                <div className="avatar">{initials(activeConvo.other?.full_name)}</div>
                                <div style={{ flex: 1 }}>
                                    {chatMode === 'swaps' ? (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                <button className="chat-name-btn" onClick={() => { setModalProfile(activeConvo.other); setShowProfileModal(true); }}>
                                                    {activeConvo.other?.full_name}
                                                </button>
                                                {(() => {
                                                    const completionCount = (activeConvo.requester_completed ? 1 : 0) + (activeConvo.receiver_completed ? 1 : 0);
                                                    return <span className="completion-badge-chat">Complete {completionCount}/2</span>;
                                                })()}
                                            </div>
                                            <p className="chat-header-sub">
                                                You teach <span className="skill-tag skill-learn" style={{ fontSize: 11, padding: '2px 8px' }}>{activeConvo.teach_skill}</span>
                                                {' · '}You learn <span className="skill-tag skill-teach" style={{ fontSize: 11, padding: '2px 8px' }}>{activeConvo.learn_skill}</span>
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                <button className="chat-name-btn" onClick={() => { setModalProfile(activeConvo.other); setShowProfileModal(true); }}>
                                                    {activeConvo.other?.full_name}
                                                </button>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span className="gig-chat-badge">{activeConvo.isProvider ? 'Client' : 'Provider'}</span>
                                                    {(() => {
                                                        const completionCount = (activeConvo.requester_completed ? 1 : 0) + (activeConvo.provider_completed ? 1 : 0);
                                                        return <span className="completion-badge-chat">Complete {completionCount}/2</span>;
                                                    })()}
                                                </div>
                                            </div>
                                            <p className="chat-header-sub">
                                                {activeConvo.gig?.title} · <strong>${activeConvo.gig?.price?.toFixed(2)}</strong>
                                            </p>
                                        </>
                                    )}
                                </div>
                            </header>

                            <div className="messages-area">
                                {loadingMsgs ? (
                                    <div className="msgs-loading"><div className="spinner" style={{ width: 28, height: 28, borderWidth: 2 }} /></div>
                                ) : messages.length === 0 ? (
                                    <div className="msgs-empty"><p>No messages yet — say hello!</p></div>
                                ) : (
                                    messages.map((msg, i) => {
                                        const isMine = msg.sender_id === user?.id;
                                        const prevMsg = messages[i - 1];
                                        const showTime = !prevMsg || (new Date(msg.created_at) - new Date(prevMsg.created_at)) > 5 * 60 * 1000;
                                        return (
                                            <div key={msg.id}>
                                                {showTime && <div className="time-divider">{formatTime(msg.created_at)}</div>}
                                                <div className={`msg-row ${isMine ? 'mine' : 'theirs'}`}>
                                                    {!isMine && <div className="avatar avatar-xs">{initials(activeConvo.other?.full_name)}</div>}
                                                    <div className={`bubble ${isMine ? 'bubble-mine' : 'bubble-theirs'}`}>{msg.content}</div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={msgEndRef} />
                            </div>

                            {chatMode === 'gigs' && activeConvo && !activeConvo.isProvider && activeConvo.status === 'delivered' && activeConvo.payment_status === 'escrowed' && (
                                <div className="escrow-banner">
                                    <div className="escrow-banner-icon">🔒</div>
                                    <div className="escrow-banner-info">
                                        <p className="escrow-banner-title">Provider marked this gig as done</p>
                                        <p className="escrow-banner-sub">Review the work and release payment, or file a dispute.</p>
                                        {activeConvo.auto_release_date && (
                                            <p className="escrow-banner-timer">Auto-releases {new Date(activeConvo.auto_release_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                                        )}
                                    </div>
                                    <div className="escrow-banner-actions">
                                        <button className="btn btn-accept btn-sm" onClick={() => releaseFundsAndComplete(activeConvo.gig_request_id)}>Release Funds</button>
                                        <button className="btn btn-decline btn-sm" onClick={() => { setPendingDisputeId(activeConvo.gig_request_id); setShowDisputeModal(true); }}>Dispute</button>
                                    </div>
                                </div>
                            )}

                            {chatMode === 'gigs' && activeConvo && activeConvo.payment_status === 'released' && (
                                <div className="escrow-banner escrow-captured">
                                    <span style={{ fontSize: 18 }}>✅</span>
                                    <p style={{ flex: 1, margin: 0, fontWeight: 600, fontSize: 13 }}>Payment released — ${activeConvo.gig?.price?.toFixed(2)} paid to provider</p>
                                </div>
                            )}

                            {chatMode === 'gigs' && activeConvo && activeConvo.payment_status === 'disputed' && (
                                <div className="escrow-banner escrow-disputed">
                                    <span style={{ fontSize: 18 }}>⚠️</span>
                                    <p style={{ flex: 1, margin: 0, fontWeight: 600, fontSize: 13 }}>Payment disputed — under review</p>
                                </div>
                            )}

                            <div className="composer">
                                <textarea
                                    ref={inputRef}
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    onKeyDown={handleKeydown}
                                    placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                                    rows={1}
                                    className="composer-input"
                                />
                                <button
                                    className="btn btn-primary composer-send"
                                    onClick={sendMessage}
                                    disabled={sending || !newMessage.trim()}
                                >
                                    {sending ? (
                                        <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white', width: 14, height: 14 }} />
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </main >
            </div >

            {error && <div className="toast error">{error}</div>}

            {/* ── Profile Modal ── */}
            {
                showProfileModal && modalProfile && (
                    <div className="modal-backdrop" onClick={() => { setShowProfileModal(false); setModalProfile(null); }}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <button className="modal-close" onClick={() => { setShowProfileModal(false); setModalProfile(null); }}>✕</button>

                            <div className="modal-header">
                                <div className="avatar avatar-lg">{initials(modalProfile.full_name)}</div>
                                {/* <div><h2>{modalProfile.full_name}</h2></div> */}
                                <Link to={`/profile/${modalProfile.id}`}>
                                    <h2>{modalProfile.full_name}</h2>
                                </Link>
                                {modalProfile.avgRating && (
                                    <p style={{ margin: 0, fontSize: 14, color: '#92400e' }}>
                                        ★ {modalProfile.avgRating} <span style={{ color: '#6b7280' }}>({modalProfile.ratingCount} review{modalProfile.ratingCount !== 1 ? 's' : ''})</span>
                                    </p>
                                )}
                            </div>



                            {/* {(chatMode === 'swaps' || chatMode === 'gigs') && (
                                <div className="complete-swap">
                                    <div className="complete-swap-header">
                                        <h3>{chatMode === 'swaps' ? 'Complete Swap' : 'Complete Gig'}</h3>
                                        {activeConvo && (() => {
                                            const completionCount = chatMode === 'swaps' ? (activeConvo.requester_completed ? 1 : 0) + (activeConvo.receiver_completed ? 1 : 0) : (activeConvo.requester_completed ? 1 : 0) + (activeConvo.provider_completed ? 1 : 0);
                                            return <span className="completion-badge-large">Complete {completionCount}/2</span>;
                                        })()}
                                    </div>
                                    {activeConvo && (() => {
                                        const isRequester = chatMode === 'swaps' ? activeConvo.requester_id === user?.id : activeConvo.requester_id === user?.id;
                                        const hasVoted = chatMode === 'swaps' ? (isRequester ? activeConvo.requester_completed : activeConvo.receiver_completed) : (isRequester ? activeConvo.requester_completed : activeConvo.provider_completed);
                                        return hasVoted ? (
                                            <button className="btn-unvote-swap" onClick={() => chatMode === 'swaps' ? unmarkSwapComplete(activeConvo.swap_id) : unmarkGigComplete(activeConvo.gig_request_id)}>Remove Vote</button>
                                        ) : (
                                            <button className="btn-complete-swap" onClick={() => chatMode === 'swaps' ? markSwapComplete(activeConvo.swap_id) : markGigComplete(activeConvo.gig_request_id)}>{chatMode === 'swaps' ? 'Vote to Complete Swap' : 'Vote to Complete Gig'}</button>
                                        );
                                    })()}
                                </div>
                            )} */}

                            {chatMode === 'gigs' && activeConvo?.gig && (
                                <div className="modal-section">
                                    <h3>Gig Details</h3>

                                    <p style={{ fontWeight: 600, fontSize: 16 }}>{activeConvo.gig.title}</p>
                                
                                    <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                                        ${activeConvo.gig.price?.toFixed(2)} · {activeConvo.gig.category ?? 'No category'}
                                    </p>

                                    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                                        <div style={{
                                            flex: 1, padding: '10px 14px',
                                            background: 'var(--color-background-tertiary)',
                                            borderRadius: 10, border: '1px solid var(--border)'
                                        }}>
                                            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: '0 0 4px' }}>
                                                Order Status
                                            </p>
                                            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0, textTransform: 'capitalize' }}>
                                                {activeConvo.status?.replace(/_/g, ' ') ?? '—'}
                                            </p>
                                        </div>

                                        <div style={{
                                            flex: 1, padding: '10px 14px',
                                            background: 'var(--color-background-tertiary)',
                                            borderRadius: 10, border: '1px solid var(--border)'
                                        }}>
                                            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: '0 0 4px' }}>
                                                Payment Status
                                            </p>
                                            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0, textTransform: 'capitalize' }}>
                                                {activeConvo.payment_status?.replace(/_/g, ' ') ?? '—'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Gig Completion Actions */}
                                    <div style={{ marginTop: 20 }}>
                                        {/* Buyer: Unpaid — go pay */}
                                        {!activeConvo.isProvider && ['unpaid', 'pending'].includes(activeConvo.payment_status) && activeConvo.status === 'accepted' && (
                                            <button
                                                className="btn btn-primary"
                                                style={{ width: '100%', marginBottom: 10 }}
                                                onClick={() => {
                                                    setShowProfileModal(false);
                                                    navigate(`/my-orders?pay=${activeConvo.gig_request_id}`);
                                                }}>
                                                💳 Pay Now
                                            </button>
                                        )}

                                        {/* Provider: Cancel Order */}
                                        {activeConvo.isProvider && ['pending', 'accepted', 'in_progress'].includes(activeConvo.status) && ['unpaid', 'escrowed'].includes(activeConvo.payment_status) && (
                                            <button
                                                className="btn btn-danger"
                                                style={{ width: '100%', marginBottom: 10 }}
                                                onClick={() => {
                                                    setPendingCancelId(activeConvo.gig_request_id);
                                                    setShowProfileModal(false);
                                                    setShowCancelConfirm(true);
                                                }}>
                                                ✕ Cancel Order
                                            </button>
                                        )}

                                        {/* Provider: Mark as Delivered */}
                                        {activeConvo.isProvider && activeConvo.payment_status === 'escrowed' && activeConvo.status === 'accepted' && (
                                            <button
                                                className="btn btn-primary"
                                                style={{ width: '100%', marginBottom: 10 }}
                                                onClick={() => { markAsDelivered(activeConvo.gig_request_id); setShowProfileModal(false); }}>
                                                📦 Mark as Delivered
                                            </button>
                                        )}


                                        {activeConvo.isProvider && activeConvo.payment_status == 'escrowed' && activeConvo.status == "delivered"&& (
                                            
                                            <button
                                                className='btn btn-primary'
                                                style={{ width: '100%', marginBottom: 10 }} 
                                                onClick={() => { revertMarkAsDelivered(activeConvo.gig_request_id); setShowProfileModal(false); }} 
                                                
                                            >
                                                📦 Revert Delivered
                                            </button>
                                        )}

                                        {/* Provider: Waiting for buyer */}
                                        {activeConvo.isProvider && activeConvo.status === 'delivered' && activeConvo.payment_status === 'escrowed' && (
                                            <div style={{ padding: '12px 14px', background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, fontSize: 13, color: '#a16207' }}>
                                                ⏳ Waiting for buyer to release funds...
                                            </div>
                                        )}

                                        {/* Buyer: Release Funds after delivery */}
                                        {!activeConvo.isProvider && activeConvo.status === 'delivered' && activeConvo.payment_status === 'escrowed' && (
                                            <>
                                                <div style={{ padding: '12px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, fontSize: 13, color: '#166534', marginBottom: 10 }}>
                                                    ✅ Work delivered! Review and release payment.
                                                </div>
                                                <button
                                                    className="btn btn-primary"
                                                    style={{ width: '100%', marginBottom: 10 }}
                                                    onClick={() => { releaseFundsAndComplete(activeConvo.gig_request_id); setShowProfileModal(false); }}>
                                                    💰 Release Funds & Complete
                                                </button>
                                                <button
                                                    className="btn btn-secondary"
                                                    style={{ width: '100%' }}
                                                    onClick={() => {
                                                        setPendingDisputeId(activeConvo.gig_request_id);
                                                        setShowProfileModal(false);
                                                        setShowDisputeModal(true);
                                                    }}>
                                                    ⚠️ File Dispute
                                                </button>
                                            </>
                                        )}

                                        {/* Buyer: Withdraw before work starts */}
                                        {!activeConvo.isProvider && activeConvo.payment_status === 'escrowed' && activeConvo.status === 'accepted' && (
                                            <button
                                                className="btn chat-withdraw-btn"
                                                style={{ width: '100%', marginTop: 10 }}
                                                onClick={() => {
                                                    setPendingWithdrawId(activeConvo.gig_request_id);
                                                    setShowProfileModal(false);
                                                    setShowWithdrawConfirm(true);
                                                }}>
                                                <span>↩</span> Withdraw & Cancel
                                            </button>
                                        )}

                                        {/* Completed state */}
                                        {activeConvo.payment_status === 'released' && (
                                            <div style={{ padding: '12px 14px', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, fontSize: 13, color: '#065f46' }}>
                                                ✓ Payment released. Gig completed!
                                            </div>
                                        )}

                                        {/* Disputed state */}
                                        {activeConvo.payment_status === 'disputed' && (
                                            <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
                                                ⚠️ Payment disputed. Under review.
                                            </div>
                                        )}

                                        {/* Withdrawn state (also catches legacy 'refunded') */}
                                        {(activeConvo.status === 'withdrawn' || activeConvo.payment_status === 'withdrawn' || activeConvo.payment_status === 'refunded') && (
                                            <div style={{ padding: '12px 14px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, color: '#4b5563' }}>
                                                ✓ Order withdrawn. Payment returned.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {modalProfile.bio && (
                                <div className="modal-section">
                                    <h3>About {modalProfile.full_name}:</h3>
                                    <p className="bio">{modalProfile.bio}</p>
                                </div>
                            )}
                            {chatMode === 'swaps' && (
                                <>
                                    <div className="modal-section">
                                        <h3>Can teach</h3>
                                        <div className="skill-tags">
                                            {(modalProfile.skills_teach ?? []).map((s, i) => (
                                                <span key={i} className="skill-tag skill-teach">{getSkillName(s)}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="modal-section">
                                        <h3>Wants to learn</h3>
                                        <div className="skill-tags">
                                            {(modalProfile.skills_learn ?? []).map((s, i) => (
                                                <span key={i} className="skill-tag skill-learn">{getSkillName(s)}</span>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeConvo && (chatMode === 'gigs' ? isGigCompleted(activeConvo) : isSwapCompleted(activeConvo)) && (
                                <div className="modal-section">
                                    <button className="btn-rate-user" onClick={() => {
                                        setShowProfileModal(false);
                                        setModalProfile(null);
                                        setShowRatingModal(true);
                                    }}>
                                        ⭐ Rate {modalProfile.full_name}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div >
                )
            }

            {/* ── Withdraw Confirm Modal ── */}
            {showWithdrawConfirm && (
                <div className="modal-backdrop" onClick={() => setShowWithdrawConfirm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center', padding: '32px 28px 24px' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
                        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 12px' }}>Withdraw Order?</h2>
                        <p style={{ fontSize: 15, color: '#374151', margin: '0 0 6px', lineHeight: 1.5 }}>
                            This will <strong>cancel the order</strong> and return your payment.
                        </p>
                        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px', lineHeight: 1.5 }}>
                            Once withdrawn, this cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button className="btn btn-secondary" style={{ minWidth: 120 }} onClick={() => setShowWithdrawConfirm(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                style={{ minWidth: 120 }}
                                onClick={() => {
                                    setShowWithdrawConfirm(false);
                                    handleRefund(pendingWithdrawId);
                                    setPendingWithdrawId(null);
                                }}>
                                Yes, Withdraw
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Cancel Confirm Modal ── */}
            {showCancelConfirm && (
                <div className="modal-backdrop" onClick={() => setShowCancelConfirm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center', padding: '32px 28px 24px' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>🚫</div>
                        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 12px' }}>Cancel Order?</h2>
                        <p style={{ fontSize: 15, color: '#374151', margin: '0 0 6px', lineHeight: 1.5 }}>
                            This will <strong>cancel the order</strong>. If the buyer already paid, their payment will be refunded.
                        </p>
                        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px', lineHeight: 1.5 }}>
                            This cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button className="btn btn-secondary" style={{ minWidth: 120 }} onClick={() => setShowCancelConfirm(false)}>
                                Go Back
                            </button>
                            <button
                                className="btn btn-danger"
                                style={{ minWidth: 120 }}
                                onClick={() => {
                                    setShowCancelConfirm(false);
                                    cancelOrder(pendingCancelId);
                                    setPendingCancelId(null);
                                }}>
                                Yes, Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Dispute Modal ── */}
            {showDisputeModal && (
                <div className="modal-backdrop" onClick={() => { setShowDisputeModal(false); setDisputeReason(''); }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, padding: '28px 28px 24px' }}>
                        <button className="modal-close" onClick={() => { setShowDisputeModal(false); setDisputeReason(''); }}>✕</button>

                        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
                        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>File a Dispute</h2>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.6 }}>
                            Filing a dispute puts the payment <strong>on hold</strong> and notifies our support team to review the situation. Only file a dispute if there's a genuine issue with the service.
                        </p>

                        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
                            <strong>Before filing:</strong> Have you tried resolving this with the seller via chat? Most issues can be resolved directly without a dispute.
                        </div>

                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
                            Describe the issue <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <textarea
                            value={disputeReason}
                            onChange={e => setDisputeReason(e.target.value)}
                            placeholder="e.g. The work delivered doesn't match what was agreed. The seller did not respond after payment..."
                            rows={4}
                            style={{
                                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                                border: '1.5px solid var(--border)', borderRadius: 8,
                                fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
                                outline: 'none', lineHeight: 1.5,
                                color: 'var(--text-primary)', background: 'var(--surface)',
                            }}
                        />

                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <button
                                className="btn btn-secondary"
                                style={{ flex: 1 }}
                                onClick={() => { setShowDisputeModal(false); setDisputeReason(''); }}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{ flex: 1, background: '#ef4444', opacity: (!disputeReason.trim() || disputeSubmitting) ? 0.5 : 1 }}
                                disabled={!disputeReason.trim() || disputeSubmitting}
                                onClick={() => disputePayment(pendingDisputeId, disputeReason)}>
                                {disputeSubmitting ? 'Filing...' : '⚠️ File Dispute'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Rating Modal ── */}
            {
                showRatingModal && activeConvo && (
                    <div className="modal-backdrop" onClick={closeRatingModal}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <button className="modal-close" onClick={closeRatingModal}>✕</button>
                            <div className="modal-header">
                                <div>
                                    <h2>Rate Your Experience</h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>
                                        How was your {chatMode === 'swaps' ? 'swap' : 'experience'} with {activeConvo.other?.full_name}?
                                    </p>
                                </div>
                            </div>
                            <div className="rating-section">
                                <h3>Your Rating</h3>
                                <div className="star-rating">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button key={star} className={`star-btn${ratingValue >= star ? ' active' : ''}`} onClick={() => setRatingValue(star)}>★</button>
                                    ))}
                                </div>
                                <p className="rating-description">{RATING_LABELS[ratingValue]}</p>
                            </div>
                            <div className="modal-section">
                                <h3>Comment (Optional)</h3>
                                <textarea
                                    value={ratingComment}
                                    onChange={e => setRatingComment(e.target.value)}
                                    placeholder="Share your experience..."
                                    className="rating-comment"
                                    rows={4}
                                />
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={closeRatingModal}>Skip for Now</button>
                                <button className="btn btn-primary" onClick={submitRating} disabled={ratingValue === 0}>Submit Rating</button>
                            </div>
                        </div>
                    </div>
                )
            }

            <style>{`
            .chat-shell { display: flex; height: calc(100vh - 90px); overflow: hidden; background: var(--bg); }

            /* Sidebar */
            .sidebar { width: 300px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid var(--border); background: var(--surface); overflow: hidden; }
            .sidebar-header { padding: 20px 20px 16px; border-bottom: 1px solid var(--border); }
            .sidebar-title { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
            .chat-mode-toggle { display: flex; gap: 0; background: var(--surface-alt); border-radius: var(--r); padding: 3px; border: 1px solid var(--border); }
            .mode-btn { flex: 1; padding: 7px 12px; border: none; border-radius: calc(var(--r) - 2px); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; background: transparent; color: var(--text-secondary); }
            .mode-btn:hover { color: var(--text); }
            .mode-btn.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .chat-tabs { display: flex; gap: 8px; margin-top: 12px; }
            .chat-tab { flex: 1; padding: 8px 12px; background: var(--surface-alt); border: 1px solid var(--border); border-radius: var(--r); font-size: 13px; font-weight: 500; color: var(--text-secondary); cursor: pointer; transition: all 0.2s; }
            .chat-tab:hover { background: var(--surface); border-color: var(--border-strong); }
            .chat-tab.active { background: var(--primary); color: white; border-color: var(--primary); }
            .sidebar-loading, .sidebar-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 20px; color: var(--text-secondary); font-size: 13px; text-align: center; gap: 4px; }
            .convo-list { list-style: none; overflow-y: auto; flex: 1; padding: 8px; }
            .convo-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border-radius: var(--r); border: none; background: transparent; cursor: pointer; text-align: left; transition: background 0.15s; font-family: var(--font-body); }
            .convo-item:hover { background: var(--surface-alt); }
            .convo-item.active { background: var(--primary-light); }
            .convo-info { flex: 1; min-width: 0; }
            .convo-name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .convo-preview { font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
            .convo-time { font-size: 11px; color: var(--text-muted); flex-shrink: 0; align-self: flex-start; margin-top: 2px; }
            .avatar-xs { width: 26px !important; height: 26px !important; font-size: 10px !important; flex-shrink: 0; }
            .avatar-sm { width: 34px !important; height: 34px !important; font-size: 12px !important; flex-shrink: 0; }

            /* Main */
            .chat-main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
            .chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-secondary); }
            .chat-empty h3 { font-size: 20px; color: var(--text); }
            .chat-empty p { font-size: 14px; }
            .chat-header { display: flex; align-items: flex-start; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
            .chat-header-sub { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
            .chat-name-btn { background: none; border: none; font-size: 15px; font-weight: 600; color: var(--primary); cursor: pointer; padding: 0; text-decoration: underline; text-decoration-color: transparent; transition: text-decoration-color 0.2s; text-align: left; }
            .chat-name-btn:hover { text-decoration-color: var(--primary); }
            .completion-badge-chat { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 12px; background: var(--primary-light); color: var(--primary); border: 1px solid var(--primary-mid); white-space: nowrap; }
            .gig-chat-badge { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 12px; background: #FFF7ED; color: #C2410C; border: 1px solid #FDBA74; white-space: nowrap; }
            .convo-gig-label { font-size: 11px; color: #C2410C; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
            .chat-role-tabs { display: flex; gap: 0; margin-top: 8px; background: var(--surface-alt); border-radius: calc(var(--r) - 2px); padding: 2px; border: 1px solid var(--border); }
            .role-tab { flex: 1; padding: 5px 8px; border: none; border-radius: calc(var(--r) - 3px); font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s; background: transparent; color: var(--text-muted); }
            .role-tab:hover { color: var(--text); }
            .role-tab.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
            .convo-role-badge { font-size: 9px; font-weight: 600; padding: 1px 6px; border-radius: 8px; white-space: nowrap; flex-shrink: 0; }
            .role-hiring { background: #DBEAFE; color: #1D4ED8; border: 1px solid #93C5FD; }
            .role-providing { background: #D1FAE5; color: #065F46; border: 1px solid #6EE7B7; }

            /* Messages */
            .messages-area { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 4px; min-height: 0; }
            .msgs-loading, .msgs-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 14px; }
            .time-divider { text-align: center; font-size: 11px; color: var(--text-muted); margin: 12px 0 8px; }
            .msg-row { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 2px; }
            .msg-row.mine { justify-content: flex-end; }
            .msg-row.theirs { justify-content: flex-start; }
            .bubble { max-width: 68%; padding: 10px 14px; border-radius: 18px; font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
            .bubble-mine { background: var(--primary); color: white; border-bottom-right-radius: 4px; }
            .bubble-theirs { background: var(--surface); border: 1px solid var(--border); color: var(--text); border-bottom-left-radius: 4px; }

            /* Composer */
            .composer { display: flex; align-items: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--border); background: #a06840; flex-shrink: 0; position: sticky; bottom: 0; z-index: 10; }
            .composer-input { flex: 1; resize: none; border: 1px solid var(--border); border-radius: var(--r-lg); padding: 10px 16px; font-size: 14px; font-family: var(--font-body); color: var(--text); background: white; outline: none; max-height: 120px; overflow-y: auto; line-height: 1.5; transition: border-color 0.15s; }
            .composer-input:focus { border-color: var(--primary); }
            .composer-send { width: 40px; height: 40px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: var(--r-full); flex-shrink: 0; }
            .composer-send:disabled { opacity: 0.45; }

            /* Escrow Banner */
            .escrow-banner { display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: #FFF7ED; border-top: 1px solid #FDBA74; flex-shrink: 0; }
            .escrow-banner-icon { font-size: 24px; flex-shrink: 0; }
            .escrow-banner-info { flex: 1; min-width: 0; }
            .escrow-banner-title { font-size: 13px; font-weight: 700; color: #92400E; margin: 0; }
            .escrow-banner-sub { font-size: 12px; color: #B45309; margin: 2px 0 0; }
            .escrow-banner-timer { font-size: 11px; color: #D97706; margin: 4px 0 0; font-weight: 500; }
            .escrow-banner-actions { display: flex; gap: 8px; flex-shrink: 0; }
            .escrow-captured { background: #F0FDF4; border-top: 1px solid #86EFAC; }
            .escrow-disputed { background: #FEF2F2; border-top: 1px solid #FCA5A5; }

            /* Modals */
            .modal-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
            .modal-header h2 { margin: 0; font-size: 24px; }
            .modal-section { margin-bottom: 24px;  }
            .modal-section h3 { font-size: 14px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
            .modal-section .bio { color: var(--text-secondary); line-height: 1.6; }
            .modal-close { position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); }
            .btn-danger { background: #ef4444; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
            .btn-danger:hover { background: #dc2626; }
            .chat-withdraw-btn { display: flex; align-items: center; justify-content: center; gap: 7px; background: #fff5f5; border: 1.5px solid #fca5a5; color: #dc2626; padding: 10px 18px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
            .chat-withdraw-btn:hover { background: #fee2e2; border-color: #ef4444; color: #b91c1c; }
            .modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
            .skill-tags { display: flex; flex-wrap: wrap; gap: 8px; }

            /* Complete swap */
            .complete-swap { margin: 20px 0; }
            .complete-swap-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
            .complete-swap-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
            .completion-badge-large { font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 12px; background: var(--primary-light); color: var(--primary); border: 1px solid var(--primary-mid); white-space: nowrap; }
            .btn-complete-swap { width: 100%; padding: 14px 24px; background: #10b981; color: white; border: none; border-radius: var(--r-lg); font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(16,185,129,0.3); }
            .btn-complete-swap:hover { background: #059669; box-shadow: 0 4px 12px rgba(16,185,129,0.4); transform: translateY(-1px); }
            .btn-complete-swap:active { transform: translateY(0); }
            .btn-unvote-swap { width: 100%; padding: 14px 24px; background: #ef4444; color: white; border: none; border-radius: var(--r-lg); font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(239,68,68,0.3); }
            .btn-unvote-swap:hover { background: #dc2626; box-shadow: 0 4px 12px rgba(239,68,68,0.4); transform: translateY(-1px); }
            .btn-unvote-swap:active { transform: translateY(0); }

            /* Rate User */
            .btn-rate-user { width: 100%; padding: 12px 24px; background: #FBBF24; color: #78350F; border: none; border-radius: var(--r-lg); font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(251,191,36,0.3); }
            .btn-rate-user:hover { background: #F59E0B; box-shadow: 0 4px 12px rgba(251,191,36,0.4); transform: translateY(-1px); }

            /* Rating */
            .rating-section { margin: 24px 0; text-align: center; }
            .rating-section h3 { font-size: 14px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
            .star-rating { display: flex; justify-content: center; gap: 8px; margin-bottom: 12px; }
            .star-btn { background: none; border: none; font-size: 48px; color: #ddd; cursor: pointer; transition: all 0.2s; padding: 0; line-height: 1; }
            .star-btn:hover { transform: scale(1.1); }
            .star-btn.active { color: #fbbf24; }
            .rating-description { font-size: 14px; color: var(--text-secondary); font-weight: 500; min-height: 20px; }
            .rating-comment { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: var(--r); font-family: var(--font-body); font-size: 14px; resize: vertical; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
            .rating-comment:focus { border-color: var(--primary); }

            /* Responsive */
            @media (max-width: 600px) {
              .sidebar { width: 72px; }
              .convo-info, .convo-time { display: none; }
              .sidebar-title { font-size: 14px; }
              .convo-item { justify-content: center; padding: 10px; }
            }
          `}</style>
        </>
    );
}