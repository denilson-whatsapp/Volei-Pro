import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Scoreboard } from './components/Scoreboard';
import { SettingsPage } from './components/SettingsPage';
import { PlayersPage } from './components/PlayersPage';
import { ShufflerPage } from './components/ShufflerPage';
import { HistoryPage } from './components/HistoryPage';
import { Ranking } from './components/Ranking';
import { Login } from './components/Login';
import { useSettings } from './hooks/useSettings';
import { usePlayers } from './hooks/usePlayers';
import { useHistory } from './hooks/useHistory';
import { View } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { testSupabaseConnection } from './lib/supabase';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('scoreboard');
  const [groupId, setGroupId] = useState<string | null>(localStorage.getItem('voley_group_id'));
  const [forceLoad, setForceLoad] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<string | null>(null);

  const { settings, updateSettings, loading: settingsLoading, refresh: refreshSettings } = useSettings(groupId);
  const { players, addPlayer, togglePlayerActive, deletePlayer, updatePlayerPhoto, loading: playersLoading, refresh: refreshPlayers } = usePlayers(groupId);
  const { matches, draws, addMatch, addDraw, deleteMatch, deleteDraw, loading: historyLoading, refresh: refreshHistory } = useHistory(groupId);

  const handleRefreshAll = async () => {
    await Promise.all([
      refreshSettings(),
      refreshPlayers(),
      refreshHistory()
    ]);
  };

  useEffect(() => {
    console.log('App: Loading States - Settings:', settingsLoading, 'Players:', playersLoading, 'History:', historyLoading, 'ForceLoad:', forceLoad);
  }, [settingsLoading, playersLoading, historyLoading, forceLoad]);

  useEffect(() => {
    if (groupId) {
      console.log('App: Testing Supabase connection...');
      testSupabaseConnection().then(result => {
        setSupabaseStatus(result.message);
        console.log('App: Supabase Status:', result);
      });
    }
  }, [groupId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (settingsLoading || playersLoading || historyLoading) {
        console.warn('Loading taking too long, enabling force load option');
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [settingsLoading, playersLoading, historyLoading]);

  const handleJoin = (id: string) => {
    setGroupId(id);
    localStorage.setItem('voley_group_id', id);
  };

  const handleLogout = () => {
    setGroupId(null);
    localStorage.removeItem('voley_group_id');
  };

  // Only show loading screen if we have a groupId and at least one hook is still loading
  const isLoading = groupId && (settingsLoading || playersLoading || historyLoading);

  if (!groupId) {
    return <Login onJoin={handleJoin} />;
  }

  if (isLoading && !forceLoad) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
          />
          <div className="space-y-2">
            <p className="text-slate-200 font-medium text-xl">Entrando na quadra...</p>
            <p className="text-slate-500 text-sm">Turma: <span className="text-orange-400 font-mono">{groupId}</span></p>
          </div>
          
          <div className="flex flex-col gap-3 w-full mt-4">
            <button 
              onClick={() => setForceLoad(true)}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all active:scale-95 text-sm"
            >
              Entrar agora (Modo Offline)
            </button>
            <button 
              onClick={handleLogout}
              className="text-slate-500 hover:text-red-400 text-xs transition-colors"
            >
              Sair desta turma
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'scoreboard':
        return <Scoreboard settings={settings} groupId={groupId} players={players} onSaveMatch={addMatch} />;
      case 'settings':
        return <SettingsPage settings={settings} onUpdate={updateSettings} onRefresh={handleRefreshAll} />;
      case 'players':
        return <PlayersPage players={players} onAdd={addPlayer} onToggle={togglePlayerActive} onDelete={deletePlayer} onUpdatePhoto={updatePlayerPhoto} />;
      case 'shuffler':
        return <ShufflerPage players={players} groupId={groupId} onSaveDraw={addDraw} onViewChange={setCurrentView} draws={draws} />;
      case 'history':
        return <HistoryPage matches={matches} draws={draws} onDeleteMatch={deleteMatch} onDeleteDraw={deleteDraw} />;
      case 'ranking':
        return <Ranking players={players} matches={matches} />;
      default:
        return <Scoreboard settings={settings} groupId={groupId} onSaveMatch={addMatch} />;
    }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} onLogout={handleLogout} />
      
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
