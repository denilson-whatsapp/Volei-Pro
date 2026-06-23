import { useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured, dbSaveScoreboard, dbFetchScoreboard } from '../lib/supabase';
import { SyncManager } from '../lib/syncManager';

export function useSync(groupId: string | null, state: any, onSync: (newState: any) => void) {
  const isRemoteUpdate = useRef(false);
  const lastUpdate = useRef<string>(new Date().toISOString());
  const onSyncRef = useRef(onSync);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef(state);
  
  // High-performance concurrency fix: Lock remote sync events for a short period after a local user mutation.
  // This completely stops high-frequency click "rollbacks" and echo flickers over real-time database channels.
  const lastLocalChangeTime = useRef<number>(0);
  const lastStateRef = useRef<any>(null);

  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  useEffect(() => {
    // Detect if this state update was a local user mutation (not loaded from remote database sync)
    if (!isRemoteUpdate.current && state) {
      // Check if critical user-acted values changed (ignoring automatically ticking 'seconds')
      const hasCriticalChanged = !lastStateRef.current || 
        lastStateRef.current.scoreA !== state.scoreA ||
        lastStateRef.current.scoreB !== state.scoreB ||
        lastStateRef.current.setsA !== state.setsA ||
        lastStateRef.current.setsB !== state.setsB ||
        lastStateRef.current.isSwapped !== state.isSwapped ||
        lastStateRef.current.isActive !== state.isActive;

      if (hasCriticalChanged) {
        lastLocalChangeTime.current = Date.now();
      }
    }
    
    stateRef.current = state;
    if (state) {
      lastStateRef.current = { ...state };
    }
  }, [state]);

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
          waitingTeams: data.waiting_teams || [],
          history: data.history || []
        });
        setTimeout(() => { isRemoteUpdate.current = false; }, 200);
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
          // If we are currently processing a remote update, ignore incoming changes
          if (isRemoteUpdate.current) return;
          
          const data = payload.new;
          if (!data) return;

          // CRITICAL PROTECTION: If the user locally changed the score, sets, or side within the last 3000ms,
          // ignore remote payloads that conflict with the local state. This prevents asynchronous network delays 
          // from executing a "roll back" or retesting old versions of the scoreboard on high frequencies.
          const timeSinceLastLocalChange = Date.now() - lastLocalChangeTime.current;
          if (timeSinceLastLocalChange < 3000) {
            return;
          }
          
          // Compare payload with current local state ref.
          // If the remote update is identical, ignore it to prevent loop
          const isIdentical = 
            stateRef.current &&
            data.score_a === stateRef.current.scoreA &&
            data.score_b === stateRef.current.scoreB &&
            data.sets_a === stateRef.current.setsA &&
            data.sets_b === stateRef.current.setsB &&
            data.is_swapped === stateRef.current.isSwapped &&
            data.seconds === stateRef.current.seconds &&
            data.is_active === stateRef.current.isActive;

          if (isIdentical) return;

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
            waitingTeams: data.waiting_teams || [],
            history: data.history || []
          });
          setTimeout(() => { isRemoteUpdate.current = false; }, 200);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  // Push updates to Supabase using a trailing-edge throttle scheduler
  useEffect(() => {
    if (!groupId || !isSupabaseConfigured || isRemoteUpdate.current) return;

    const saveToDb = () => {
      lastUpdate.current = new Date().toISOString();
      SyncManager.addToQueue({ type: 'scoreboard', groupId, data: stateRef.current });
      dbSaveScoreboard(groupId, stateRef.current);
    };

    const now = new Date().getTime();
    const last = new Date(lastUpdate.current).getTime();
    const delay = 500; // Throttle to 500ms max rate
    const timeSinceLast = now - last;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (timeSinceLast < delay) {
      // Schedule the saving of the latest state to execute exactly at the end of the 500ms window
      timeoutRef.current = setTimeout(() => {
        saveToDb();
      }, delay - timeSinceLast);
    } else {
      // Enough time has passed, save immediately
      saveToDb();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [state, groupId]);
}
