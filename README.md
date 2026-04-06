# Vôlei Pro - Placar & Sorteio

Aplicativo profissional para gestão de partidas de vôlei.

## 🚀 Funcionalidades
- **Placar Digital**: Interface imersiva de quadra com tap-to-score.
- **Sorteador Inteligente**: Gere times equilibrados e evite repetições.
- **Gestão de Atletas**: Cadastro fixo e suporte a jogadores temporários.
- **Histórico**: Acompanhe resultados de jogos e sorteios passados.
- **Persistência**: Integração completa com Supabase.

## 🛠️ Configuração do Supabase

Para habilitar a persistência em nuvem, crie as seguintes tabelas no seu projeto Supabase:

### 1. Players
```sql
create table players (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

### 2. Settings
```sql
create table settings (
  id uuid default gen_random_uuid() primary key,
  points_per_set integer default 25,
  max_sets integer default 3,
  team_a_color text default '#3b82f6',
  team_b_color text default '#ef4444',
  team_a_name text default 'Time A',
  team_b_name text default 'Time B'
);
```

### 3. Matches
```sql
create table matches (
  id uuid default gen_random_uuid() primary key,
  team_a_score integer,
  team_b_score integer,
  sets_a integer,
  sets_b integer,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

### 4. Draws
```sql
create table draws (
  id uuid default gen_random_uuid() primary key,
  teams jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

## 📦 Variáveis de Ambiente
Adicione ao seu `.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
