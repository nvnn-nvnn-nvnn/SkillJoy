# Notifications System Setup Guide

## Overview
The notifications system provides real-time in-app notifications for:
- New messages (swap and gig chats)
- New swap requests
- New gig requests
- Accepted swap/gig requests

## Setup Instructions

### 1. Run the Database Migration

Execute the SQL migration file to create the notifications table and triggers:

```bash
# If using Supabase CLI
supabase db push

# Or run the SQL file directly in Supabase Dashboard
# Go to SQL Editor and run: supabase/migrations/create_notifications_table.sql
```

### 2. Verify Installation

The notification bell (🔔) should now appear in the header between the points badge and profile link.

## Features

### Notification Bell
- **Badge**: Shows unread notification count (displays "9+" for 10 or more)
- **Dropdown**: Click the bell to view all notifications
- **Real-time**: New notifications appear instantly via Supabase Realtime

### Notification Types
1. **Messages** (💬)
   - Triggered when someone sends you a message in swap or gig chat
   - Shows sender name and message preview
   - Clicking navigates to the chat

2. **Swap Requests** (🔄)
   - Triggered when someone requests a skill swap with you
   - Shows requester name and swap details
   - Clicking navigates to My Swaps page

3. **Gig Requests** (💼)
   - Triggered when someone requests your gig
   - Shows requester name and gig title
   - Clicking navigates to My Listings page

4. **Accepted Requests**
   - Notifies you when your swap/gig request is accepted

### Mark as Read
- **Single**: Click any notification to mark it as read
- **All**: Click "Mark all read" button in dropdown header

### Auto-Navigation
Clicking a notification automatically:
1. Marks it as read
2. Closes the dropdown
3. Navigates to the relevant page

## Database Schema

### Notifications Table
```sql
- id: UUID (primary key)
- user_id: UUID (references profiles)
- type: TEXT (message, swap_request, gig_request, etc.)
- title: TEXT
- message: TEXT
- read: BOOLEAN (default false)
- related_id: UUID (swap_id or gig_request_id)
- related_type: TEXT (swap, gig, message)
- created_at: TIMESTAMPTZ
```

### Automatic Triggers
The system automatically creates notifications via database triggers:
- `trigger_notify_new_message` - On new messages
- `trigger_notify_swap_request` - On swap requests/accepts
- `trigger_notify_gig_request` - On gig requests/accepts

## Component Files

### Created Files
1. `src/components/Notifications.jsx` - Main notification component
2. `supabase/migrations/create_notifications_table.sql` - Database schema

### Modified Files
1. `src/components/Header.jsx` - Added notification bell to header

## Customization

### Styling
All styles are scoped within the Notifications component. Key CSS classes:
- `.notifications-bell` - Bell button
- `.notifications-badge` - Unread count badge
- `.notifications-dropdown` - Dropdown container
- `.notification-item` - Individual notification
- `.notification-item.unread` - Unread notification highlight

### Time Format
Notifications show relative time:
- "Just now" - < 1 minute
- "Xm ago" - < 1 hour
- "Xh ago" - < 24 hours
- "Xd ago" - < 7 days
- "Mon DD" - Older than 7 days

## Troubleshooting

### Notifications not appearing?
1. Check that the migration ran successfully
2. Verify RLS policies are enabled
3. Check browser console for errors
4. Ensure Supabase Realtime is enabled for the notifications table

### Badge count incorrect?
The count is calculated on load and updated in real-time. Refresh the page to recalculate.

### Dropdown not closing?
Click outside the dropdown or click a notification to close it.

## Future Enhancements
Potential additions:
- Push notifications (browser notifications API)
- Email notifications
- Notification preferences/settings
- Notification grouping
- Delete notifications
- Notification sounds
