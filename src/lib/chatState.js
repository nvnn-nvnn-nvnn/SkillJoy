// Chat state persistence utilities

export function saveChatState(userId, mode, activeSwapId, activeGigReqId) {
    if (!userId) return;

    try {
        const state = {
            mode,
            activeSwapId: mode === 'swaps' ? activeSwapId : null,
            activeGigReqId: mode === 'gigs' ? activeGigReqId : null
        };
        console.log('💾 Saving chat state:', state);
        localStorage.setItem(`chat_state_${userId}`, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save chat state:', e);
    }
}

export function loadChatState(userId) {
    if (!userId) return null;

    try {
        const saved = localStorage.getItem(`chat_state_${userId}`);
        const parsed = saved ? JSON.parse(saved) : null;
        console.log('📂 Loading chat state:', parsed);
        return parsed;
    } catch (e) {
        console.error('Failed to load chat state:', e);
        return null;
    }
}

export function clearChatState(userId) {
    if (!userId) return;

    try {
        localStorage.removeItem(`chat_state_${userId}`);
    } catch (e) {
        console.error('Failed to clear chat state:', e);
    }
}
