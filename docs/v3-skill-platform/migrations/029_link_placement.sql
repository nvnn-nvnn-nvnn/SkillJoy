

ALTER TABLE store_links
    ADD COLUMN IF NOT EXISTS placement TEXT NOT NULL DEFAULT 'profile'
    CHECK (placement IN ('profile', 'products')),

    ADD COLUMN IF NOT EXISTS description TEXT,

    ADD COLUMN IF NOT EXISTS cover_url TEXT,

    ADD COLUMN IF NOT EXISTS cta_label TEXT,

    ADD COLUMN IF NOT EXISTS group_label TEXT;





