import { useState, useEffect, useRef } from 'react';
import { Settings } from '../types';
import { io, Socket } from 'socket.io-client';
import { dbSaveSettings, dbFetchSettings, isSupabaseConfigured } from '../lib/supabase';

const DEFAULT_SETTINGS: Settings = {
  points_per_set: 25,
  max_sets: 3,
  team_a_color: '#3b82f6', // blue-500
  team_b_color: '#ef4444', // red-500
  team_a_name: 'Time A',
  team_b_name: 'Time B',
  enable_sounds: true,
  enable_voice: true,
};

export function useSettings(groupId: string | null) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const isRemoteUpdate = useRef(false);
  const hasSynced = useRef(false);

  useEffect(() => {
    console.log('useSettings: Initializing for groupId:', groupId);
    fetchSettings();

    if (groupId) {
      try {
        const socket = io();
        socketRef.current = socket;
        socket.emit('join-group', groupId + '_settings');
        socket.on('sync-state', (newState: Settings) => {
          console.log('useSettings: Received sync-state:', newState);
          isRemoteUpdate.current = true;
          hasSynced.current = true;
          setSettings(newState);
          try {
            localStorage.setItem('voley_settings_' + groupId, JSON.stringify(newState));
          } catch (e) {
            console.error('useSettings: Error saving to localStorage:', e);
          }
          setTimeout(() => { isRemoteUpdate.current = false; }, 100);
        });

        socket.on('request-state', () => {
          console.log('useSettings: Received request-state');
          if (settings) {
            socket.emit('update-state', { groupId: groupId + '_settings', state: settings });
          }
        });

        const timeout = setTimeout(() => {
          console.log('useSettings: Sync timeout reached');
          hasSynced.current = true;
        }, 1000);

        return () => { 
          console.log('useSettings: Disconnecting socket');
          socket.disconnect(); 
          clearTimeout(timeout);
        };
      } catch (e) {
        console.error('useSettings: Error initializing socket:', e);
        hasSynced.current = true; // Allow local mode if socket fails
      }
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !socketRef.current || isRemoteUpdate.current || loading || !hasSynced.current) return;
    socketRef.current.emit('update-state', { groupId: groupId + '_settings', state: settings });
  }, [settings, groupId]);

  async function fetchSettings() {
    if (!groupId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    // 1. Try Supabase (Source of Truth)
    try {
      if (isSupabaseConfigured) {
        const dbData = await dbFetchSettings(groupId);
        if (dbData !== null) {
          setSettings(dbData);
          localStorage.setItem('voley_settings_' + groupId, JSON.stringify(dbData));
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.error('useSettings: Error fetching from Supabase:', e);
    }

    // 2. Fallback to localStorage
    try {
      const local = localStorage.getItem('voley_settings_' + groupId);
      if (local) {
        setSettings(JSON.parse(local));
      }
    } catch (e) {
      console.error('useSettings: Error parsing from localStorage:', e);
    }
    
    setLoading(false);
  }

  const updateSettings = async (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    if (groupId) {
      // Save locally
      try {
        localStorage.setItem('voley_settings_' + groupId, JSON.stringify(updated));
      } catch (e) {
        console.error('useSettings: Error saving to localStorage:', e);
      }
      // Save to Supabase (Background)
      dbSaveSettings(groupId, updated);
    }
  };

  return { settings, updateSettings, loading, refresh: fetchSettings };
}
