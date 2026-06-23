import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RotateCcw, 
  Undo2, 
  Play, 
  Pause, 
  RefreshCw, 
  X, 
  Save, 
  Volume2, 
  VolumeX, 
  Mic, 
  MicOff, 
  Settings as SettingsIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Match, Settings, Player } from '../types';
import { useTimer } from '../hooks/useTimer';
import { useSync } from '../hooks/useSync';
import { formatTime, cn, generateId } from '../lib/utils';
import { dbSaveScoreboard, dbUpdatePlayerStats } from '../lib/supabase';
import { SyncManager } from '../lib/syncManager';

interface ScoreboardProps {
  settings: Settings;
  groupId: string;
  players: Player[];
  onSaveMatch: (match: Match) => void;
  onUpdateSettings?: (settings: Partial<Settings>) => void;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ 
  settings, 
  groupId, 
  players, 
  onSaveMatch,
  onUpdateSettings 
}) => {
  // Current game score states
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [setsA, setSetsA] = useState(0);
  const [setsB, setSetsB] = useState(0);
  const [isSwapped, setIsSwapped] = useState(false);
  const [history, setHistory] = useState<{ a: number; b: number }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Keep other variables in state for Supabase/P2P sync compatibility
  const [teamAPlayers, setTeamAPlayers] = useState<string[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<string[]>([]);
  const [teamAOnCourt, setTeamAOnCourt] = useState<(string | null)[]>(Array(6).fill(null));
  const [teamBOnCourt, setTeamBOnCourt] = useState<(string | null)[]>(Array(6).fill(null));
  const [waitingTeams, setWaitingTeams] = useState<string[][]>([]);

  const { seconds, isActive, toggleTimer, resetTimer, setSeconds, setIsActive } = useTimer();

  // Audio & speech helper functions
  const playSound = (type: 'beep' | 'whistle') => {
    if (!settings.enable_sounds) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const audioCtx = new AudioCtxClass();
      
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
        const whistle = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
        whistle.volume = 0.3;
        whistle.play().catch(e => console.log('Audio play failed:', e));
      }
    } catch (e) {
      console.warn('Audio play contextual issue:', e);
    }
  };

  const speak = (text: string) => {
    if (!settings.enable_voice) return;
    try {
      if (!window.speechSynthesis || !SpeechSynthesisUtterance) return;
      const localizedText = text.replace(/Time/gi, 'Equipe');
      const utterance = new SpeechSynthesisUtterance(localizedText);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.1;

      const voices = window.speechSynthesis.getVoices();
      const maleVoice = voices.find(v => v.lang.startsWith('pt') && (
        v.name.toLowerCase().includes('male') || 
        v.name.toLowerCase().includes('masculino') || 
        v.name.toLowerCase().includes('daniel') || 
        v.name.toLowerCase().includes('google português do brasil')
      ));
      
      if (maleVoice) {
        utterance.voice = maleVoice;
      }
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis not fully supported in this context:', e);
    }
  };

  // Sync state across multiple monitors and devices using useSync
  useSync(groupId, { 
    scoreA, 
    scoreB, 
    setsA, 
    setsB, 
    isSwapped, 
    seconds, 
    isActive, 
    teamAPlayers, 
    teamBPlayers, 
    teamAOnCourt, 
    teamBOnCourt, 
    waitingTeams, 
    history 
  }, (newState) => {
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
    if (newState.waitingTeams !== undefined) setWaitingTeams(newState.waitingTeams);
    if (newState.history !== undefined) setHistory(newState.history);
  });

  const saveMatch = async () => {
    if (setsA === 0 && setsB === 0 && scoreA === 0 && scoreB === 0) return;
    
    setIsSaving(true);
    const winnerTeam = setsA > setsB ? 'A' : setsB > setsA ? 'B' : null;
    
    const matchData: Match = {
      id: generateId(),
      team_a_score: scoreA,
      team_b_score: scoreB,
      sets_a: setsA,
      sets_b: setsB,
      team_a_players: teamAPlayers,
      team_b_players: teamBPlayers,
      winner_team: winnerTeam,
      created_at: new Date().toISOString()
    };

    // Update individual player stats if players exist
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

  const subtractPoint = (team: 'A' | 'B', e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering addPoint
    setHistory([...history, { a: scoreA, b: scoreB }]);
    if (team === 'A') {
      setScoreA(prev => Math.max(0, prev - 1));
    } else {
      setScoreB(prev => Math.max(0, prev - 1));
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
    resetTimer();
  };

  return (
    <div className="relative h-full flex flex-col bg-slate-950 overflow-hidden font-sans">
      {/* Subtle court grid textures */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/sandpaper.png')]" />

      {/* 1. BARRA DE CONFIGURAÇÕES DO JOGO (GAME RULES BAR) */}
      <div className="w-full bg-slate-900/60 backdrop-blur-md border-b border-white/5 py-3 px-6 z-40 flex items-center justify-between gap-4 select-none">
        
        {/* Placeholder spacer for Menu alignment on mobile */}
        <div className="w-10 xl:hidden flex-shrink-0" />

        {/* Dynamic settings controllers */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 flex-1 text-xs">
          
          {/* Quick Point limit selector */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1">
            <span className="text-slate-400 font-medium">Pontos do Set:</span>
            <button 
              type="button" 
              onClick={() => onUpdateSettings?.({ points_per_set: Math.max(5, settings.points_per_set - 1) })}
              className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded font-black active:scale-90"
            >
              -
            </button>
            <span className="font-bold text-orange-500 font-mono w-5 text-center">{settings.points_per_set}</span>
            <button 
              type="button" 
              onClick={() => onUpdateSettings?.({ points_per_set: settings.points_per_set + 1 })}
              className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded font-black active:scale-90"
            >
              +
            </button>
          </div>

          {/* Quick Set Limit config */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1">
            <span className="text-slate-400 font-medium">Melhor de:</span>
            <button
              onClick={() => {
                const nextSets: Record<number, number> = { 1: 3, 3: 5, 5: 1 };
                onUpdateSettings?.({ max_sets: nextSets[settings.max_sets] || 3 });
              }}
              className="px-2 py-0.5 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 text-[10px] font-black rounded uppercase tracking-wide transition-all"
            >
              {settings.max_sets} {settings.max_sets === 1 ? 'Set' : 'Sets'}
            </button>
          </div>

          {/* Sound Effect Toggle */}
          <button
            onClick={() => onUpdateSettings?.({ enable_sounds: !settings.enable_sounds })}
            className={cn(
              "p-1.5 rounded-xl border flex items-center gap-1 transition-all",
              settings.enable_sounds 
                ? "bg-slate-800 border-white/10 text-emerald-400 hover:bg-slate-750" 
                : "bg-slate-900 border-white/5 text-slate-500 hover:text-slate-400"
            )}
            title="Efeitos sonoros"
          >
            {settings.enable_sounds ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>

          {/* Speech voice announcer toggle */}
          <button
            onClick={() => onUpdateSettings?.({ enable_voice: !settings.enable_voice })}
            className={cn(
              "p-1.5 rounded-xl border flex items-center gap-1 transition-all",
              settings.enable_voice 
                ? "bg-slate-800 border-white/10 text-emerald-400 hover:bg-slate-750" 
                : "bg-slate-900 border-white/5 text-slate-500 hover:text-slate-400"
            )}
            title="Anunciador de voz"
          >
            {settings.enable_voice ? <Mic size={14} /> : <MicOff size={14} />}
          </button>
        </div>

        {/* Group name visual tag */}
        <div className="hidden md:flex items-center gap-1.5 py-1 px-3 bg-slate-900 border border-white/5 rounded-xl text-[10px] font-bold text-slate-400 font-mono tracking-wider">
          TURMA: {groupId}
        </div>
      </div>

      {/* 2. PLACAR AREA (GIANT INTERACTIVE SPLIT SCORE LAYOUT) */}
      <div className={cn(
        "flex-1 min-h-0 flex overflow-hidden transition-all duration-500",
        isSwapped ? "flex-row-reverse" : "flex-row",
        "portrait:flex-col landscape:flex-row"
      )}>
        
        {/* TEAM A PANEL */}
        <div 
          onClick={() => addPoint('A')}
          className="relative flex-1 flex flex-col items-center justify-center p-6 select-none cursor-pointer group/side transition-all overflow-hidden"
        >
          {/* Subtle color highlight background glow */}
          <div 
            className="absolute inset-0 opacity-[0.12] group-hover/side:opacity-[0.18] transition-opacity duration-300 pointer-events-none"
            style={{ backgroundColor: settings.team_a_color }}
          />

          {/* Team Name Header with accent border line */}
          <div className="z-10 flex flex-col items-center mb-4 transition-all">
            <span 
              className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter text-white drop-shadow-md text-center max-w-[280px] truncate"
              style={{ textShadow: `0 4px 12px ${settings.team_a_color}20` }}
            >
              {settings.team_a_name}
            </span>
            <div 
              className="w-12 h-1 rounded-full mt-2 transition-transform group-hover/side:scale-x-125"
              style={{ backgroundColor: settings.team_a_color }}
            />
          </div>

          {/* Sets tracker - dot selector for easy edit */}
          <div className="z-10 flex items-center gap-2.5 mb-2 bg-black/30 px-3 py-1.5 rounded-full border border-white/5">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Sets</span>
            <div className="flex gap-1.5">
              {Array.from({ length: settings.max_sets }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation(); // Avoid adding point
                    setSetsA(i < setsA ? i : i + 1);
                  }}
                  className={cn(
                    "w-4 h-4 rounded-full border-2 transition-all duration-300",
                    i < setsA 
                      ? "bg-white border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.7)]" 
                      : "border-white/20 hover:border-white/40"
                  )}
                />
              ))}
            </div>
          </div>

          {/* GIANT SCORE BOX WITH EASY SUBTRACT CONTAINER */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Interactive display counter */}
            <span className="text-[12rem] sm:text-[18rem] md:text-[22rem] lg:text-[26rem] portrait:text-[10rem] font-black leading-none text-white tracking-tighter font-mono filter drop-shadow-[0_10px_40px_rgba(0,0,0,0.7)] select-none tabular-nums active:scale-95 transition-transform">
              {scoreA}
            </span>

            {/* Float Subtract button */}
            <button
              onClick={(e) => subtractPoint('A', e)}
              className="mt-2 px-4 py-2 bg-slate-900/90 border border-white/10 hover:border-red-500/30 hover:bg-slate-800 text-slate-400 hover:text-red-400 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-1 opacity-80 hover:opacity-100"
              title="Diminuir Ponto"
            >
              <span>- 1 PONTO</span>
            </button>
          </div>
        </div>

        {/* CENTER DIVIDER GRID & TIMED CRONÔMETRO CONTAINER */}
        <div className={cn(
          "relative bg-white/5 flex items-center justify-center z-30",
          "portrait:h-0.5 portrait:w-full landscape:w-0.5 landscape:h-full"
        )}>
          {/* Centered stopwatch layout bubble */}
          <div className="absolute transform -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 flex flex-col items-center z-30">
            <div className="bg-slate-900 border border-white/10 p-3 sm:p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-1 min-w-[130px] sm:min-w-[160px] backdrop-blur-md">
              <span className="text-[9px] uppercase tracking-widest font-black text-slate-500">Cronômetro</span>
              
              <button 
                onClick={toggleTimer}
                className={cn(
                  "text-2xl sm:text-3xl font-mono font-black tabular-nums transition-colors tracking-tight focus:outline-none flex items-center justify-center gap-1",
                  isActive ? "text-orange-500 animate-pulse" : "text-slate-300 hover:text-white"
                )}
              >
                {formatTime(seconds)}
              </button>

              <div className="flex gap-2.5 mt-1 border-t border-white/5 pt-1.5 w-full justify-center">
                <button 
                  onClick={toggleTimer}
                  className={cn(
                    "p-1.5 rounded-lg text-white hover:opacity-90 active:scale-90 transition-transform",
                    isActive ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
                  )}
                  title={isActive ? "Pausar" : "Iniciar"}
                >
                  {isActive ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                </button>
                <button 
                  onClick={resetTimer}
                  className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white active:scale-90 transition-transform"
                  title="Reiniciar Cronômetro"
                >
                  <RotateCcw size={10} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TEAM B PANEL */}
        <div 
          onClick={() => addPoint('B')}
          className="relative flex-1 flex flex-col items-center justify-center p-6 select-none cursor-pointer group/side transition-all overflow-hidden"
        >
          {/* Subtle color highlight background glow */}
          <div 
            className="absolute inset-0 opacity-[0.12] group-hover/side:opacity-[0.18] transition-opacity duration-300 pointer-events-none"
            style={{ backgroundColor: settings.team_b_color }}
          />

          {/* Team Name Header with accent border line */}
          <div className="z-10 flex flex-col items-center mb-4 transition-all">
            <span 
              className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter text-white drop-shadow-md text-center max-w-[280px] truncate"
              style={{ textShadow: `0 4px 12px ${settings.team_b_color}20` }}
            >
              {settings.team_b_name}
            </span>
            <div 
              className="w-12 h-1 rounded-full mt-2 transition-transform group-hover/side:scale-x-125"
              style={{ backgroundColor: settings.team_b_color }}
            />
          </div>

          {/* Sets tracker - dot selector for easy edit */}
          <div className="z-10 flex items-center gap-2.5 mb-2 bg-black/30 px-3 py-1.5 rounded-full border border-white/5">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Sets</span>
            <div className="flex gap-1.5">
              {Array.from({ length: settings.max_sets }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation(); // Avoid adding point
                    setSetsB(i < setsB ? i : i + 1);
                  }}
                  className={cn(
                    "w-4 h-4 rounded-full border-2 transition-all duration-300",
                    i < setsB 
                      ? "bg-white border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.7)]" 
                      : "border-white/20 hover:border-white/40"
                  )}
                />
              ))}
            </div>
          </div>

          {/* GIANT SCORE BOX WITH EASY SUBTRACT CONTAINER */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Interactive display counter */}
            <span className="text-[12rem] sm:text-[18rem] md:text-[22rem] lg:text-[26rem] portrait:text-[10rem] font-black leading-none text-white tracking-tighter font-mono filter drop-shadow-[0_10px_40px_rgba(0,0,0,0.7)] select-none tabular-nums active:scale-95 transition-transform">
              {scoreB}
            </span>

            {/* Float Subtract button */}
            <button
              onClick={(e) => subtractPoint('B', e)}
              className="mt-2 px-4 py-2 bg-slate-900/90 border border-white/10 hover:border-red-500/30 hover:bg-slate-800 text-slate-400 hover:text-red-400 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-1 opacity-80 hover:opacity-100"
              title="Diminuir Ponto"
            >
              <span>- 1 PONTO</span>
            </button>
          </div>
        </div>

      </div>

      {/* 3. BARRA DE CONTROLES DO JOGO (BOTTOM ACTION BAR) */}
      <div className="bg-slate-900/90 border-t border-white/10 py-4 px-6 z-40 select-none flex items-center justify-between gap-4">
        
        {/* Left grouping */}
        <div className="flex items-center gap-2">
          <button 
            onClick={undoPoint}
            disabled={history.length === 0}
            className={cn(
              "p-3 rounded-2xl border transition-all active:scale-90",
              history.length === 0
                ? "bg-slate-850 border-white/5 text-slate-600 cursor-not-allowed"
                : "bg-white/5 border-white/10 hover:bg-white/10 text-slate-200"
            )}
            title="Desfazer último ponto"
          >
            <Undo2 size={18} />
          </button>

          <button 
            onClick={() => setIsSwapped(!isSwapped)}
            className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 transition-all active:scale-90"
            title="Inverter lados da quadra"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Center Main Action */}
        <div className="flex items-center gap-3">
          <button 
            onClick={saveMatch}
            disabled={isSaving}
            className={cn(
              "px-6 py-3 font-black uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-95 flex items-center gap-2 text-xs",
              isSaving 
                ? "bg-slate-800 text-slate-500" 
                : "bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 shadow-orange-500/10 text-white"
            )}
          >
            <Save size={16} />
            <span>Finalizar Jogo</span>
          </button>
        </div>

        {/* Right Reset Grouping */}
        <div className="flex items-center gap-2">
          <button 
            onClick={resetSet}
            className="px-3.5 py-3 text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 rounded-2xl active:scale-90 transition-all"
            title="Resetar placar do Set atual"
          >
            LIMPAR SET
          </button>

          <button 
            onClick={resetGame}
            className="p-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/10 active:scale-90 transition-all"
            title="Zeramento total do jogo"
          >
            <X size={18} />
          </button>
        </div>

      </div>

      {/* 4. SAVED MATCH POPUP/TOAST */}
      <AnimatePresence>
        {showSavedToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-5 py-3 rounded-2xl font-bold shadow-2xl flex items-center gap-2.5"
          >
            <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
              ✓
            </div>
            <span>Partida salva no histórico!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
