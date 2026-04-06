import React from 'react';
import { motion } from 'motion/react';
import { Player } from '../types';
import { Trophy, Star, Zap, User } from 'lucide-react';
import { cn } from '../lib/utils';

interface PlayerCardProps {
  player: Player;
  rank?: number;
  compact?: boolean;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ player, rank, compact }) => {
  const winRate = player.games_played ? Math.round((player.wins || 0) / player.games_played * 100) : 0;
  
  // FIFA Style Colors
  const getCardStyle = () => {
    if (rank === 1) return "from-yellow-400 via-yellow-200 to-yellow-500 text-slate-900 shadow-yellow-500/30";
    if (rank === 2) return "from-slate-300 via-slate-100 to-slate-400 text-slate-900 shadow-slate-400/30";
    if (rank === 3) return "from-amber-600 via-amber-400 to-amber-700 text-white shadow-amber-700/30";
    return "from-slate-800 to-slate-900 text-white border border-white/10 shadow-black/50";
  };

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-br",
        getCardStyle()
      )}>
        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-slate-700 border border-white/20">
          {player.photo_url ? (
            <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <User className="w-full h-full p-2 text-white/40" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{player.name}</p>
          <p className="text-[10px] opacity-70 uppercase font-black tracking-tighter">
            {player.wins}V • {player.losses}D • {winRate}%
          </p>
        </div>
        {rank && (
          <div className="text-xl font-black italic opacity-30 pr-2">#{rank}</div>
        )}
      </div>
    );
  }

  return (
    <motion.div 
      whileHover={{ scale: 1.02, y: -5 }}
      className={cn(
        "relative w-full aspect-[3/4] rounded-[2rem] p-4 flex flex-col overflow-hidden bg-gradient-to-br shadow-2xl",
        getCardStyle()
      )}
    >
      {/* Rank Badge */}
      {rank && (
        <div className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-xl italic z-20">
          {rank}
        </div>
      )}

      {/* Stats Column */}
      <div className="absolute top-16 left-4 flex flex-col gap-2 z-20">
        <div className="flex flex-col items-center">
          <span className="text-2xl font-black leading-none">{winRate}</span>
          <span className="text-[8px] uppercase font-bold opacity-70">RAT</span>
        </div>
        <div className="w-6 h-px bg-current opacity-20" />
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-none">{player.wins}</span>
          <span className="text-[8px] uppercase font-bold opacity-70">VIT</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-none">{player.games_played}</span>
          <span className="text-[8px] uppercase font-bold opacity-70">JOG</span>
        </div>
      </div>

      {/* Player Image */}
      <div className="absolute top-4 right-0 w-[70%] h-[60%] z-10 pointer-events-none">
        <div className="w-full h-full relative">
          {player.photo_url ? (
            <img 
              src={player.photo_url} 
              alt={player.name} 
              className="w-full h-full object-contain object-bottom drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-end justify-center">
              <User className="w-32 h-32 text-white/10" />
            </div>
          )}
          {/* Bottom Fade */}
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-transparent to-transparent" />
        </div>
      </div>

      {/* Name & Details */}
      <div className="mt-auto z-20 text-center">
        <h3 className="text-2xl font-black uppercase tracking-tighter truncate mb-1">
          {player.name.split(' ')[0]}
        </h3>
        <div className="flex justify-center gap-4 text-[10px] font-bold uppercase tracking-widest opacity-80">
          <div className="flex items-center gap-1">
            <Trophy size={10} /> {player.wins}
          </div>
          <div className="flex items-center gap-1">
            <Star size={10} /> {player.sets_won}
          </div>
          <div className="flex items-center gap-1">
            <Zap size={10} /> {player.games_played}
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
      <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
    </motion.div>
  );
};
