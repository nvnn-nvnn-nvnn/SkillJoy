# 40 — Request to DM Feature (Planned)

**Date:** 2026-05-01

## Overview
Allow any user to DM another user regardless of active swap, with an accept/decline request gate.

## Schema (to add)
```sql
create table message_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id),
  receiver_id uuid references profiles(id),
  note text,           -- optional intro message
  status text check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now()
);
```
Add RLS: sender can insert, receiver can update status, both can read their own rows.

## Build order (user coding this themselves)
1. Schema + RLS policies in Supabase
2. Backend route or direct Supabase insert to send a request
3. Accept/decline logic (update status, unlock conversation)
4. "Request to DM" button on Profile, match cards, gig seller profiles
5. Requests inbox tab inside the existing Messages page

## Notes
- Existing messages table + chat component should carry over — just needs to be unlocked for non-swap convos
- Keep pending requests visually separate from active DMs
