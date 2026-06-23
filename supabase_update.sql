-- ====================================================================
-- SCRIPT DE RECRIACAO COMPLETO DO BANCO DE DADOS (VÔLEI PRO)
-- Este script apaga todas as tabelas antigas (evitando conflitos devido
-- a alterações parciais de esquema) e recria a estrutura limpa e do zero.
-- ====================================================================

-- 1. APAGAR TABELAS EXISTENTES (Em ordem para evitar erros de chave estrangeira)
DROP TABLE IF EXISTS draws CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS scoreboard CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- 2. CRIAR TABELA DE TURMAS / CONFIGURACOES ("settings")
-- Guarda as turmas criadas, as senhas de acesso (password) e configurações dinâmicas
CREATE TABLE settings (
    group_id TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{
        "points_per_set": 25,
        "max_sets": 3,
        "team_a_name": "Time A",
        "team_b_name": "Time B",
        "team_a_color": "#3b82f6",
        "team_b_color": "#ef4444",
        "enable_sounds": true,
        "enable_voice": true
    }'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CRIAR TABELA DE JOGADORES ("players")
-- Guarda a lista de jogadores, status e estatísticas de jogo associadas a um grupo
CREATE TABLE players (
    id UUID PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES settings(group_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    photo_url TEXT NULL,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    games_played INTEGER NOT NULL DEFAULT 0,
    sets_won INTEGER NOT NULL DEFAULT 0,
    sets_lost INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexar consultas comuns para melhorar performance
CREATE INDEX IF NOT EXISTS idx_players_group_id ON players(group_id);

-- 4. CRIAR TABELA DE MATCHES / HISTORICO ("matches")
-- Guarda o resultado oficial de partidas finalizadas
CREATE TABLE matches (
    id UUID PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES settings(group_id) ON DELETE CASCADE,
    team_a_score INTEGER NOT NULL DEFAULT 0,
    team_b_score INTEGER NOT NULL DEFAULT 0,
    sets_a INTEGER NOT NULL DEFAULT 0,
    sets_b INTEGER NOT NULL DEFAULT 0,
    team_a_players JSONB NOT NULL DEFAULT '[]'::jsonb,
    team_b_players JSONB NOT NULL DEFAULT '[]'::jsonb,
    winner_team TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_group_id ON matches(group_id);

-- 5. CRIAR TABELA DE HISTORICO DE SORTEIOS ("draws")
-- Guarda o registro de times sorteados pelo gerador de partidas
CREATE TABLE draws (
    id UUID PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES settings(group_id) ON DELETE CASCADE,
    teams JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draws_group_id ON draws(group_id);

-- 6. CRIAR TABELA DE PLACAR EM TEMPO REAL ("scoreboard")
-- Controla a partida em andamento e sincronizacao de som/voz
CREATE TABLE scoreboard (
    group_id TEXT PRIMARY KEY REFERENCES settings(group_id) ON DELETE CASCADE,
    score_a INTEGER NOT NULL DEFAULT 0,
    score_b INTEGER NOT NULL DEFAULT 0,
    sets_a INTEGER NOT NULL DEFAULT 0,
    sets_b INTEGER NOT NULL DEFAULT 0,
    is_swapped BOOLEAN NOT NULL DEFAULT FALSE,
    seconds INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    team_a_players JSONB NOT NULL DEFAULT '[]'::jsonb,
    team_b_players JSONB NOT NULL DEFAULT '[]'::jsonb,
    team_a_on_court JSONB NOT NULL DEFAULT '[]'::jsonb,
    team_b_on_court JSONB NOT NULL DEFAULT '[]'::jsonb,
    waiting_teams JSONB NOT NULL DEFAULT '[]'::jsonb,
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.5. RETIRAR SEGURANÇA DE LINHA (RLS) PARA ACESSO DIRETO COMPARTILHADO
-- Garante que o aplicativo web envie e receba dados sem bloqueios de RLS no projeto novo
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE draws DISABLE ROW LEVEL SECURITY;
ALTER TABLE scoreboard DISABLE ROW LEVEL SECURITY;

-- 7. ATIVAR SUPABASE REALTIME PARA AS TABELAS
-- Permite que múltiplos telefones e telas vejam as pontuações e quadra mudando ao vivo
DO $$
BEGIN
    -- Se a publicação supabase_realtime não existir por algum motivo, nós a criamos de forma segura
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Adicionar as tabelas na publicação se ainda não forem membros
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE settings;
    END IF;

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
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'draws'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE draws;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'scoreboard'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE scoreboard;
    END IF;
END $$;

-- 8. CONFIGURACAO DO BUCKET DE AVATARES / IMAGENS DE JOGADORES
-- Cria o bucket publico "avatars" para as fotos de perfil se ele não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Configurar políticas de acesso público ao Storage (permite inserção e visualização)
-- Removemos políticas duplicadas se existirem para evitar erros durante a publicação do script
DROP POLICY IF EXISTS "Fotos de perfil públicas" ON storage.objects;
DROP POLICY IF EXISTS "Upload livre para avatares" ON storage.objects;

CREATE POLICY "Fotos de perfil públicas" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Upload livre para avatares" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars');
