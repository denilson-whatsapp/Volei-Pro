import React from 'react';
import { Match, Draw } from '../types';
import { History as HistoryIcon, Trophy, Calendar, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoryPageProps {
  matches: Match[];
  draws: Draw[];
  onDeleteMatch: (id: string) => void;
  onDeleteDraw: (id: string) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ matches, draws, onDeleteMatch, onDeleteDraw }) => {
  return (
    <div className="h-full overflow-y-auto p-6 pt-20 md:pt-6 max-w-5xl mx-auto space-y-12">
      <header className="text-center">
        <h1 className="text-4xl font-black text-white mb-3 tracking-tight">Histórico</h1>
        <p className="text-slate-400 max-w-md mx-auto">Acompanhe suas partidas e sorteios anteriores realizados no app.</p>
      </header>

      <section className="space-y-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-white">
          <HistoryIcon size={24} className="text-orange-500" />
          Últimas Partidas
        </h2>
        
        {matches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.map(match => (
              <div key={match.id} className="group bg-slate-900 border border-white/10 rounded-2xl p-6 flex items-center justify-between relative overflow-hidden">
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500 uppercase tracking-widest mb-2">
                    {format(new Date(match.created_at), "dd 'de' MMMM", { locale: ptBR })}
                  </span>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{match.sets_a}</div>
                      <div className="text-[10px] text-slate-500 uppercase">Sets</div>
                    </div>
                    <div className="text-slate-700 font-bold">VS</div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{match.sets_b}</div>
                      <div className="text-[10px] text-slate-500 uppercase">Sets</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-slate-400 mb-1">Placar Final</div>
                    <div className="text-xl font-mono text-orange-500 font-bold">
                      {match.team_a_score} - {match.team_b_score}
                    </div>
                  </div>
                  <button 
                    onClick={() => onDeleteMatch(match.id)}
                    className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    title="Excluir partida"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-600 italic">Nenhuma partida registrada.</p>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-white">
          <Trophy size={24} className="text-orange-500" />
          Histórico de Sorteios
        </h2>

        {draws.length > 0 ? (
          <div className="space-y-4">
            {draws.map(draw => (
              <div key={draw.id} className="group bg-slate-900/50 border border-white/10 rounded-3xl p-6 relative">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <Calendar size={18} className="text-slate-500" />
                    <span className="text-sm text-slate-300">
                      {format(new Date(draw.created_at), "PPP 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full text-xs font-bold uppercase">
                      {draw.teams.length} Times
                    </span>
                    <button 
                      onClick={() => onDeleteDraw(draw.id)}
                      className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                      title="Excluir sorteio"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {draw.teams.map((team, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Time {idx + 1}</div>
                      <div className="text-xs text-slate-300 truncate">
                        {team.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-600 italic">Nenhum sorteio registrado.</p>
        )}
      </section>
    </div>
  );
};
