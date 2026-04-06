-- Update players table with stats and photo_url
ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS games_played INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS sets_won INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS sets_lost INTEGER DEFAULT 0;

-- Update matches table with team players and winner
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_a_players JSONB DEFAULT '[]';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_b_players JSONB DEFAULT '[]';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_team TEXT;

-- Update scoreboard table with team players and court positions
ALTER TABLE scoreboard ADD COLUMN IF NOT EXISTS team_a_players JSONB DEFAULT '[]';
ALTER TABLE scoreboard ADD COLUMN IF NOT EXISTS team_b_players JSONB DEFAULT '[]';
ALTER TABLE scoreboard ADD COLUMN IF NOT EXISTS team_a_on_court JSONB DEFAULT '[]';
ALTER TABLE scoreboard ADD COLUMN IF NOT EXISTS team_b_on_court JSONB DEFAULT '[]';
ALTER TABLE scoreboard ADD COLUMN IF NOT EXISTS waiting_teams JSONB DEFAULT '[]';

-- Create draws table if it doesn't exist
CREATE TABLE IF NOT EXISTS draws (
    id UUID PRIMARY KEY,
    group_id TEXT NOT NULL,
    teams JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure Realtime is enabled for these tables
-- We use a DO block to avoid errors if the table is already in the publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'players'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE players;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'matches'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE matches;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'scoreboard'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE scoreboard;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE settings;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'draws'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE draws;
    END IF;
END $$;

-- Create storage bucket for avatars if it doesn't exist
-- This usually needs to be done via the Supabase UI or a specific API call,
-- but here is the SQL to enable public access if the bucket is created.
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
