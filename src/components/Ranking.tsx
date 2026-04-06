import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Player, Match } from '../types';
import { PlayerCard } from './PlayerCard';
import { Trophy, Calendar, Zap, Star, Users, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface RankingProps {
  players: Player[];
  matches: Match[];
}

export const Ranking: React.FC<RankingProps> = ({ players, matches }) => {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'all'>('monthly');
  const [sortBy, setSortBy] = useState<'wins' | 'winRate' | 'games'>('wins');

  const filteredMatches = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return matches.filter(m => {
      const matchDate = new Date(m.created_at);
      if (period === 'weekly') return matchDate >= startOfWeek;
      if (period === 'monthly') return matchDate >= startOfMonth;
      return true;
    });
  }, [matches, period]);

  const stats = useMemo(() => {
    const playerStats = players.reduce((acc, p) => {
      acc[p.id] = { 
        ...p, 
        periodWins: 0, 
        periodLosses: 0, 
        periodGames: 0, 
        periodSetsWon: 0,
        periodSetsLost: 0 
      };
      return acc;
    }, {} as Record<string, any>);

    filteredMatches.forEach(m => {
      const winner = m.winner_team;
      const teamA = m.team_a_players || [];
      const teamB = m.team_b_players || [];

      teamA.forEach(pid => {
        if (!playerStats[pid]) return;
        playerStats[pid].periodGames++;
        playerStats[pid].periodSetsWon += m.sets_a;
        playerStats[pid].periodSetsLost += m.sets_b;
        if (winner === 'A') playerStats[pid].periodWins++;
        else if (winner === 'B') playerStats[pid].periodLosses++;
      });

      teamB.forEach(pid => {
        if (!playerStats[pid]) return;
        playerStats[pid].periodGames++;
        playerStats[pid].periodSetsWon += m.sets_b;
        playerStats[pid].periodSetsLost += m.sets_a;
        if (winner === 'B') playerStats[pid].periodWins++;
        else if (winner === 'A') playerStats[pid].periodLosses++;
      });
    });

    return Object.values(playerStats)
      .filter((p: any) => p.periodGames > 0)
      .map((p: any) => ({
        ...p,
        winRate: p.periodGames ? Math.round((p.periodWins / p.periodGames) * 100) : 0
      }))
      .sort((a, b) => {
        if (sortBy === 'wins') return b.periodWins - a.periodWins || b.winRate - a.winRate;
        if (sortBy === 'winRate') return b.winRate - a.winRate || b.periodWins - a.periodWins;
        return b.periodGames - a.periodGames;
      });
  }, [players, filteredMatches, sortBy]);

  const top3 = stats.slice(0, 3);
  const rest = stats.slice(3);

  return (
    <div className="min-h-full bg-slate-950 p-6 pb-32">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black text-white flex items-center gap-3">
              <Trophy className="text-yellow-500" size={36} />
              Ranking
            </h1>
            <p className="text-slate-400 mt-1">Os melhores da turma no {period === 'weekly' ? 'semana' : period === 'monthly' ? 'mês' : 'geral'}.</p>
          </div>

          <div className="flex bg-slate-900 p-1 rounded-2xl border border-white/10">
            {(['weekly', 'monthly', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                  period === p ? "bg-orange-500 text-white shadow-lg" : "text-slate-400 hover:text-white"
                )}
              >
                {p === 'weekly' ? 'Semana' : p === 'monthly' ? 'Mês' : 'Geral'}
              </button>
            ))}
          </div>
        </div>

        {/* Top 3 Podium */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-8">
          {/* 2nd Place */}
          <div className="order-2 md:order-1">
            {top3[1] && <PlayerCard player={top3[1]} rank={2} />}
          </div>
          {/* 1st Place */}
          <div className="order-1 md:order-2 scale-110 z-10">
            {top3[0] && <PlayerCard player={top3[0]} rank={1} />}
          </div>
          {/* 3rd Place */}
          <div className="order-3 md:order-3">
            {top3[2] && <PlayerCard player={top3[2]} rank={3} />}
          </div>
        </div>

        {/* Sorting & Stats */}
        <div className="bg-slate-900 rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users size={20} className="text-orange-500" />
              Tabela Completa
            </h2>
            <div className="flex gap-2">
              {(['wins', 'winRate', 'games'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                    sortBy === s 
                      ? "bg-white/10 border-white/20 text-white" 
                      : "border-transparent text-slate-500 hover:text-slate-300"
                  )}
                >
                  {s === 'wins' ? 'Vitórias' : s === 'winRate' ? '%' : 'Jogos'}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-white/5">
            <AnimatePresence mode="popLayout">
              {stats.length > 0 ? (
                stats.map((p, i) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors group"
                  >
                    <div className="w-8 text-center font-black italic text-slate-600 group-hover:text-orange-500 transition-colors">
                      {i + 1}
                    </div>
                    
                    <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-slate-800 border border-white/10">
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Users size={20} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white truncate">{p.name}</h4>
                      <div className="flex items-center gap-3 text-[10px] uppercase font-black tracking-tighter text-slate-500">
                        <span className="flex items-center gap-1"><Trophy size={10} className="text-yellow-500/50" /> {p.periodWins}V</span>
                        <span className="flex items-center gap-1"><Zap size={10} className="text-orange-500/50" /> {p.periodGames}J</span>
                        <span className="flex items-center gap-1"><Star size={10} className="text-blue-500/50" /> {p.periodSetsWon}S</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-black text-white">{p.winRate}%</div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Aproveitamento</div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="p-12 text-center space-y-4">
                  <Calendar className="mx-auto text-slate-700" size={48} />
                  <p className="text-slate-500 font-medium">Nenhuma partida registrada neste período.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Fominhas Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-orange-500/20 to-transparent p-6 rounded-[2rem] border border-orange-500/10">
            <h3 className="text-lg font-black text-orange-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Zap size={20} />
              O Mais Fominha
            </h3>
            {stats.sort((a, b) => b.periodGames - a.periodGames)[0] ? (
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-3xl overflow-hidden border-2 border-orange-500/30">
                  <img 
                    src={stats.sort((a, b) => b.periodGames - a.periodGames)[0].photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100&h=100'} 
                    alt="Fominha" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <p className="text-xl font-black text-white">{stats.sort((a, b) => b.periodGames - a.periodGames)[0].name}</p>
                  <p className="text-orange-500 font-bold">{stats.sort((a, b) => b.periodGames - a.periodGames)[0].periodGames} partidas jogadas</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-600 italic">Aguardando dados...</p>
            )}
          </div>

          <div className="bg-gradient-to-br from-blue-500/20 to-transparent p-6 rounded-[2rem] border border-blue-500/10">
            <h3 className="text-lg font-black text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Star size={20} />
              Rei dos Sets
            </h3>
            {stats.sort((a, b) => b.periodSetsWon - a.periodSetsWon)[0] ? (
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-3xl overflow-hidden border-2 border-blue-500/30">
                  <img 
                    src={stats.sort((a, b) => b.periodSetsWon - a.periodSetsWon)[0].photo_url || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=100&h=100'} 
                    alt="Rei dos Sets" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <p className="text-xl font-black text-white">{stats.sort((a, b) => b.periodSetsWon - a.periodSetsWon)[0].name}</p>
                  <p className="text-blue-500 font-bold">{stats.sort((a, b) => b.periodSetsWon - a.periodSetsWon)[0].periodSetsWon} sets vencidos</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-600 italic">Aguardando dados...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
