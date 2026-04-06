import { createClient } from '@supabase/supabase-js';
import { Player } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Helper to check if Supabase is actually configured
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey && supabaseUrl !== 'YOUR_SUPABASE_URL';

if (!isSupabaseConfigured) {
  console.warn('Supabase: Modo Offline/Local ativado. (VITE_SUPABASE_URL não configurada)');
} else {
  console.log('Supabase: Cliente inicializado com sucesso.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// --- Groups / Auth ---
export async function dbCheckGroupExists(groupId: string) {
  if (!isSupabaseConfigured) return false;
  const { data, error } = await supabase
    .from('settings')
    .select('group_id')
    .eq('group_id', groupId)
    .maybeSingle();
  if (error) console.error('Supabase: Error checking group:', error);
  return !!data;
}

export async function dbCreateGroup(groupId: string, password: string) {
  if (!isSupabaseConfigured) {
    return { success: false, message: 'Configuração do Supabase ausente. Adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas configurações.' };
  }
  
  try {
    const exists = await dbCheckGroupExists(groupId);
    if (exists) return { success: false, message: 'Nome de turma indisponível.' };

    const { error } = await supabase
      .from('settings')
      .insert({ 
        group_id: groupId, 
        password: password,
        data: {
          points_per_set: 25,
          max_sets: 3,
          team_a_name: 'Time A',
          team_b_name: 'Time B',
          team_a_color: '#3b82f6',
          team_b_color: '#ef4444',
          enable_sounds: true,
          enable_voice: true
        }
      });

    if (error) {
      console.error('Supabase: Error creating group:', error);
      if (error.message.includes('Invalid API key')) {
        return { success: false, message: 'Erro: Chave de API do Supabase inválida. Verifique se a VITE_SUPABASE_ANON_KEY está correta nas configurações.' };
      }
      if (error.code === '42P01') {
        return { success: false, message: 'Erro técnico: A tabela "settings" não foi encontrada no Supabase. Verifique o SQL Editor.' };
      }
      if (error.code === '42703') {
        return { success: false, message: 'Erro técnico: A coluna "password" não existe na tabela "settings". Execute o comando ALTER TABLE.' };
      }
      return { success: false, message: `Erro ao criar turma: ${error.message}` };
    }
    return { success: true };
  } catch (e: any) {
    console.error('Supabase: Unexpected error in dbCreateGroup:', e);
    return { success: false, message: 'Erro inesperado ao conectar com o banco de dados.' };
  }
}

export async function dbVerifyGroup(groupId: string, password: string) {
  if (!isSupabaseConfigured) return { success: true }; // Local mode

  const { data, error } = await supabase
    .from('settings')
    .select('password')
    .eq('group_id', groupId)
    .maybeSingle();

  if (error) {
    console.error('Supabase: Error verifying group:', error);
    return { success: false, message: 'Erro ao verificar turma.' };
  }

  if (!data) return { success: false, message: 'Turma não encontrada.' };
  if (data.password !== password) return { success: false, message: 'Senha incorreta.' };

  return { success: true };
}

// --- Settings ---
export async function dbSaveSettings(groupId: string, data: any) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('settings')
    .upsert({ group_id: groupId, data, updated_at: new Date().toISOString() });
  if (error) console.error('Supabase: Error saving settings:', error);
}

export async function dbFetchSettings(groupId: string) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('settings')
    .select('data')
    .eq('group_id', groupId)
    .single();
  if (error && error.code !== 'PGRST116') console.error('Supabase: Error fetching settings:', error);
  return data?.data || null;
}

// --- Players ---
export async function dbSavePlayers(groupId: string, players: any[]) {
  if (!isSupabaseConfigured) return;
  
  try {
    // Upsert players to keep stats
    const playersToUpsert = players.map(p => ({
      id: p.id,
      group_id: groupId,
      name: p.name,
      active: p.active,
      photo_url: p.photo_url || null,
      wins: p.wins || 0,
      losses: p.losses || 0,
      games_played: p.games_played || 0,
      sets_won: p.sets_won || 0,
      sets_lost: p.sets_lost || 0
    }));

    const { error } = await supabase.from('players').upsert(playersToUpsert, { onConflict: 'id' });
    if (error) throw error;
  } catch (e) {
    console.error('Supabase: Critical error saving players:', e);
  }
}

