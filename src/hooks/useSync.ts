import { useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured, dbSaveScoreboard, dbFetchScoreboard } from '../lib/supabase';
import { SyncManager } from '../lib/syncManager';

export function useSync(groupId: string | null, state: any, onSync: (newState: any) => void) {
  const isRemoteUpdate = useRef(false);
  const lastUpdate = useRef<string>(new Date().toISOString());
  const onSyncRef = useRef(onSync);

  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  // Initial fetch
  useEffect(() => {
    if (!groupId || !isSupabaseConfigured) return;

    const fetchInitial = async () => {
      const data = await dbFetchScoreboard(groupId);
      if (data) {
        isRemoteUpdate.current = true;
        onSyncRef.current({
          scoreA: data.score_a,
          scoreB: data.score_b,
          setsA: data.sets_a,
          setsB: data.sets_b,
          isSwapped: data.is_swapped,
          seconds: data.seconds,
          isActive: data.is_active,
          teamAPlayers: data.team_a_players || [],
          teamBPlayers: data.team_b_players || [],
          teamAOnCourt: data.team_a_on_court || Array(6).fill(null),
          teamBOnCourt: data.team_b_on_court || Array(6).fill(null),
          waitingTeams: data.waiting_teams || []
        });
        setTimeout(() => { isRemoteUpdate.current = false; }, 100);
      }
    };

    fetchInitial();
  }, [groupId]);

  // Realtime subscription
  useEffect(() => {
    if (!groupId || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`scoreboard:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scoreboard',
          filter: `group_id=eq.${groupId}`
        },
        (payload) => {
          if (isRemoteUpdate.current) return;
          
          const data = payload.new;
          isRemoteUpdate.current = true;
          onSyncRef.current({
            scoreA: data.score_a,
            scoreB: data.score_b,
            setsA: data.sets_a,
            setsB: data.sets_b,
            isSwapped: data.is_swapped,
            seconds: data.seconds,
            isActive: data.is_active,
            teamAPlayers: data.team_a_players || [],
            teamBPlayers: data.team_b_players || [],
            teamAOnCourt: data.team_a_on_court || Array(6).fill(null),
            teamBOnCourt: data.team_b_on_court || Array(6).fill(null),
            waitingTeams: data.waiting_teams || []
          });
          setTimeout(() => { isRemoteUpdate.current = false; }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  // Push updates to Supabase
  useEffect(() => {
    if (!groupId || !isSupabaseConfigured || isRemoteUpdate.current) return;

    const now = new Date().getTime();
    const last = new Date(lastUpdate.current).getTime();
    
    // Throttle updates to once every 500ms to avoid spamming Supabase
    if (now - last < 500) return;

    lastUpdate.current = new Date().toISOString();
    SyncManager.addToQueue({ type: 'scoreboard', groupId, data: state });
    dbSaveScoreboard(groupId, state);
  }, [state, groupId]);
}
