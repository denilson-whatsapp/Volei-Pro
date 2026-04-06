import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useSync(groupId: string | null, state: any, onSync: (state: any) => void) {
  const isRemoteUpdate = useRef(false);
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!groupId) return;

    const fetchInitialState = async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('score_state')
        .eq('id', groupId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching initial state:', error);
      } else if (data?.score_state) {
        isRemoteUpdate.current = true;
        onSync(data.score_state);
        setTimeout(() => {
          isRemoteUpdate.current = false;
        }, 100);
      }
      hasSynced.current = true;
    };

    fetchInitialState();

    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'groups',
          filter: `id=eq.${groupId}`,
        },
        (payload) => {
          if (payload.new.score_state) {
            isRemoteUpdate.current = true;
            onSync(payload.new.score_state);
            setTimeout(() => {
              isRemoteUpdate.current = false;
            }, 100);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  useEffect(() => {
    if (!groupId || isRemoteUpdate.current || !hasSynced.current) return;

    const updateState = async () => {
      const { error } = await supabase
        .from('groups')
        .upsert({ id: groupId, score_state: state }, { onConflict: 'id' });

      if (error) {
        console.error('Error updating state:', error);
      }
    };

    const timeoutId = setTimeout(updateState, 500);
    return () => clearTimeout(timeoutId);
  }, [state, groupId]);
}
