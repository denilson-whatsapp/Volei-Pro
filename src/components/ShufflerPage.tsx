import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Player, Draw } from '../types';
import { Trophy, RefreshCw, Save, UserPlus, X, Play } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSync } from '../hooks/useSync';
import { dbSaveScoreboard } from '../lib/supabase';

interface ShufflerPageProps {
  players: Player[];
  groupId: string;
  onSaveDraw: (draw: Draw) => void;
  onViewChange: (view: 'scoreboard') => void;
  draws: Draw[];
}

export const ShufflerPage: React.FC<ShufflerPageProps> = ({ players, groupId, onSaveDraw, onViewChange, draws }) => {
  const [numTeams, setNumTeams] = useState(2);
  const [playersPerTeam, setPlayersPerTeam] = useState(6);
  const [autoTeams, setAutoTeams] = useState(true);
  const [tempPlayers, setTempPlayers] = useState<{id: string, name: string}[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [newTempName, setNewTempName] = useState('');
  const [generatedTeams, setGeneratedTeams] = useState<{id: string, name: string}[][]>([]);
  const [isShuffling, setIsShuffling] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [isPuttingOnCourt, setIsPuttingOnCourt] = useState(false);

  // Initialize selected players from the main list (only those active)
  React.useEffect(() => {
    if (selectedPlayerIds.length === 0 && players.length > 0) {
      setSelectedPlayerIds(players.filter(p => p.active).map(p => p.id));
    }
  }, [players]);

  // Sync shuffler state
  useSync(groupId + '_shuffler', { numTeams, playersPerTeam, tempPlayers, generatedTeams, selectedPlayerIds, autoTeams }, (newState) => {
    if (newState.numTeams !== undefined) setNumTeams(newState.numTeams);
    if (newState.playersPerTeam !== undefined) setPlayersPerTeam(newState.playersPerTeam);
    if (newState.tempPlayers !== undefined) setTempPlayers(newState.tempPlayers);
    if (newState.generatedTeams !== undefined) setGeneratedTeams(newState.generatedTeams);
    if (newState.selectedPlayerIds !== undefined) setSelectedPlayerIds(newState.selectedPlayerIds);
    if (newState.autoTeams !== undefined) setAutoTeams(newState.autoTeams);
  });

  const selectedRegistered = players
    .filter(p => selectedPlayerIds.includes(p.id))
    .map(p => ({ id: p.id, name: p.name }));
  
  const allAvailable = [...selectedRegistered, ...tempPlayers];

  // Auto-adjust number of teams
  React.useEffect(() => {
    if (autoTeams && allAvailable.length > 0) {
      const calculated = Math.ceil(allAvailable.length / playersPerTeam);
      if (calculated >= 2 && calculated <= 10) {
        setNumTeams(calculated);
      }
    }
  }, [autoTeams, allAvailable.length, playersPerTeam]);

  const togglePlayerSelection = (id: string) => {
    setSelectedPlayerIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const handleAddTemp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTempName.trim()) return;
    setTempPlayers([...tempPlayers, { id: `temp-${Date.now()}`, name: newTempName.trim() }]);
    setNewTempName('');
  };

  const removeTemp = (id: string) => {
    setTempPlayers(tempPlayers.filter(p => p.id !== id));
  };

  const shuffleTeams = () => {
    setIsShuffling(true);
    
    setTimeout(() => {
      const pool = [...allAvailable];
      
      // Smart Shuffle Logic: Try multiple shuffles and pick the one with least repeated pairings
      let bestShuffle: {id: string, name: string}[][] = [];
      let minScore = Infinity;

      // Build a map of how many times each pair has been together
      const pairingHistory: Record<string, number> = {};
      draws.forEach(draw => {
        draw.teams.forEach(team => {
          for (let i = 0; i < team.length; i++) {
            for (let j = i + 1; j < team.length; j++) {
              const pair = [team[i], team[j]].sort().join('|');
              pairingHistory[pair] = (pairingHistory[pair] || 0) + 1;
            }
          }
        });
      });

      // Try 50 different shuffles
      for (let attempt = 0; attempt < 50; attempt++) {
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const currentTeams: {id: string, name: string}[][] = Array.from({ length: numTeams }, () => []);
        
        let currentPlayerIndex = 0;
        for (let t = 0; t < numTeams; t++) {
          for (let p = 0; p < playersPerTeam; p++) {
            if (currentPlayerIndex < shuffled.length) {
              currentTeams[t].push(shuffled[currentPlayerIndex]);
              currentPlayerIndex++;
            }
          }
        }

        // Calculate score for this shuffle
        let currentScore = 0;
        currentTeams.forEach(team => {
          for (let i = 0; i < team.length; i++) {
            for (let j = i + 1; j < team.length; j++) {
              const pair = [team[i].name, team[j].name].sort().join('|');
              currentScore += (pairingHistory[pair] || 0) * 10; // Weight history heavily
            }
          }
        });

        if (currentScore < minScore) {
          minScore = currentScore;
          bestShuffle = currentTeams;
        }
        
        if (minScore === 0) break; // Perfect shuffle found
      }

      setGeneratedTeams(bestShuffle);
      setIsShuffling(false);
    }, 800);
  };

  const putOnCourt = async () => {
    if (generatedTeams.length < 2) return;
    setIsPuttingOnCourt(true);
    
    try {
      const teamAPlayers = generatedTeams[0].map(p => p.id);
      const teamBPlayers = generatedTeams[1].map(p => p.id);
      const waitingTeams = generatedTeams.slice(2).map(t => t.map(p => p.id));

      await dbSaveScoreboard(groupId, {
        scoreA: 0,
        scoreB: 0,
        setsA: 0,
        setsB: 0,
        isSwapped: false,
        seconds: 0,
        isActive: false,
        teamAPlayers,
        teamBPlayers,
        teamAOnCourt: teamAPlayers.slice(0, 6),
        teamBOnCourt: teamBPlayers.slice(0, 6),
        waitingTeams
      });
      onViewChange('scoreboard');
    } catch (e) {
      console.error('Error putting on court:', e);
    } finally {
      setIsPuttingOnCourt(false);
    }
  };

  const saveDraw = async () => {
    if (generatedTeams.length === 0) return;
    
    const drawData: Draw = {
      id: crypto.randomUUID(),
      teams: generatedTeams.map(t => t.map(p => p.name)),
      created_at: new Date().toISOString()
    };

    onSaveDraw(drawData);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  return (
    <div className="h-full overflow-y-auto p-6 pt-20 md:pt-6 max-w-5xl mx-auto">
      <AnimatePresence>
        {showSavedToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-xl font-bold flex items-center gap-2"
          >
            <Save size={20} />
            Sorteio salvo no histórico!
          </motion.div>
        )}
      </AnimatePresence>

      <header className="mb-10 text-center">
        <h1 className="text-4xl font-black text-white mb-3 tracking-tight">Sorteador Inteligente</h1>
        <p className="text-slate-400 max-w-md mx-auto">Organize os times de forma equilibrada e diversa para sua partida.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Config Side */}
        <div className="space-y-6">
          <section className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white">Configuração</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-400">Número de Times</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={autoTeams}
                    onChange={e => setAutoTeams(e.target.checked)}
                    className="w-4 h-4 accent-orange-500 rounded"
                  />
                  <span className="text-xs text-slate-500">Auto-ajustar</span>
                </label>
              </div>
              <div className="flex items-center gap-4">
                <input 
                  type="range" min="2" max="10" step="1"
                  value={numTeams}
                  disabled={autoTeams}
                  onChange={e => setNumTeams(parseInt(e.target.value))}
                  className={cn(
                    "flex-1 accent-orange-500",
                    autoTeams && "opacity-30 cursor-not-allowed"
                  )}
                />
                <span className="text-xl font-bold text-white w-8">{numTeams}</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-400">Jogadores por Time</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" min="2" max="12" step="1"
                    value={playersPerTeam}
                    onChange={e => setPlayersPerTeam(parseInt(e.target.value))}
                    className="flex-1 accent-orange-500"
                  />
                  <span className="text-xl font-bold text-white w-8">{playersPerTeam}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">Total Necessário:</span>
                <span className="text-white font-bold">{numTeams * playersPerTeam}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Disponíveis:</span>
                <span className={cn(
                  "font-bold",
                  allAvailable.length >= numTeams * playersPerTeam ? "text-green-500" : "text-red-500"
                )}>
                  {allAvailable.length}
                </span>
              </div>
            </div>
          </section>

          <section className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Jogadores Cadastrados</h2>
            <p className="text-xs text-slate-500">Selecione quem vai participar do sorteio hoje:</p>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {players.map(player => (
                <button
                  key={player.id}
                  onClick={() => togglePlayerSelection(player.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border",
                    selectedPlayerIds.includes(player.id)
                      ? "bg-orange-500/20 border-orange-500/50 text-orange-500"
                      : "bg-slate-800/50 border-white/5 text-slate-500 grayscale opacity-50"
                  )}
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    selectedPlayerIds.includes(player.id) ? "bg-orange-500" : "bg-slate-600"
                  )} />
                  <span className="truncate">{player.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Avulsos (Temporários)</h2>
              <span className="text-xs text-slate-500">{tempPlayers.length} adicionados</span>
            </div>
            <form onSubmit={handleAddTemp} className="flex gap-2">
              <input 
                type="text"
                placeholder="Nome do avulso..."
                value={newTempName}
                onChange={e => setNewTempName(e.target.value)}
                className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:ring-1 focus:ring-orange-500"
              />
              <button type="submit" className="bg-orange-500 hover:bg-orange-600 p-2 rounded-xl text-white transition-colors">
                <UserPlus size={20} />
              </button>
            </form>

            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
              {tempPlayers.map((p) => (
                <span key={p.id} className="flex items-center gap-1 bg-slate-800 text-slate-300 px-3 py-1.5 rounded-full text-xs font-medium border border-white/5">
                  {p.name}
                  <button onClick={() => removeTemp(p.id)} className="hover:text-red-500 ml-1">
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          </section>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={shuffleTeams}
            disabled={isShuffling || allAvailable.length < 2}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all"
          >
            <RefreshCw size={20} className={cn(isShuffling && "animate-spin")} />
            {isShuffling ? 'Sorteando...' : 'Sortear Times'}
          </motion.button>
        </div>

        {/* Results Side */}
        <div className="lg:col-span-2 space-y-6">
          {generatedTeams.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generatedTeams.map((team, i) => (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    key={i}
                    className="bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-xl"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-sm">
                          {i + 1}
                        </div>
                        Time {String.fromCharCode(65 + i)}
                      </h3>
                      <span className="text-xs text-slate-500 font-mono uppercase tracking-widest">
                        {team.length} Jogadores
                      </span>
                    </div>
                    
                    <ul className="space-y-2">
                      {team.map((player, j) => (
                        <li key={j} className="flex items-center gap-3 text-slate-300 py-2 border-b border-white/5 last:border-0">
                          <div className="w-2 h-2 rounded-full bg-orange-500/40" />
                          {player.name}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={putOnCourt}
                  disabled={isPuttingOnCourt}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Play size={20} fill="currentColor" />
                  Colocar em Quadra (A vs B)
                </button>
                <button 
                  onClick={saveDraw}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-semibold py-4 rounded-2xl border border-white/10 flex items-center justify-center gap-2 transition-all"
                >
                  <Save size={20} />
                  Salvar Sorteio
                </button>
              </div>
            </>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 bg-slate-900/30 border-2 border-dashed border-white/5 rounded-[3rem]">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                <Trophy size={40} className="text-slate-700" />
              </div>
              <h3 className="text-xl font-bold text-slate-400 mb-2">Pronto para o Jogo?</h3>
              <p className="text-slate-500 max-w-xs">Configure os parâmetros ao lado e clique em sortear para gerar os times.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
