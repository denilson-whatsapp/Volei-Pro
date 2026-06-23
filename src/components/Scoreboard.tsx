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

  const setsToWin = Math.ceil(settings.max_sets / 2);
  const isMatchOver = setsA >= setsToWin || setsB >= setsToWin;

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

  // Reactive set/match finish detection
  const requireLead = settings.require_two_point_lead !== false;
  const diff = Math.abs(scoreA - scoreB);
  const target = settings.points_per_set;

  const isSetEnded = (scoreA >= target || scoreB >= target) && (!requireLead || diff >= 2);
  const setWinner = isSetEnded ? (scoreA > scoreB ? 'A' : 'B') : null;

  const isMatchEnded = setWinner === 'A' 
    ? (setsA + 1 >= setsToWin) 
    : setWinner === 'B' 
      ? (setsB + 1 >= setsToWin) 
      : false;

  const lastAnnouncedSetRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (isSetEnded && setWinner) {
      const announcementKey = `${scoreA}-${scoreB}-${setsA}-${setsB}`;
      if (lastAnnouncedSetRef.current !== announcementKey) {
        lastAnnouncedSetRef.current = announcementKey;
        playSound('whistle');
        setIsActive(false);

        const winnerName = setWinner === 'A' ? settings.team_a_name : settings.team_b_name;
        if (isMatchEnded) {
          speak(`Fim de jogo! Vitória da equipe ${winnerName}`);
        } else {
          speak(`Fim do set! Vitória da equipe ${winnerName}`);
        }
      }
    } else if (!isSetEnded) {
      lastAnnouncedSetRef.current = null;
    }
  }, [isSetEnded, setWinner, isMatchEnded, scoreA, scoreB, setsA, setsB, settings.team_a_name, settings.team_b_name]);

  const addPoint = (team: 'A' | 'B') => {
    if (isMatchOver || isSetEnded) return;
    if (!isActive) toggleTimer();
    setHistory([...history, { a: scoreA, b: scoreB }]);
    
    if (team === 'A') {
      const newScore = scoreA + 1;
      setScoreA(newScore);
      playSound('beep');
      speak(`${newScore} a ${scoreB}`);
    } else {
      const newScore = scoreB + 1;
      setScoreB(newScore);
      playSound('beep');
      speak(`${scoreA} a ${newScore}`);
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

  const resetSet = () => {
    setScoreA(0);
    setScoreB(0);
    setHistory([]);
    resetTimer();
  };

  const advanceSet = () => {
    if (!isSetEnded || !setWinner) return;
    if (setWinner === 'A') {
      setSetsA(prev => prev + 1);
    } else {
      setSetsB(prev => prev + 1);
    }
    resetSet();
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

  const saveMatchWithFinalSets = async (finalWinner: 'A' | 'B') => {
    if (isSaving) return;
    setIsSaving(true);
    
    const finalSetsA = finalWinner === 'A' ? setsA + 1 : setsA;
    const finalSetsB = finalWinner === 'B' ? setsB + 1 : setsB;
    const winnerTeam = finalWinner;
    
    const matchData: Match = {
      id: generateId(),
      team_a_score: scoreA,
      team_b_score: scoreB,
      sets_a: finalSetsA,
      sets_b: finalSetsB,
      team_a_players: teamAPlayers,
      team_b_players: teamBPlayers,
      winner_team: winnerTeam,
      created_at: new Date().toISOString()
    };

    // Update individual player stats if players exist
    if (groupId) {
      const allMatchPlayers = [...new Set([...teamAPlayers, ...teamBPlayers])];
      for (const playerId of allMatchPlayers) {
        const isTeamA = teamAPlayers.includes(playerId);
        const isWinner = (isTeamA && winnerTeam === 'A') || (!isTeamA && winnerTeam === 'B');
        const isLoser = (isTeamA && winnerTeam === 'B') || (!isTeamA && winnerTeam === 'A');
        
        const stats = {
          wins: isWinner ? 1 : 0,
          losses: isLoser ? 1 : 0,
          games_played: 1,
          sets_won: isTeamA ? finalSetsA : finalSetsB,
          sets_lost: isTeamA ? finalSetsB : finalSetsA
        };
        
        SyncManager.addToQueue({ 
          type: 'player_stats', 
          groupId, 
          data: { playerId, stats } 
        });
        dbUpdatePlayerStats(playerId, stats);
      }
    }

    onSaveMatch(matchData);
    setIsSaving(false);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
    resetGame();
  };

  const handleFinalizeMatchFromModal = () => {
    if (setWinner) {
      saveMatchWithFinalSets(setWinner);
    } else {
      saveMatch();
    }
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

          {/* Quick Advantage lead selector */}
          <button
            onClick={() => onUpdateSettings?.({ require_two_point_lead: settings.require_two_point_lead === false ? true : false })}
            className={cn(
              "px-2.5 py-1 border rounded-xl text-xs font-medium transition-all active:scale-95 flex items-center gap-1",
              settings.require_two_point_lead !== false
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-slate-800 border-white/5 text-slate-400 hover:text-slate-300"
            )}
            title="Exigir diferença de 2 pontos para vencer o set"
          >
            <span className="opacity-70">Vantagem (2 pts):</span>
            <span className="font-bold">{settings.require_two_point_lead !== false ? 'SIM' : 'NÃO'}</span>
          </button>

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
        "flex-1 min-h-0 relative transition-all duration-500 overflow-hidden",
        // CSS Grid ensures perfect alignment and absolute block-level symmetry!
        "landscape:grid landscape:grid-cols-[1fr_auto_1fr] portrait:grid portrait:grid-rows-[1fr_auto_1fr]"
      )}>
        
        {/* TEAM A PANEL */}
        <div 
          onClick={() => addPoint('A')}
          className={cn(
            "relative flex flex-col items-center justify-center p-4 select-none cursor-pointer group/side transition-all min-h-0 min-w-0 border-transparent",
            isSwapped ? "order-3" : "order-1"
          )}
        >
          {/* Subtle color highlight background glow */}
          <div 
            className="absolute inset-0 opacity-[0.12] group-hover/side:opacity-[0.18] transition-opacity duration-300 pointer-events-none"
            style={{ backgroundColor: settings.team_a_color }}
          />

          {/* Extremidade Lateral para Nome (Time A) */}
          <div className={cn(
            "z-20 flex select-none items-center",
            // Em computadores/paisagem, fica vertical na lateral extrema esquerda
            "landscape:absolute landscape:left-3 landscape:top-1/2 landscape:-translate-y-1/2 landscape:flex-col landscape:pointer-events-auto",
            // Em celulares/retrato, fica horizontal no topo
            "portrait:absolute portrait:top-3 portrait:left-1/2 portrait:-translate-x-1/2 portrait:flex-col portrait:pointer-events-none"
          )}>
            {/* Team Name - rotacionado em modo paisagem */}
            <div className="flex flex-col items-center transition-all landscape:-rotate-90 landscape:origin-center landscape:my-8">
              <span 
                className="text-sm xs:text-base sm:text-xl md:text-2xl lg:text-3xl font-black uppercase tracking-widest text-white drop-shadow-md text-center max-w-[160px] xs:max-w-[200px] sm:max-w-[240px] truncate"
                style={{ textShadow: `0 4px 12px ${settings.team_a_color}30` }}
              >
                {settings.team_a_name}
              </span>
              <div 
                className="w-12 h-1 rounded-full mt-1 transition-transform group-hover/side:scale-x-125"
                style={{ backgroundColor: settings.team_a_color }}
              />
            </div>
          </div>

          {/* GIANT SCORE BOX WITH EASY SUBTRACT CONTAINER & SETS */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            {/* Interactive display counter - Utiliza vh/vw para ser 100% responsivo e não quebrar em telas restritas */}
            <span className="text-[25vw] xs:text-[23vw] portrait:text-[14vh] landscape:text-[28vh] sm:text-[16rem] md:text-[20rem] lg:text-[26rem] xl:text-[32rem] md:landscape:text-[28vh] lg:landscape:text-[34vh] xl:landscape:text-[38vh] font-black leading-none text-white tracking-tighter font-mono filter drop-shadow-[0_10px_40px_rgba(0,0,0,0.7)] select-none tabular-nums active:scale-95 transition-all">
              {scoreA}
            </span>

            {/* Sets tracker - Novo posicionamento diretamente abaixo do placar */}
            <div 
              onClick={(e) => e.stopPropagation()} // Evita adicionar ponto ao clicar nas bolinhas de set
              className="mt-1 mb-2 xs:mt-2 xs:mb-3 flex items-center gap-2 bg-black/60 px-2.5 py-1 xs:px-3 xs:py-1.5 rounded-full border border-white/5 backdrop-blur-sm shadow-lg pointer-events-auto hover:bg-black/75 transition-colors"
            >
              <span className="text-[8px] xs:text-[9px] uppercase font-black tracking-widest text-slate-400">Sets</span>
              <div className="flex flex-row gap-1">
                {Array.from({ length: settings.max_sets }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // Evita adicionar ponto
                      setSetsA(i < setsA ? i : i + 1);
                    }}
                    className={cn(
                      "w-3 h-3 xs:w-3.5 xs:h-3.5 rounded-full border-2 transition-all duration-300",
                      i < setsA 
                        ? "bg-white border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.7)]" 
                        : "border-white/20 hover:border-white/40"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Float Subtract button */}
            <button
              onClick={(e) => subtractPoint('A', e)}
              className="mt-1 px-3 py-1 bg-slate-900/95 border border-white/10 hover:border-red-500/30 hover:bg-slate-800 text-slate-400 hover:text-red-400 text-[10px] xs:text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-1 opacity-85 hover:opacity-100 backdrop-blur-sm pointer-events-auto"
              title="Diminuir Ponto"
            >
              <span>- 1 PONTO</span>
            </button>
          </div>
        </div>

        {/* CENTER DIVIDER GRID & TIMED CRONÔMETRO CONTAINER */}
        <div className={cn(
          "order-2 relative bg-white/10 flex items-center justify-center z-30",
          "portrait:h-0.5 portrait:w-full landscape:w-0.5 landscape:h-full"
        )}>
          {/* Centered stopwatch layout bubble */}
          <div className="absolute transform -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 flex flex-col items-center z-30">
            <div className="bg-slate-900 border border-white/10 p-2 sm:p-4 rounded-xl sm:rounded-2xl shadow-2xl flex flex-col items-center gap-0.5 sm:gap-1 min-w-[100px] sm:min-w-[160px] backdrop-blur-md">
              <span className="text-[8px] sm:text-[9px] uppercase tracking-widest font-black text-slate-500">Cronômetro</span>
              
              <button 
                onClick={toggleTimer}
                className={cn(
                  "text-xl sm:text-3xl font-mono font-black tabular-nums transition-colors tracking-tight focus:outline-none flex items-center justify-center gap-1",
                  isActive ? "text-orange-500 animate-pulse" : "text-slate-300 hover:text-white"
                )}
              >
                {formatTime(seconds)}
              </button>

              <div className="flex gap-2.5 mt-1 border-t border-white/5 pt-1 sm:pt-1.5 w-full justify-center">
                <button 
                  onClick={toggleTimer}
                  className={cn(
                    "p-1 sm:p-1.5 rounded-lg text-white hover:opacity-90 active:scale-90 transition-transform",
                    isActive ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
                  )}
                  title={isActive ? "Pausar" : "Iniciar"}
                >
                  {isActive ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                </button>
                <button 
                  onClick={resetTimer}
                  className="p-1 sm:p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white active:scale-90 transition-transform"
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
          className={cn(
            "relative flex flex-col items-center justify-center p-4 select-none cursor-pointer group/side transition-all min-h-0 min-w-0 border-transparent",
            isSwapped ? "order-1" : "order-3"
          )}
        >
          {/* Subtle color highlight background glow */}
          <div 
            className="absolute inset-0 opacity-[0.12] group-hover/side:opacity-[0.18] transition-opacity duration-300 pointer-events-none"
            style={{ backgroundColor: settings.team_b_color }}
          />

          {/* Extremidade Lateral para Nome (Time B) */}
          <div className={cn(
            "z-20 flex select-none items-center",
            // Em computadores/paisagem, fica vertical na lateral extrema direita
            "landscape:absolute landscape:right-3 landscape:top-1/2 landscape:-translate-y-1/2 landscape:flex-col landscape:pointer-events-auto",
            // Em celulares/retrato, fica horizontal na base
            "portrait:absolute portrait:bottom-3 portrait:left-1/2 portrait:-translate-x-1/2 portrait:flex-col-reverse portrait:pointer-events-none"
          )}>
            {/* Team Name - rotacionado de forma idêntica em modo paisagem para perfeita simetria e leitura de baixo para cima */}
            <div className="flex flex-col items-center transition-all landscape:-rotate-90 landscape:origin-center landscape:my-8">
              <span 
                className="text-sm xs:text-base sm:text-xl md:text-2xl lg:text-3xl font-black uppercase tracking-widest text-white drop-shadow-md text-center max-w-[160px] xs:max-w-[200px] sm:max-w-[240px] truncate"
                style={{ textShadow: `0 4px 12px ${settings.team_b_color}30` }}
              >
                {settings.team_b_name}
              </span>
              <div 
                className="w-12 h-1 rounded-full mt-1 transition-transform group-hover/side:scale-x-125"
                style={{ backgroundColor: settings.team_b_color }}
              />
            </div>
          </div>

          {/* GIANT SCORE BOX WITH EASY SUBTRACT CONTAINER & SETS */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            {/* Interactive display counter - Utiliza vh/vw para ser 100% responsivo e não quebrar em telas restritas */}
            <span className="text-[25vw] xs:text-[23vw] portrait:text-[14vh] landscape:text-[28vh] sm:text-[16rem] md:text-[20rem] lg:text-[26rem] xl:text-[32rem] md:landscape:text-[28vh] lg:landscape:text-[34vh] xl:landscape:text-[38vh] font-black leading-none text-white tracking-tighter font-mono filter drop-shadow-[0_10px_40px_rgba(0,0,0,0.7)] select-none tabular-nums active:scale-95 transition-all">
              {scoreB}
            </span>

            {/* Sets tracker - Novo posicionamento diretamente abaixo do placar */}
            <div 
              onClick={(e) => e.stopPropagation()} // Evita adicionar ponto ao clicar nas bolinhas de set
              className="mt-1 mb-2 xs:mt-2 xs:mb-3 flex items-center gap-2 bg-black/60 px-2.5 py-1 xs:px-3 xs:py-1.5 rounded-full border border-white/5 backdrop-blur-sm shadow-lg pointer-events-auto hover:bg-black/75 transition-colors"
            >
              <span className="text-[8px] xs:text-[9px] uppercase font-black tracking-widest text-slate-400">Sets</span>
              <div className="flex flex-row gap-1">
                {Array.from({ length: settings.max_sets }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // Evita adicionar ponto
                      setSetsB(i < setsB ? i : i + 1);
                    }}
                    className={cn(
                      "w-3 h-3 xs:w-3.5 xs:h-3.5 rounded-full border-2 transition-all duration-300",
                      i < setsB 
                        ? "bg-white border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.7)]" 
                        : "border-white/20 hover:border-white/40"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Float Subtract button */}
            <button
              onClick={(e) => subtractPoint('B', e)}
              className="mt-1 px-3 py-1 bg-slate-900/95 border border-white/10 hover:border-red-500/30 hover:bg-slate-800 text-slate-400 hover:text-red-400 text-[10px] xs:text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-1 opacity-85 hover:opacity-100 backdrop-blur-sm pointer-events-auto"
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

      {/* 5. FINISH SET/MATCH POPUP MODAL */}
      <AnimatePresence>
        {isSetEnded && setWinner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center space-y-6 relative overflow-hidden"
            >
              {/* Subtle background glow effect */}
              <div 
                className="absolute -top-24 -left-24 w-48 h-48 rounded-full opacity-[0.15] blur-3xl pointer-events-none"
                style={{ backgroundColor: setWinner === 'A' ? settings.team_a_color : settings.team_b_color }}
              />
              <div 
                className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full opacity-[0.15] blur-3xl pointer-events-none"
                style={{ backgroundColor: setWinner === 'A' ? settings.team_a_color : settings.team_b_color }}
              />

              {/* Icon / Crown */}
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg border border-white/10"
                style={{ 
                  backgroundColor: `${setWinner === 'A' ? settings.team_a_color : settings.team_b_color}22`,
                  color: setWinner === 'A' ? settings.team_a_color : settings.team_b_color
                }}
              >
                🏆
              </div>

              {/* Title and Wording */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-orange-500 bg-orange-500/10 px-3 py-1 rounded-full">
                  {isMatchEnded ? 'Partida Encerrada' : `Set ${setsA + setsB + 1} Finalizado`}
                </span>
                
                <h2 className="text-3xl font-black text-white tracking-tight">
                  {isMatchEnded 
                    ? `fim do jogo vitória da equipe "${setWinner === 'A' ? settings.team_a_name : settings.team_b_name}"`
                    : `fim do set vitória da equipe "${setWinner === 'A' ? settings.team_a_name : settings.team_b_name}"`
                  }
                </h2>
                
                <p className="text-sm text-slate-400">
                  {isMatchEnded 
                    ? `O jogo chegou ao fim. Vitória de ${setWinner === 'A' ? settings.team_a_name : settings.team_b_name} por ${setWinner === 'A' ? (setsA + 1) : setsA} a ${setWinner === 'B' ? (setsB + 1) : setsB} nos sets!`
                    : `Placar final do set: ${scoreA} a ${scoreB}.`
                  }
                </p>
              </div>

              {/* Real-time score summary */}
              <div className="bg-slate-950/50 border border-white/5 rounded-2xl p-4 w-full flex justify-around items-center gap-4">
                <div className="text-center">
                  <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: settings.team_a_color }}>{settings.team_a_name}</div>
                  <div className="text-2xl font-black text-white font-mono">{scoreA}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{setsA} {setsA === 1 ? 'set' : 'sets'} vencidos</div>
                </div>
                <div className="text-slate-600 font-bold text-sm">X</div>
                <div className="text-center">
                  <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: settings.team_b_color }}>{settings.team_b_name}</div>
                  <div className="text-2xl font-black text-white font-mono">{scoreB}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{setsB} {setsB === 1 ? 'set' : 'sets'} vencidos</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full flex flex-col gap-3 pt-2">
                {isMatchEnded ? (
                  <>
                    <button
                      type="button"
                      onClick={handleFinalizeMatchFromModal}
                      disabled={isSaving}
                      className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                      <span>Salvar Partida no Histórico</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={resetGame}
                      className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-200 font-bold rounded-2xl border border-white/10 transition-all active:scale-95 cursor-pointer"
                    >
                      Zerar e Iniciar Novo Jogo
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={advanceSet}
                    className="w-full py-4 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/10 transition-all active:scale-95 cursor-pointer"
                  >
                    Confirmar e Ir para o Próximo Set
                  </button>
                )}

                <button
                  type="button"
                  onClick={undoPoint}
                  className="w-full py-2.5 bg-transparent hover:bg-white/5 text-slate-400 hover:text-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Undo2 size={14} />
                  <span>Desfazer Último Ponto (Corrigir Erro)</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
