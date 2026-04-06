import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Settings as SettingsType } from '../types';
import { Save, Palette, Volume2, Mic, Database, RefreshCw } from 'lucide-react';

import { isSupabaseConfigured } from '../lib/supabase';

interface SettingsPageProps {
  settings: SettingsType;
  onUpdate: (settings: Partial<SettingsType>) => void;
  onRefresh: () => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onUpdate, onRefresh }) => {
  const [formData, setFormData] = useState(settings);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Update local form if settings change from server
  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(formData);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  return (
    <div className="h-full overflow-y-auto p-6 pt-20 md:pt-6 max-w-2xl mx-auto">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-black text-white mb-3 tracking-tight">Configurações</h1>
        <p className="text-slate-400 max-w-md mx-auto">Personalize as regras e o visual da sua partida de vôlei.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Pontos por Set</label>
              <input 
                type="number"
                value={formData.points_per_set}
                onChange={e => setFormData({ ...formData, points_per_set: parseInt(e.target.value) })}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Máximo de Sets (Melhor de...)</label>
              <select 
                value={formData.max_sets}
                onChange={e => setFormData({ ...formData, max_sets: parseInt(e.target.value) })}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value={1}>1 Set</option>
                <option value={3}>3 Sets</option>
                <option value={5}>5 Sets</option>
              </select>
            </div>
          </div>
        </section>

        <section className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Palette size={20} className="text-orange-500" />
            Personalização de Times
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Nome Time A</label>
                <input 
                  type="text"
                  value={formData.team_a_name}
                  onChange={e => setFormData({ ...formData, team_a_name: e.target.value })}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Cor Time A</label>
                <div className="flex gap-2">
                  <input 
                    type="color"
                    value={formData.team_a_color}
                    onChange={e => setFormData({ ...formData, team_a_color: e.target.value })}
                    className="h-12 w-20 bg-transparent border-none cursor-pointer"
                  />
                  <div className="flex-1 h-12 rounded-xl border border-white/10" style={{ backgroundColor: formData.team_a_color }} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Nome Time B</label>
                <input 
                  type="text"
                  value={formData.team_b_name}
                  onChange={e => setFormData({ ...formData, team_b_name: e.target.value })}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Cor Time B</label>
                <div className="flex gap-2">
                  <input 
                    type="color"
                    value={formData.team_b_color}
                    onChange={e => setFormData({ ...formData, team_b_color: e.target.value })}
                    className="h-12 w-20 bg-transparent border-none cursor-pointer"
                  />
                  <div className="flex-1 h-12 rounded-xl border border-white/10" style={{ backgroundColor: formData.team_b_color }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Volume2 size={20} className="text-orange-500" />
            Sons e Voz
          </h2>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-white/5 cursor-pointer hover:bg-slate-800 transition-colors">
              <div className="flex items-center gap-3">
                <Volume2 size={20} className="text-slate-400" />
                <div>
                  <p className="font-medium text-white">Efeitos Sonoros</p>
                  <p className="text-xs text-slate-500">Apito e bips durante a partida</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={formData.enable_sounds}
                onChange={e => setFormData({ ...formData, enable_sounds: e.target.checked })}
                className="w-6 h-6 accent-orange-500 rounded-lg"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-white/5 cursor-pointer hover:bg-slate-800 transition-colors">
              <div className="flex items-center gap-3">
                <Mic size={20} className="text-slate-400" />
                <div>
                  <p className="font-medium text-white">Anunciar Placar</p>
                  <p className="text-xs text-slate-500">Voz anunciando cada ponto marcado</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={formData.enable_voice}
                onChange={e => setFormData({ ...formData, enable_voice: e.target.checked })}
                className="w-6 h-6 accent-orange-500 rounded-lg"
              />
            </label>
          </div>
        </section>

        <section className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Database size={20} className="text-orange-500" />
            Sincronização de Dados
          </h2>
          <div className="p-4 bg-slate-800/50 rounded-2xl border border-white/5 space-y-4 text-center md:text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">Status do Servidor:</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                <span className={`text-xs font-bold ${isSupabaseConfigured ? 'text-green-500' : 'text-red-500'}`}>
                  {isSupabaseConfigured ? 'CONECTADO' : 'DESCONECTADO'}
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-400">
              {isSupabaseConfigured 
                ? "Seus dados estão sendo salvos na nuvem automaticamente." 
                : "Atenção: O banco de dados não está configurado. Seus dados ficarão salvos apenas neste navegador."}
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || !isSupabaseConfigured}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold transition-all active:scale-95 text-sm w-full md:w-auto"
            >
              <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
              {isRefreshing ? "Sincronizando..." : "Sincronizar Agora"}
            </button>
          </div>
        </section>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-colors relative"
        >
          <Save size={20} />
          {showSaved ? "Configurações Salvas!" : "Salvar Alterações"}
          {showSaved && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -top-12 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs py-2 px-4 rounded-full font-bold shadow-xl"
            >
              Salvo com sucesso!
            </motion.div>
          )}
        </motion.button>
      </form>
    </div>
  );
};
