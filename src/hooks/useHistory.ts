import { useState, useEffect, useRef } from 'react';
import { Match, Draw } from '../types';
import { io, Socket } from 'socket.io-client';
import { dbSaveMatch, dbSaveDraw, dbFetchMatches, dbFetchDraws, dbDeleteMatch, dbDeleteDraw } from '../lib/supabase';

export function useHistory(groupId: string | null) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const isRemoteUpdate = useRef(false);
  const hasSynced = useRef(false);

  const fetchHistory = async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    // 1. Try Supabase (Source of Truth)
    try {
      if (isSupabaseConfigured) {
        const [dbMatches, dbDraws] = await Promise.all([
          dbFetchMatches(groupId),
          dbFetchDraws(groupId)
        ]);
  
        if (dbMatches !== null && dbDraws !== null) {
          setMatches(dbMatches);
          setDraws(dbDraws);
          localStorage.setItem('voley_matches_' + groupId, JSON.stringify(dbMatches));
          localStorage.setItem('voley_draws_' + groupId, JSON.stringify(dbDraws));
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.error('useHistory: Error fetching from Supabase:', e);
    }

    // 2. Fallback to localStorage
    try {
      const localMatches = JSON.parse(localStorage.getItem('voley_matches_' + groupId) || '[]');
      const localDraws = JSON.parse(localStorage.getItem('voley_draws_' + groupId) || '[]');
      setMatches(localMatches);
      setDraws(localDraws);
    } catch (e) {
      console.error('useHistory: Error parsing from localStorage:', e);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    console.log('useHistory: Initializing for groupId:', groupId);
    
    fetchHistory();

    if (groupId) {
      try {
        const socket = io();
        socketRef.current = socket;
        socket.emit('join-group', groupId + '_history');
        
        socket.on('sync-state', (newState: { matches: Match[], draws: Draw[] }) => {
          console.log('useHistory: Received sync-state:', newState);
          isRemoteUpdate.current = true;
          hasSynced.current = true;
          if (newState.matches) {
            setMatches(newState.matches);
            try {
              localStorage.setItem('voley_matches_' + groupId, JSON.stringify(newState.matches));
            } catch (e) {
              console.error('useHistory: Error saving matches to localStorage:', e);
            }
          }
          if (newState.draws) {
            setDraws(newState.draws);
            try {
              localStorage.setItem('voley_draws_' + groupId, JSON.stringify(newState.draws));
            } catch (e) {
              console.error('useHistory: Error saving draws to localStorage:', e);
            }
          }
          setTimeout(() => { isRemoteUpdate.current = false; }, 100);
        });

        socket.on('request-state', () => {
          console.log('useHistory: Received request-state');
          if (matches.length > 0 || draws.length > 0) {
            socket.emit('update-state', { 
              groupId: groupId + '_history', 
              state: { matches, draws } 
            });
          }
        });

        const timeout = setTimeout(() => {
          console.log('useHistory: Sync timeout reached');
          hasSynced.current = true;
        }, 1000);

        return () => { 
          console.log('useHistory: Disconnecting socket');
          socket.disconnect(); 
          clearTimeout(timeout);
        };
      } catch (e) {
        console.error('useHistory: Error initializing socket:', e);
        hasSynced.current = true;
      }
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !socketRef.current || isRemoteUpdate.current || loading || !hasSynced.current) return;
    socketRef.current.emit('update-state', { 
      groupId: groupId + '_history', 
      state: { matches, draws } 
    });
  }, [matches, draws, groupId]);

  const addMatch = (match: Match) => {
    const updated = [match, ...matches];
    setMatches(updated);
    if (groupId) {
      try {
        localStorage.setItem('voley_matches_' + groupId, JSON.stringify(updated));
      } catch (e) {
        console.error('useHistory: Error saving matches to localStorage:', e);
      }
      dbSaveMatch(groupId, match);
    }
  };

  const deleteMatch = (id: string) => {
    const updated = matches.filter(m => m.id !== id);
    setMatches(updated);
    if (groupId) {
      try {
        localStorage.setItem('voley_matches_' + groupId, JSON.stringify(updated));
      } catch (e) {
        console.error('useHistory: Error saving matches to localStorage:', e);
      }
      dbDeleteMatch(id);
    }
  };

  const addDraw = (draw: Draw) => {
    const updated = [draw, ...draws];
    setDraws(updated);
    if (groupId) {
      try {
        localStorage.setItem('voley_draws_' + groupId, JSON.stringify(updated));
      } catch (e) {
        console.error('useHistory: Error saving draws to localStorage:', e);
      }
      dbSaveDraw(groupId, draw);
    }
  };

  const deleteDraw = (id: string) => {
    const updated = draws.filter(d => d.id !== id);
    setDraws(updated);
    if (groupId) {
      try {
        localStorage.setItem('voley_draws_' + groupId, JSON.stringify(updated));
      } catch (e) {
        console.error('useHistory: Error saving draws to localStorage:', e);
      }
      dbDeleteDraw(id);
    }
  };

  return { matches, draws, addMatch, addDraw, deleteMatch, deleteDraw, loading, refresh: fetchHistory };
}
