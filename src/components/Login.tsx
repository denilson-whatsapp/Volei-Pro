import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, LogIn, Shield, Lock, PlusCircle, Loader2 } from 'lucide-react';
import { dbCreateGroup, dbVerifyGroup } from '../lib/supabase';

interface LoginProps {
  onJoin: (groupId: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onJoin }) => {
  const [mode, setMode] = useState<'login' | 'create'>('login');
  const [groupId, setGroupId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (groupId.trim().length < 3) {
      setError('O nome da turma deve ter pelo menos 3 caracteres.');
      return;
    }
    if (password.trim().length < 3) {
      setError('A senha deve ter pelo menos 3 caracteres.');
      return;
    }

    setLoading(true);
    const cleanGroupId = groupId.trim().toLowerCase();
    const cleanPassword = password.trim();

    try {
      if (mode === 'create') {
        const result = await dbCreateGroup(cleanGroupId, cleanPassword);
        if (!result.success) {
          setError(result.message || 'Erro ao criar turma.');
          setLoading(false);
          return;
        }
      } else {
        const result = await dbVerifyGroup(cleanGroupId, cleanPassword);
        if (!result.success) {
          setError(result.message || 'Erro ao entrar na turma.');
          setLoading(false);
          return;
        }
      }
      
      onJoin(cleanGroupId);
    } catch (e) {
      console.error('Login error:', e);
      setError('Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/20 rotate-3">
            <Users size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Vôlei Pro</h1>
          <p className="text-slate-400">
            {mode === 'login' 
              ? 'Entre no nome da sua turma para sincronizar o placar.' 
              : 'Crie um nome único e uma senha para sua turma.'}
          </p>
        </div>

        <div className="flex p-1 bg-slate-800 rounded-2xl mb-8">
          <button 
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${mode === 'login' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            <LogIn size={18} />
            Entrar
          </button>
          <button 
            onClick={() => { setMode('create'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${mode === 'create' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            <PlusCircle size={18} />
            Criar Turma
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 ml-1">Nome da Turma</label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input 
                  type="text"
                  placeholder="Ex: TerçaNoite, AmigosVolei..."
                  value={groupId}
                  onChange={(e) => {
                    setGroupId(e.target.value);
                    setError('');
                  }}
                  className="w-full bg-slate-800 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input 
                  type="password"
                  placeholder="Mínimo 3 caracteres"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  className="w-full bg-slate-800 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  required
                />
              </div>
            </div>
            
            <AnimatePresence>
              {error && (
                <motion.p 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-red-500 text-sm ml-1 font-medium"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              mode === 'login' ? <LogIn size={20} /> : <PlusCircle size={20} />
            )}
            {mode === 'login' ? 'Entrar na Turma' : 'Criar e Entrar'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-slate-500">
            {mode === 'login' 
              ? 'Dica: Use o mesmo nome e senha para que todos da sua turma vejam os mesmos dados.'
              : 'Importante: Guarde sua senha! Ela será necessária para que outros jogadores entrem nesta turma.'}
          </p>
        </div>
      </motion.div>
    </div>
  );
};
