import { useState, useEffect, useRef } from 'react';
import { Player } from '../types';
import { io, Socket } from 'socket.io-client';
import { dbSavePlayers, dbFetchPlayers, isSupabaseConfigured } from '../lib/supabase';
import { generateId } from '../lib/utils';
import { SyncManager } from '../lib/syncManager';

export function usePlayers(groupId: string | null) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const isRemoteUpdate = useRef(false);
  const hasSynced = useRef(false);

  useEffect(() => {
    console.log('usePlayers: Initializing for groupId:', groupId);
    fetchPlayers();

    if (groupId) {
      try {
        const socket = io();
        socketRef.current = socket;
        socket.emit('join-group', groupId + '_players');
        socket.on('sync-state', (newState: Player[]) => {
          console.log('usePlayers: Received sync-state:', newState);
          isRemoteUpdate.current = true;
          hasSynced.current = true;
          setPlayers(newState);
          try {
            localStorage.setItem('voley_players_' + groupId, JSON.stringify(newState));
          } catch (e) {
            console.error('usePlayers: Error saving to localStorage:', e);
          }
          setTimeout(() => { isRemoteUpdate.current = false; }, 100);
        });

        socket.on('request-state', () => {
          console.log('usePlayers: Received request-state');
          if (players.length > 0) {
            socket.emit('update-state', { groupId: groupId + '_players', state: players });
          }
        });

        const timeout = setTimeout(() => {
          console.log('usePlayers: Sync timeout reached');
          hasSynced.current = true;
        }, 1000);

        return () => { 
          console.log('usePlayers: Disconnecting socket');
          socket.disconnect(); 
          clearTimeout(timeout);
        };
      } catch (e) {
        console.error('usePlayers: Error initializing socket:', e);
        hasSynced.current = true; // Allow local mode if socket fails
      }
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !socketRef.current || isRemoteUpdate.current || loading || !hasSynced.current) return;
    socketRef.current.emit('update-state', { groupId: groupId + '_players', state: players });
  }, [players, groupId]);

  async function fetchPlayers() {
    if (!groupId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    // 1. Load from Supabase (Source of Truth)
    try {
      if (isSupabaseConfigured) {
        const dbData = await dbFetchPlayers(groupId);
        if (dbData !== null) {
          const mappedPlayers: Player[] = dbData.map((p: any) => ({
            id: p.id,
            name: p.name,
            active: p.active
          }));
          setPlayers(mappedPlayers);
          localStorage.setItem('voley_players_' + groupId, JSON.stringify(mappedPlayers));
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.error('usePlayers: Error fetching from Supabase:', e);
    }

    // 2. Fallback to localStorage if Supabase fails or is empty
    try {
      const local = localStorage.getItem('voley_players_' + groupId);
      if (local) {
        setPlayers(JSON.parse(local));
      }
    } catch (e) {
      console.error('usePlayers: Error parsing from localStorage:', e);
    }
    
    setLoading(false);
  }

  const addPlayer = async (name: string) => {
    const updated = [...players, { name, active: true, id: generateId() }];
    setPlayers(updated);
    if (groupId) {
      try {
        localStorage.setItem('voley_players_' + groupId, JSON.stringify(updated));
      } catch (e) {
        console.error('usePlayers: Error saving to localStorage:', e);
      }
      SyncManager.addToQueue({ type: 'players', groupId, data: updated });
      dbSavePlayers(groupId, updated);
    }
  };

  const togglePlayerActive = async (id: string) => {
    const updated = players.map(p => p.id === id ? { ...p, active: !p.active } : p);
    setPlayers(updated);
    if (groupId) {
      try {
        localStorage.setItem('voley_players_' + groupId, JSON.stringify(updated));
      } catch (e) {
        console.error('usePlayers: Error saving to localStorage:', e);
      }
      SyncManager.addToQueue({ type: 'players', groupId, data: updated });
      dbSavePlayers(groupId, updated);
    }
  };

  const deletePlayer = async (id: string) => {
    const updated = players.filter(p => p.id !== id);
    setPlayers(updated);
    if (groupId) {
      try {
        localStorage.setItem('voley_players_' + groupId, JSON.stringify(updated));
      } catch (e) {
        console.error('usePlayers: Error saving to localStorage:', e);
      }
      SyncManager.addToQueue({ type: 'players', groupId, data: updated });
      dbSavePlayers(groupId, updated);
    }
  };

  const updatePlayerPhoto = async (id: string, url: string) => {
    const updated = players.map(p => p.id === id ? { ...p, photo_url: url } : p);
    setPlayers(updated);
    if (groupId) {
      try {
        localStorage.setItem('voley_players_' + groupId, JSON.stringify(updated));
      } catch (e) {
        console.error('usePlayers: Error saving to localStorage:', e);
      }
      SyncManager.addToQueue({ type: 'players', groupId, data: updated });
      dbSavePlayers(groupId, updated);
    }
  };

  return { players, addPlayer, togglePlayerActive, deletePlayer, updatePlayerPhoto, loading, refresh: fetchPlayers };
}
