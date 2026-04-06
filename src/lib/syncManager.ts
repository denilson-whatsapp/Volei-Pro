import { 
  dbSavePlayers, 
  dbSaveMatch, 
  dbSaveDraw, 
  dbSaveSettings, 
  dbSaveScoreboard,
  dbDeleteMatch,
  dbDeleteDraw,
  isSupabaseConfigured
} from './supabase';

type SyncOperation = {
  id: string;
  type: 'players' | 'match' | 'draw' | 'settings' | 'scoreboard' | 'delete_match' | 'delete_draw' | 'player_stats';
  groupId: string;
  data: any;
  timestamp: number;
};

const SYNC_QUEUE_KEY = 'voley_sync_queue';

export const SyncManager = {
  getQueue(): SyncOperation[] {
    try {
      const queue = localStorage.getItem(SYNC_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (e) {
      return [];
    }
  },

  saveQueue(queue: SyncOperation[]) {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  },

  addToQueue(op: Omit<SyncOperation, 'id' | 'timestamp'>) {
    const queue = this.getQueue();
    // For single-state items like settings or scoreboard, replace existing pending ones for the same group
    if (op.type === 'settings' || op.type === 'scoreboard' || op.type === 'players') {
      const filtered = queue.filter(item => !(item.type === op.type && item.groupId === op.groupId));
      filtered.push({ ...op, id: crypto.randomUUID(), timestamp: Date.now() });
      this.saveQueue(filtered);
    } else {
      queue.push({ ...op, id: crypto.randomUUID(), timestamp: Date.now() });
      this.saveQueue(queue);
    }
  },

  async processQueue() {
    if (!isSupabaseConfigured || !navigator.onLine) return;

    const queue = this.getQueue();
    if (queue.length === 0) return;

    console.log(`SyncManager: Processing ${queue.length} pending operations...`);
    const remaining: SyncOperation[] = [];

    for (const op of queue) {
      try {
        switch (op.type) {
          case 'players':
            await dbSavePlayers(op.groupId, op.data);
            break;
          case 'match':
            await dbSaveMatch(op.groupId, op.data);
            break;
          case 'draw':
            await dbSaveDraw(op.groupId, op.data);
            break;
          case 'settings':
            await dbSaveSettings(op.groupId, op.data);
            break;
          case 'scoreboard':
            await dbSaveScoreboard(op.groupId, op.data);
            break;
          case 'delete_match':
            await dbDeleteMatch(op.data); // data is matchId
            break;
          case 'delete_draw':
            await dbDeleteDraw(op.data); // data is drawId
            break;
          case 'player_stats':
            // data is { playerId, stats }
            const { dbUpdatePlayerStats } = await import('./supabase');
            await dbUpdatePlayerStats(op.data.playerId, op.data.stats);
            break;
        }
      } catch (e) {
        console.error(`SyncManager: Failed to sync ${op.type}:`, e);
        remaining.push(op);
      }
    }

    this.saveQueue(remaining);
    if (remaining.length === 0) {
      console.log('SyncManager: All operations synced successfully.');
    }
  },

  init() {
    window.addEventListener('online', () => {
      console.log('SyncManager: Back online, triggering sync...');
      this.processQueue();
    });

    // Periodically try to sync if online
    setInterval(() => this.processQueue(), 60000);
    
    // Initial sync
    this.processQueue();
  }
};