export async function dbUpdatePlayerStats(playerId: string, stats: Partial<Player>) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('players')
    .update(stats)
    .eq('id', playerId);
  if (error) console.error('Supabase: Error updating player stats:', error);
}

export async function dbUploadPlayerPhoto(playerId: string, file: File) {
  if (!isSupabaseConfigured) return null;
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${playerId}-${Math.random()}.${fileExt}`;
  const filePath = `player-photos/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Supabase: Error uploading photo:', uploadError);
    return null;
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function dbFetchPlayers(groupId: string) {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('group_id', groupId)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Supabase: Error fetching players:', e);
    return null;
  }
}

// --- Matches ---
export async function dbSaveMatch(groupId: string, match: any) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('matches')
    .insert({
      id: match.id,
      group_id: groupId,
      team_a_score: match.team_a_score,
      team_b_score: match.team_b_score,
      sets_a: match.sets_a,
      sets_b: match.sets_b,
      team_a_players: match.team_a_players || [],
      team_b_players: match.team_b_players || [],
      winner_team: match.winner_team || null,
      created_at: match.created_at
    });
  if (error) console.error('Supabase: Error saving match:', error);
}

export async function dbDeleteMatch(id: string) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('matches')
    .delete()
    .eq('id', id);
  if (error) console.error('Supabase: Error deleting match:', error);
}

export async function dbFetchMatches(groupId: string) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  if (error) console.error('Supabase: Error fetching matches:', error);
  return data || null;
}

// --- Draws ---
export async function dbSaveDraw(groupId: string, draw: any) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('draws')
    .insert({
      id: draw.id,
      group_id: groupId,
      teams: draw.teams,
      created_at: draw.created_at
    });
  if (error) console.error('Supabase: Error saving draw:', error);
}

export async function dbDeleteDraw(id: string) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('draws')
    .delete()
    .eq('id', id);
  if (error) console.error('Supabase: Error deleting draw:', error);
}

export async function dbFetchDraws(groupId: string) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('draws')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  if (error) console.error('Supabase: Error fetching draws:', error);
  return data || null;
}

// --- Scoreboard ---
export async function dbSaveScoreboard(groupId: string, data: any) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('scoreboard')
    .upsert({ 
      group_id: groupId, 
      score_a: data.scoreA,
      score_b: data.scoreB,
      sets_a: data.setsA,
      sets_b: data.setsB,
      is_swapped: data.isSwapped,
      seconds: data.seconds,
      is_active: data.isActive,
      team_a_players: data.teamAPlayers || [],
      team_b_players: data.teamBPlayers || [],
      team_a_on_court: data.teamAOnCourt || [],
      team_b_on_court: data.teamBOnCourt || [],
      waiting_teams: data.waitingTeams || [],
      updated_at: new Date().toISOString() 
    });
  if (error) console.error('Supabase: Error saving scoreboard:', error);
}

export async function dbFetchScoreboard(groupId: string) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('scoreboard')
    .select('*')
    .eq('group_id', groupId)
    .maybeSingle();
  if (error) console.error('Supabase: Error fetching scoreboard:', error);
  return data || null;
}

export async function testSupabaseConnection() {
  if (!isSupabaseConfigured) {
    return { success: false, message: 'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
  }
  try {
    // Use getSession() to test connectivity without needing a specific table
    const { error } = await supabase.auth.getSession();
    
    if (error) {
      // If we get an auth error, it might still mean we connected to Supabase
      // but the key/URL might have issues with Auth.
      // However, usually getSession() just returns null session if not logged in.
      throw error;
    }
    
    return { success: true, message: 'Connected to Supabase successfully.' };
  } catch (error: any) {
    console.error('Supabase connection test failed:', error);
    // If it's a network error, it's a real failure.
    // If it's an API error, it means we at least reached Supabase.
    return { success: false, message: error.message || 'Unknown error connecting to Supabase' };
  }
}
