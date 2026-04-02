import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/stores';

export default function Notifications() {
    const user = useUser();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [expandedIds, setExpandedIds] = useState(new Set());
    const dropdownRef = useRef(null);
    const panelRef = useRef(null);
    const bellRef = useRef(null);
    const [dropdownStyle, setDropdownStyle] = useState({});

    async function loadNotifications() {
        if (!user) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);
        if (!error && data) {
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.read).length);
        }
        setLoading(false);
    }

    useEffect(() => {
        if (!user) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadNotifications();
        const channel = supabase
            .channel('notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                setNotifications(prev => [payload.new, ...prev]);
                setUnreadCount(prev => prev + 1);
            })
            .subscribe();
        return () => { channel.unsubscribe(); };
    }, [user]);

    useEffect(() => {
        function handleClickOutside(event) {
            const inBell = dropdownRef.current?.contains(event.target);
            const inPanel = panelRef.current?.contains(event.target);
            if (!inBell && !inPanel) setShowDropdown(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    async function markAsRead(notificationId) {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId);

        if (!error) {
            setNotifications(prev => 
                prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    }

    async function markAllAsRead() {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', user.id)
            .eq('read', false);

        if (!error) {
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        }
    }

    function handleNotificationClick(notification) {
        markAsRead(notification.id);
        setShowDropdown(false);

        if (notification.type === 'message') {
            navigate(`/chat?${notification.related_type === 'gig' ? 'gig' : 'swap'}=${notification.related_id}`);
        } else if (notification.type === 'swap_request') {
            navigate('/my-swaps');
        } else if (notification.type === 'gig_request') {
            navigate('/my-listings');
        } else if (notification.type === 'dispute_filed' || notification.type === 'dispute_resolved') {
            navigate('/disputes');
        } else if (notification.type === 'order_update' || notification.type === 'order_cancelled' || notification.type === 'gig_completed') {
            navigate('/my-orders');
        }
    }

    function getNotificationIcon(type) {
        switch (type) {
            case 'message':          return '💬';
            case 'swap_request':     return '🔄';
            case 'gig_request':      return '💼';
            case 'dispute_filed':    return '⚠️';
            case 'dispute_resolved': return '✅';
            case 'order_update':     return '📦';
            case 'order_cancelled':  return '🚫';
            case 'gig_completed':    return '🎉';
            default:                 return '🔔';
        }
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    if (!user) return null;

    return (
        <div className="notifications-container" ref={dropdownRef}>
            <button
                className="notifications-bell"
                ref={bellRef}
                onClick={() => {
                    if (!showDropdown && bellRef.current) {
                        const r = bellRef.current.getBoundingClientRect();
                        setDropdownStyle({ top: r.bottom + 8, right: window.innerWidth - r.right });
                    }
                    setShowDropdown(s => !s);
                }}
                aria-label="Notifications"
            >
                🔔
                {unreadCount > 0 && (
                    <span className="notifications-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
            </button>

            {showDropdown && createPortal(
                <>
                    {/* Mobile drawer backdrop */}
                    <div className="notif-mobile-backdrop" onClick={() => setShowDropdown(false)} />

                    <div className="notifications-dropdown" ref={panelRef} style={window.innerWidth > 480 ? dropdownStyle : undefined}>
                        <div className="notifications-header">
                            <h3>Notifications</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {unreadCount > 0 && (
                                    <button
                                        className="mark-all-read-btn"
                                        onClick={markAllAsRead}
                                    >
                                        Mark all read
                                    </button>
                                )}
                                <button className="notif-close-btn" onClick={() => setShowDropdown(false)} aria-label="Close">✕</button>
                            </div>
                        </div>

                        <div className="notifications-list">
                            {loading ? (
                                <div className="notifications-loading">
                                    <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="notifications-empty">
                                    <span style={{ fontSize: 32 }}>🔔</span>
                                    <p>No notifications yet</p>
                                </div>
                            ) : (
                                notifications.map(notification => {
                                    const isExpanded = expandedIds.has(notification.id);
                                    return (
                                        <div
                                            key={notification.id}
                                            className={`notification-item ${!notification.read ? 'unread' : ''} ${isExpanded ? 'expanded' : ''}`}
                                        >
                                            <button
                                                className="notification-item-main"
                                                onClick={() => handleNotificationClick(notification)}
                                            >
                                                <div className="notification-icon">
                                                    {getNotificationIcon(notification.type)}
                                                </div>
                                                <div className="notification-content">
                                                    <p className="notification-title">{notification.title}</p>
                                                    <p className={`notification-message ${isExpanded ? 'expanded' : ''}`}>{notification.message}</p>
                                                    <span className="notification-time">{formatTime(notification.created_at)}</span>
                                                </div>
                                                {!notification.read && <div className="notification-dot" />}
                                            </button>
                                            {notification.message && notification.message.length > 60 && (
                                                <button
                                                    className="notif-expand-btn"
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        setExpandedIds(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(notification.id)) next.delete(notification.id);
                                                            else next.add(notification.id);
                                                            return next;
                                                        });
                                                    }}
                                                >
                                                    {isExpanded ? 'less' : '···'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>,
                document.body
            )}

            <style>{`
                .notifications-container {
                    position: relative;
                }

                .notifications-bell {
                    position: relative;
                    background: transparent;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 8px;
                    transition: background 0.15s;
                }

                .notifications-bell:hover {
                    background: var(--surface-alt);
                }

                .notifications-badge {
                    position: absolute;
                    top: 4px;
                    right: 4px;
                    background: var(--accent);
                    color: white;
                    font-size: 10px;
                    font-weight: 600;
                    padding: 2px 5px;
                    border-radius: 10px;
                    min-width: 16px;
                    text-align: center;
                }

                .notifications-dropdown {
                    position: fixed;
                    width: 380px;
                    max-height: 640px;
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    box-shadow: var(--shadow-lg);
                    z-index: 1000;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .notifications-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--border);
                }

                .notifications-header h3 {
                    font-size: 16px;
                    font-weight: 600;
                    margin: 0;
                }

                .mark-all-read-btn {
                    background: transparent;
                    border: none;
                    color: var(--primary);
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 6px;
                    transition: background 0.15s;
                }

                .mark-all-read-btn:hover {
                    background: var(--surface-alt);
                }

                .notifications-list {
                    overflow-y: auto;
                    flex: 1;
                    min-height: 0;
                }

                .notifications-loading,
                .notifications-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                    gap: 12px;
                }

                .notifications-empty p {
                    color: var(--text-muted);
                    font-size: 14px;
                }

                .notification-item {
                    border: none;
                    background: transparent;
                    width: 100%;
                    transition: background 0.15s, padding 0.2s;
                    border-bottom: 1px solid var(--border);
                    position: relative;
                }

                .notification-item:last-child {
                    border-bottom: none;
                }

                .notification-item.expanded .notification-item-main {
                    padding-top: 20px;
                    padding-bottom: 20px;
                    flex-direction: column;
                    align-items: flex-start;
                }

                .notification-item.unread {
                    background: var(--primary-light);
                }

                .notification-item-main {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 14px 20px;
                    border: none;
                    background: transparent;
                    width: 100%;
                    text-align: left;
                    cursor: pointer;
                    transition: background 0.15s;
                }

                .notification-item-main:hover {
                    background: var(--surface-alt);
                }

                .notification-item.unread .notification-item-main:hover {
                    background: var(--primary-mid);
                }

                .notif-expand-btn {
                    display: block;
                    margin: 0 20px 10px auto;
                    background: transparent;
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    padding: 4px 0;
                    width: 40px;
                    text-align: center;
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--text-muted);
                    cursor: pointer;
                    letter-spacing: 0.05em;
                    transition: background 0.15s, color 0.15s;
                }

                .notif-expand-btn:hover {
                    background: var(--surface-alt);
                    color: var(--text-primary);
                }

                .notification-icon {
                    font-size: 24px;
                    flex-shrink: 0;
                }

                .notification-content {
                    flex: 1;
                    min-width: 0;
                }

                .notification-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0 0 4px 0;
                }

                .notification-message {
                    font-size: 13px;
                    color: var(--text-secondary);
                    margin: 0 0 4px 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                }

                .notification-message.expanded {
                    -webkit-line-clamp: unset;
                    overflow: visible;
                    display: block;
                }

                .notification-time {
                    font-size: 12px;
                    color: var(--text-muted);
                }

                .notification-dot {
                    width: 8px;
                    height: 8px;
                    background: var(--primary);
                    border-radius: 50%;
                    flex-shrink: 0;
                    margin-top: 6px;
                }

                .notif-mobile-backdrop {
                    display: none;
                }

                .notif-close-btn {
                    display: none;
                    background: transparent;
                    border: none;
                    font-size: 16px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 4px 6px;
                    border-radius: 6px;
                    line-height: 1;
                }

                @keyframes notifSlideIn {
                    from { transform: translateX(-100%); }
                    to   { transform: translateX(0); }
                }

                @media (max-width: 480px) {
                    .notif-mobile-backdrop {
                        display: block;
                        position: fixed;
                        inset: 0;
                        background: rgba(0, 0, 0, 0.4);
                        z-index: 999;
                    }

                    .notif-close-btn {
                        display: block;
                    }

                    .notifications-dropdown {
                        position: fixed;
                        top: 0;
                        left: 0;
                        bottom: 0;
                        width: 100vw;
                        height: 100dvh;
                        max-height: 100dvh;
                        border-radius: 0;
                        border: none;
                        z-index: 1000;
                        animation: notifSlideIn 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    }

                    .notifications-list {
                        -webkit-overflow-scrolling: touch;
                    }
                }
            `}</style>
        </div>
    );
}
