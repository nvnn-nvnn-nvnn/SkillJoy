-- Create favorites table for users to favorite other users (for both swaps and gigs)
create table if not exists favorites (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references profiles(id) on delete cascade,
    favorited_id uuid not null references profiles(id) on delete cascade,
    created_at timestamptz default now(),
    
    -- Ensure a user can only favorite another user once
    unique(user_id, favorited_id),
    
    -- Prevent self-favoriting
    check (user_id != favorited_id)
);

-- Add RLS policies
alter table favorites enable row level security;

-- Users can view their own favorites
create policy "Users can view their own favorites"
    on favorites for select
    using (auth.uid() = user_id);

-- Users can insert their own favorites
create policy "Users can insert their own favorites"
    on favorites for insert
    with check (auth.uid() = user_id);

-- Users can delete their own favorites
create policy "Users can delete their own favorites"
    on favorites for delete
    using (auth.uid() = user_id);

-- Create index for faster lookups
create index if not exists favorites_user_id_idx on favorites(user_id);
create index if not exists favorites_favorited_id_idx on favorites(favorited_id);
