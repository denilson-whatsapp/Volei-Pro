import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Undo2, Play, Pause, RefreshCw, X, Save } from 'lucide-react';
import { Match, Settings, Player } from '../types';
import { useTimer } from '../hooks/useTimer';
import { useSync } from '../hooks/useSync';
import { formatTime } from '../lib/utils';
import { cn } from '../lib/utils';
import { dbSaveScoreboard, dbUpdatePlayerStats } from '../lib/supabase';
import { SyncManager } from '../lib/syncManager';
import { Users, UserPlus, Trophy as TrophyIcon, ChevronDown } from 'lucide-react';

interface ScoreboardProps {
  settings: Settings;
  groupId: string;
  players: Player[];
  onSaveMatch: (match: Match) => void;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ settings, groupId, players, onSaveMatch }) => {
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [setsA, setSetsA] = useState(0);
  const [setsB, setSetsB] = useState(0);
  const [isSwapped, setIsSwapped] = useState(false);
  const [teamAPlayers, setTeamAPlayers] = useState<string[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<string[]>([]);
  const [teamAOnCourt, setTeamAOnCourt] = useState<(string | null)[]>(Array(6).fill(null));
  const [teamBOnCourt, setTeamBOnCourt] = useState<(string | null)[]>(Array(6).fill(null));
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPositionIndex, setSelectedPositionIndex] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<'A' | 'B' | null>(null);
  const [history, setHistory] = useState<{ a: number; b: number }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [showEscalacao, setShowEscalacao] = useState(false);
  const [selectingTeam, setSelectingTeam] = useState<'A' | 'B' | null>(null);
  
  const { seconds, isActive, toggleTimer, resetTimer, setSeconds, setIsActive } = useTimer();

  // Audio helpers
  const playSound = (type: 'beep' | 'whistle') => {
    if (!settings.enable_sounds) return;
    
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    if (type === 'beep') {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } else {
      // Whistle sound (Mixkit)
      const whistle = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
      whistle.volume = 0.3;
      whistle.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  const speak = (text: string) => {
    if (!settings.enable_voice) return;
    
    // Replace "Time" with "Equipe" to avoid English pronunciation
    const localizedText = text.replace(/Time/gi, 'Equipe');
    
    const utterance = new SpeechSynthesisUtterance(localizedText);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.1;

    // Try to find a male voice
    const voices = window.speechSynthesis.getVoices();
    const maleVoice = voices.find(v => v.lang.startsWith('pt') && (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('masculino') || v.name.toLowerCase().includes('daniel') || v.name.toLowerCase().includes('google português do brasil')));
    
    if (maleVoice) {
      utterance.voice = maleVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  };

  // Sync state with the group
  useSync(groupId, { scoreA, scoreB, setsA, setsB, isSwapped, seconds, isActive, teamAPlayers, teamBPlayers, teamAOnCourt, teamBOnCourt }, (newState) => {
    if (newState.scoreA !== undefined) setScoreA(newState.scoreA);
    if (newState.scoreB !== undefined) setScoreB(newState.scoreB);
    if (newState.setsA !== undefined) setSetsA(newState.setsA);
    if (newState.setsB !== undefined) setSetsB(newState.setsB);
    if (newState.isSwapped !== undefined) setIsSwapped(newState.isSwapped);
    if (newState.seconds !== undefined) setSeconds(newState.seconds);
    if (newState.isActive !== undefined) setIsActive(newState.isActive);
    if (newState.teamAPlayers !== undefined) setTeamAPlayers(newState.teamAPlayers);
    if (newState.teamBPlayers !== undefined) setTeamBPlayers(newState.teamBPlayers);
    if (newState.teamAOnCourt !== undefined) setTeamAOnCourt(newState.teamAOnCourt);
    if (newState.teamBOnCourt !== undefined) setTeamBOnCourt(newState.teamBOnCourt);
  });

  const saveMatch = async () => {
    if (setsA === 0 && setsB === 0 && scoreA === 0 && scoreB === 0) return;
    
    setIsSaving(true);
    const winnerTeam = setsA > setsB ? 'A' : setsB > setsA ? 'B' : null;
    
    const matchData: Match = {
      id: crypto.randomUUID(),
      team_a_score: scoreA,
      team_b_score: scoreB,
      sets_a: setsA,
      sets_b: setsB,
      team_a_players: teamAPlayers,
      team_b_players: teamBPlayers,
      winner_team: winnerTeam,
      created_at: new Date().toISOString()
    };

    // Update individual player stats
    const allMatchPlayers = [...new Set([...teamAPlayers, ...teamBPlayers])];
    for (const playerId of allMatchPlayers) {
      const isTeamA = teamAPlayers.includes(playerId);
      const isWinner = (isTeamA && winnerTeam === 'A') || (!isTeamA && winnerTeam === 'B');
      const isLoser = (isTeamA && winnerTeam === 'B') || (!isTeamA && winnerTeam === 'A');
      
      const stats = {
        wins: isWinner ? 1 : 0,
        losses: isLoser ? 1 : 0,
        games_played: 1,
        sets_won: isTeamA ? setsA : setsB,
        sets_lost: isTeamA ? setsB : setsA
      };
      
      SyncManager.addToQueue({ 
        type: 'player_stats', 
        groupId, 
        data: { playerId, stats } 
      });
      dbUpdatePlayerStats(playerId, stats);
    }

    onSaveMatch(matchData);

    setIsSaving(false);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
    resetGame();
  };

  const addPoint = (team: 'A' | 'B') => {
    if (selectedPlayerId || selectedPositionIndex !== null) {
      setSelectedPlayerId(null);
      setSelectedPositionIndex(null);
      setSelectedTeam(null);
      return;
    }
    
    if (!isActive) toggleTimer();
    setHistory([...history, { a: scoreA, b: scoreB }]);
    
    if (team === 'A') {
      const newScore = scoreA + 1;
      setScoreA(newScore);
      playSound('beep');
      speak(`${newScore} a ${scoreB}`);
      checkSetWinner(newScore, scoreB, 'A');
    } else {
      const newScore = scoreB + 1;
      setScoreB(newScore);
      playSound('beep');
      speak(`${scoreA} a ${newScore}`);
      checkSetWinner(scoreA, newScore, 'B');
    }
  };

  const checkSetWinner = (sA: number, sB: number, lastScorer: 'A' | 'B') => {
    const target = settings.points_per_set;
    const diff = Math.abs(sA - sB);

    if ((sA >= target || sB >= target) && diff >= 2) {
      playSound('whistle');
      let gameEnded = false;
      const setsToWin = Math.ceil(settings.max_sets / 2);

      if (lastScorer === 'A') {
        const newSets = setsA + 1;
        setSetsA(newSets);
        if (newSets >= setsToWin) {
          speak(`Fim de jogo! Vitória do ${settings.team_a_name}`);
          gameEnded = true;
        } else {
          speak(`Fim de set para ${settings.team_a_name}`);
        }
      } else {
        const newSets = setsB + 1;
        setSetsB(newSets);
        if (newSets >= setsToWin) {
          speak(`Fim de jogo! Vitória do ${settings.team_b_name}`);
          gameEnded = true;
        } else {
          speak(`Fim de set para ${settings.team_b_name}`);
        }
      }
      
      if (gameEnded) {
        // Keep the score for a moment before reset or just stop
        setIsActive(false);
      } else {
        resetSet();
      }
    }
  };

  const resetSet = () => {
    setScoreA(0);
    setScoreB(0);
    setHistory([]);
    resetTimer();
  };

  const undoPoint = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setScoreA(last.a);
    setScoreB(last.b);
    setHistory(history.slice(0, -1));
  };

  const resetGame = () => {
    setScoreA(0);
    setScoreB(0);
    setSetsA(0);
    setSetsB(0);
    setHistory([]);
    setTeamAPlayers([]);
    setTeamBPlayers([]);
    resetTimer();
  };

  const togglePlayerInTeam = (playerId: string, team: 'A' | 'B') => {
    if (team === 'A') {
      const isRemoving = teamAPlayers.includes(playerId);
      setTeamAPlayers(prev => 
        isRemoving ? prev.filter(id => id !== playerId) : [...prev, playerId]
      );
      setTeamBPlayers(prev => prev.filter(id => id !== playerId));
      
      if (isRemoving) {
        setTeamAOnCourt(prev => prev.map(id => id === playerId ? null : id));
      }
    } else {
      const isRemoving = teamBPlayers.includes(playerId);
      setTeamBPlayers(prev => 
        isRemoving ? prev.filter(id => id !== playerId) : [...prev, playerId]
      );
      setTeamAPlayers(prev => prev.filter(id => id !== playerId));
      
      if (isRemoving) {
        setTeamBOnCourt(prev => prev.map(id => id === playerId ? null : id));
      }
    }
  };

  const handleCourtClick = (team: 'A' | 'B', index: number) => {
    const onCourt = team === 'A' ? teamAOnCourt : teamBOnCourt;
    
    if (selectedPlayerId && selectedTeam === team) {
      // Swap bench player with court position
      const newOnCourt = [...onCourt];
      // If the player was already on court elsewhere, remove them from there
      const existingIdx = newOnCourt.indexOf(selectedPlayerId);
      if (existingIdx !== -1) newOnCourt[existingIdx] = null;
      
      newOnCourt[index] = selectedPlayerId;
      if (team === 'A') setTeamAOnCourt(newOnCourt);
      else setTeamBOnCourt(newOnCourt);
      
      setSelectedPlayerId(null);
      setSelectedPositionIndex(null);
      setSelectedTeam(null);
    } else if (selectedPositionIndex !== null && selectedTeam === team) {
      // Swap two court positions
      const newOnCourt = [...onCourt];
      const temp = newOnCourt[index];
      newOnCourt[index] = newOnCourt[selectedPositionIndex];
      newOnCourt[selectedPositionIndex] = temp;
      if (team === 'A') setTeamAOnCourt(newOnCourt);
      else setTeamBOnCourt(newOnCourt);
      
      setSelectedPlayerId(null);
      setSelectedPositionIndex(null);
      setSelectedTeam(null);
    } else {
      // Select court position
      setSelectedPositionIndex(index);
      setSelectedPlayerId(null);
      setSelectedTeam(team);
    }
  };

  const handleBenchClick = (team: 'A' | 'B', playerId: string) => {
    if (selectedPositionIndex !== null && selectedTeam === team) {
      // Swap court position with bench player
      const onCourt = team === 'A' ? teamAOnCourt : teamBOnCourt;
      const newOnCourt = [...onCourt];
      
      // If the player was already on court elsewhere, remove them from there
      const existingIdx = newOnCourt.indexOf(playerId);
      if (existingIdx !== -1) newOnCourt[existingIdx] = null;

      newOnCourt[selectedPositionIndex] = playerId;
      if (team === 'A') setTeamAOnCourt(newOnCourt);
      else setTeamBOnCourt(newOnCourt);
      
      setSelectedPlayerId(null);
      setSelectedPositionIndex(null);
      setSelectedTeam(null);
    } else {
      // Select bench player
      setSelectedPlayerId(playerId);
      setSelectedPositionIndex(null);
      setSelectedTeam(team);
    }
  };

  const CourtView = ({ team, onCourt, bench }: { team: 'A' | 'B', onCourt: (string | null)[], bench: string[] }) => {
    // Volleyball positions:
    // 4 3 2
    // 5 6 1
    const positions = [3, 2, 1, 4, 5, 0]; // Indices for positions 4, 3, 2, 5, 6, 1
    
    return (
      <div className="flex flex-col gap-2 w-full max-w-[280px] mx-auto z-20">
        {/* Bench / Waiting list at the top */}
        <div className="flex flex-wrap justify-center gap-1 min-h-[32px] p-1 bg-black/20 rounded-lg border border-white/5">
          {bench.length === 0 && <span className="text-[8px] text-white/20 uppercase font-bold self-center">Reserva Vazia</span>}
          {bench.map(id => {
            const p = players.find(player => player.id === id);
            const isSelected = selectedPlayerId === id && selectedTeam === team;
            return (
              <button
                key={id}
                onClick={(e) => { e.stopPropagation(); handleBenchClick(team, id); }}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[9px] font-bold transition-all border",
                  isSelected 
                    ? "bg-orange-500 border-orange-400 text-white scale-110 shadow-lg z-10" 
                    : "bg-slate-800/80 border-white/10 text-slate-300 hover:border-white/30"
                )}
              >
                {p?.name.split(' ')[0]}
              </button>
            );
          })}
        </div>

        {/* Court Grid */}
        <div className="grid grid-cols-3 gap-1.5 aspect-[3/2] bg-black/10 rounded-xl p-2 border-2 border-white/10 relative overflow-hidden">
          {/* Net line indicator */}
          <div className="absolute top-0 left-0 w-full h-0.5 bg-white/20" />
          
          {positions.map((posIdx) => {
            const playerId = onCourt[posIdx];
            const p = players.find(player => player.id === playerId);
            const isSelected = selectedPositionIndex === posIdx && selectedTeam === team;
            
            return (
              <button
                key={posIdx}
                onClick={(e) => { e.stopPropagation(); handleCourtClick(team, posIdx); }}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-lg border-2 transition-all group",
                  isSelected 
                    ? "bg-orange-500/30 border-orange-500 scale-105 z-10 shadow-xl" 
                    : "bg-slate-900/40 border-white/5 hover:border-white/20"
                )}
              >
                <span className="absolute top-0.5 left-1 text-[7px] font-black text-white/20">
                  {posIdx === 3 ? '4' : posIdx === 2 ? '3' : posIdx === 1 ? '2' : posIdx === 4 ? '5' : posIdx === 5 ? '6' : '1'}
                </span>
                
                {p ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-slate-800 border border-white/10 overflow-hidden mb-0.5">
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-white/40">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="text-[8px] font-black text-white truncate w-full px-0.5 text-center leading-tight">
                      {p.name.split(' ')[0]}
                    </span>
                  </>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                    <UserPlus size={8} className="text-white/20" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const TeamSide = ({ team, score, sets, color, name, playerIds, onCourt }: { 
    team: 'A' | 'B', 
    score: number, 
    sets: number, 
    color: string,
    name: string,
    playerIds: string[],
    onCourt: (string | null)[]
  }) => {
    const bench = playerIds.filter(id => !onCourt.includes(id));
    
    return (
      <motion.div 
        className="relative flex-1 flex flex-col items-center justify-center cursor-default select-none overflow-hidden group"
      >
        {/* Background with color overlay */}
        <div 
          onClick={() => addPoint(team)}
          className="absolute inset-0 opacity-20 transition-colors duration-500"
          style={{ backgroundColor: color }}
        />
        
        {/* Set indicators */}
        <div className="absolute top-4 landscape:top-2 flex gap-1.5 z-20">
          {Array.from({ length: settings.max_sets }).map((_, i) => (
            <div 
              key={i}
              className={cn(
                "w-2.5 h-2.5 rounded-full border-2 transition-all duration-300",
                i < sets ? "bg-white border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "border-white/20"
              )}
            />
          ))}
        </div>

        <div className="z-10 flex flex-col items-center w-full px-4 mt-10 landscape:mt-6">
          <h2 className="text-xl landscape:text-base font-black text-white uppercase tracking-tighter mb-2 drop-shadow-md flex items-center gap-2">
            {name}
            <button 
              onClick={(e) => { e.stopPropagation(); setShowEscalacao(true); setSelectingTeam(team); }}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <Users size={14} />
            </button>
          </h2>
          
          <CourtView team={team} onCourt={onCourt} bench={bench} />
        </div>
        
        <span 
          onClick={() => addPoint(team)}
          className={cn(
            "text-[8rem] sm:text-[10rem] md:text-[14rem] landscape:text-[4rem] landscape:md:text-[7rem] font-black text-white leading-none z-10 drop-shadow-2xl transition-opacity mt-4"
          )}
        >
          {score}
        </span>

        <div className="absolute bottom-6 landscape:bottom-2 opacity-0 group-hover:opacity-100 transition-opacity text-white/40 text-[10px] font-bold uppercase tracking-widest">
          Toque para pontuar
        </div>
      </motion.div>
    );
  };

  const teamAData = { team: 'A' as const, score: scoreA, sets: setsA, color: settings.team_a_color, name: settings.team_a_name, playerIds: teamAPlayers, onCourt: teamAOnCourt };
  const teamBData = { team: 'B' as const, score: scoreB, sets: setsB, color: settings.team_b_color, name: settings.team_b_name, playerIds: teamBPlayers, onCourt: teamBOnCourt };

  return (
    <div className="relative h-full flex flex-col bg-slate-950 overflow-hidden">
      {/* Court Texture */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/sandpaper.png')]" />
      
      {/* Main Score Area */}
      <div className={cn(
        "flex-1 min-h-0 flex transition-all duration-700",
        isSwapped ? "flex-row-reverse" : "flex-row",
        "portrait:flex-col landscape:flex-row"
      )}>
        <TeamSide {...teamAData} />
        
        {/* Net / Divider */}
        <div className={cn(
          "relative bg-white/10 flex items-center justify-center z-20",
          "portrait:h-1 portrait:w-full landscape:w-1 landscape:h-full"
        )}>
          <div className={cn(
            "absolute bg-gradient-to-b from-transparent via-white/40 to-transparent",
            "portrait:w-full portrait:h-px landscape:h-full landscape:w-px"
          )} />
          <button 
            onClick={toggleTimer}
            className="bg-slate-900 px-6 py-3 landscape:px-4 landscape:py-2 rounded-2xl border border-white/20 shadow-2xl backdrop-blur-md active:scale-95 transition-transform cursor-pointer"
          >
            <span className="text-3xl md:text-4xl landscape:text-2xl font-mono font-black text-orange-500 tabular-nums">
              {formatTime(seconds)}
            </span>
          </button>
        </div>

        <TeamSide {...teamBData} />
      </div>

      {/* Saved Toast */}
      <AnimatePresence>
        {showSavedToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-2xl font-bold shadow-xl flex items-center gap-2"
          >
            <Save size={20} />
            Partida Salva!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Escalacao Modal */}
      <AnimatePresence>
        {showEscalacao && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-slate-900 w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                    <Users size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Escalação</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Defina quem está em quadra</p>
                  </div>
                </div>
                <button onClick={() => setShowEscalacao(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-400">
                  <X size={24} />
                </button>
              </div>

              <div className="flex border-b border-white/5">
                <button 
                  onClick={() => setSelectingTeam('A')}
                  className={cn(
                    "flex-1 py-4 font-bold transition-all border-b-2",
                    selectingTeam === 'A' ? "text-orange-500 border-orange-500 bg-orange-500/5" : "text-slate-500 border-transparent"
                  )}
                >
                  {settings.team_a_name} ({teamAPlayers.length})
                </button>
                <button 
                  onClick={() => setSelectingTeam('B')}
                  className={cn(
                    "flex-1 py-4 font-bold transition-all border-b-2",
                    selectingTeam === 'B' ? "text-orange-500 border-orange-500 bg-orange-500/5" : "text-slate-500 border-transparent"
                  )}
                >
                  {settings.team_b_name} ({teamBPlayers.length})
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-2 custom-scrollbar">
                {players.map(player => {
                  const isInA = teamAPlayers.includes(player.id);
                  const isInB = teamBPlayers.includes(player.id);
                  const isSelected = selectingTeam === 'A' ? isInA : isInB;
                  const isInOther = selectingTeam === 'A' ? isInB : isInA;

                  return (
                    <button
                      key={player.id}
                      onClick={() => togglePlayerInTeam(player.id, selectingTeam!)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-2xl border transition-all text-left",
                        isSelected 
                          ? "bg-orange-500 border-orange-400 shadow-lg shadow-orange-500/20" 
                          : isInOther
                          ? "bg-slate-800/30 border-white/5 opacity-30 grayscale cursor-not-allowed"
                          : "bg-slate-800/50 border-white/5 hover:border-white/20"
                      )}
                      disabled={isInOther}
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-700 overflow-hidden flex-shrink-0 border border-white/10">
                        {player.photo_url ? (
                          <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-white/40">
                            {player.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className={cn(
                        "font-bold text-sm truncate",
                        isSelected ? "text-white" : "text-slate-300"
                      )}>
                        {player.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="p-6 bg-slate-900/80 border-t border-white/5">
                <button 
                  onClick={() => setShowEscalacao(false)}
                  className="w-full bg-white text-slate-950 font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all"
                >
                  CONFIRMAR ESCALAÇÃO
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls Bar */}
      <div className={cn(
        "bg-slate-900/80 backdrop-blur-xl border-t border-white/10 flex items-center justify-center gap-4 md:gap-8 px-6 z-30 transition-all",
        "portrait:h-24 landscape:h-20"
      )}>
        <button 
          onClick={undoPoint}
          className="p-3 sm:p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all active:scale-90"
          title="Desfazer ponto"
        >
          <Undo2 size={20} className="sm:w-6 sm:h-6" />
        </button>

        <button 
          onClick={() => setIsSwapped(!isSwapped)}
          className="p-3 sm:p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all active:scale-90"
          title="Inverter lados"
        >
          <RefreshCw size={20} className="sm:w-6 sm:h-6" />
        </button>

        <button 
          onClick={toggleTimer}
          className={cn(
            "p-4 sm:p-6 rounded-3xl transition-all active:scale-95 shadow-lg",
            isActive ? "bg-red-500 text-white shadow-red-500/20" : "bg-green-500 text-white shadow-green-500/20"
          )}
        >
          {isActive ? <Pause size={28} className="sm:w-8 sm:h-8" fill="currentColor" /> : <Play size={28} className="sm:w-8 sm:h-8" fill="currentColor" />}
        </button>

        <button 
          onClick={saveMatch}
          disabled={isSaving}
          className={cn(
            "p-4 rounded-2xl transition-all active:scale-90 flex items-center gap-2",
            isSaving ? "bg-slate-700 text-slate-500" : "bg-orange-500/20 text-orange-500 hover:bg-orange-500/30"
          )}
          title="Salvar Partida"
        >
          <Save size={24} />
          <span className="hidden md:inline font-bold">Finalizar Jogo</span>
        </button>

        <button 
          onClick={resetSet}
          className="p-3 sm:p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all active:scale-90"
          title="Resetar Set"
        >
          <RotateCcw size={20} className="sm:w-6 sm:h-6" />
        </button>

        <button 
          onClick={resetGame}
          className="p-3 sm:p-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all active:scale-90"
          title="Resetar Jogo"
        >
          <X size={20} className="sm:w-6 sm:h-6" />
        </button>
      </div>
    </div>
  );
};
