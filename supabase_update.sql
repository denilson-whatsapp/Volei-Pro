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

-- Update scoreboard table with team players
ALTER TABLE scoreboard ADD COLUMN IF NOT EXISTS team_a_players JSONB DEFAULT '[]';
ALTER TABLE scoreboard ADD COLUMN IF NOT EXISTS team_b_players JSONB DEFAULT '[]';

-- Ensure Realtime is enabled for these tables
-- Note: You might need to run these separately if they are already in a publication
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE scoreboard;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;

-- Create storage bucket for avatars if it doesn't exist
-- This usually needs to be done via the Supabase UI or a specific API call,
-- but here is the SQL to enable public access if the bucket is created.
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
