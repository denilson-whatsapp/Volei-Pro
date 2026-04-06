import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  Settings as SettingsIcon, 
  History, 
  LayoutDashboard,
  X,
  Menu,
  LogOut,
  Database,
  CloudOff,
  Zap
} from 'lucide-react';
import { View } from '../types';
import { cn } from '../lib/utils';
import { isSupabaseConfigured, testSupabaseConnection } from '../lib/supabase';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, onLogout }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [supabaseStatus, setSupabaseStatus] = React.useState<'connected' | 'offline' | 'error'>('offline');

  React.useEffect(() => {
    const checkConnection = async () => {
      if (!isSupabaseConfigured) {
        setSupabaseStatus('offline');
        return;
      }
      
      try {
        const result = await testSupabaseConnection();
        setSupabaseStatus(result.success ? 'connected' : 'error');
      } catch (e) {
        setSupabaseStatus('error');
      }
    };

    checkConnection();
    // Re-check every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { id: 'scoreboard', label: 'Placar', icon: LayoutDashboard },
    { id: 'ranking', label: 'Ranking', icon: Trophy },
    { id: 'players', label: 'Jogadores', icon: Users },
    { id: 'shuffler', label: 'Sorteador', icon: Zap },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'settings', label: 'Configurações', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed top-6 left-6 z-50 p-3 bg-slate-900/80 backdrop-blur-md rounded-2xl text-white border border-white/10 shadow-2xl xl:hidden active:scale-90 transition-transform landscape:top-4 landscape:left-4"
      >
        <Menu size={24} />
      </button>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] xl:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Content */}
      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : -300 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-slate-900 text-white z-[70] p-6 flex flex-col shadow-2xl xl:translate-x-0 xl:static",
          !isOpen && "hidden xl:flex"
        )}
      >
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Trophy size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Vôlei Pro</h1>
          </div>
          <button onClick={() => setIsOpen(false)} className="xl:hidden">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id as View);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30" 
                    : "hover:bg-white/5 text-slate-400 hover:text-white"
                )}
              >
                <Icon size={20} className={cn(isActive ? "text-white" : "group-hover:text-white")} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10 space-y-4">
          <div className="px-4 py-2 bg-slate-800/50 rounded-xl flex items-center gap-3">
            {supabaseStatus === 'connected' ? (
              <Database size={16} className="text-emerald-400" />
            ) : supabaseStatus === 'error' ? (
              <Database size={16} className="text-red-400" />
            ) : (
              <CloudOff size={16} className="text-orange-400" />
            )}
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Nuvem</span>
              <span className={cn(
                "text-xs font-medium", 
                supabaseStatus === 'connected' ? "text-emerald-400" : 
                supabaseStatus === 'error' ? "text-red-400" : "text-orange-400"
              )}>
                {supabaseStatus === 'connected' ? "Sincronizado" : 
                 supabaseStatus === 'error' ? "Erro de Conexão" : "Modo Local"}
              </span>
            </div>
          </div>

          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut size={20} />
            <span className="font-medium">Sair da Turma</span>
          </button>
          <p className="text-xs text-slate-500 text-center uppercase tracking-widest font-semibold">
            v1.0.0
          </p>
        </div>
      </motion.aside>
    </>
  );
};
