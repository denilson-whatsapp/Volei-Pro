import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Player } from '../types';
import { UserPlus, Trash2, UserCheck, UserMinus, Search, Camera, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { dbUploadPlayerPhoto } from '../lib/supabase';

interface PlayersPageProps {
  players: Player[];
  onAdd: (name: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdatePhoto: (id: string, url: string) => void;
}

export const PlayersPage: React.FC<PlayersPageProps> = ({ players, onAdd, onToggle, onDelete, onUpdatePhoto }) => {
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const handlePhotoUpload = async (playerId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(playerId);
    try {
      const url = await dbUploadPlayerPhoto(playerId, file);
      if (url) {
        onUpdatePhoto(playerId, url);
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
    } finally {
      setUploadingId(null);
    }
  };

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onAdd(newName.trim());
    setNewName('');
  };

  return (
    <div className="h-full overflow-y-auto p-6 pt-20 md:pt-6 max-w-4xl mx-auto">
      <header className="mb-10 text-center flex flex-col items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-white mb-3 tracking-tight">Jogadores</h1>
          <p className="text-slate-400 max-w-md mx-auto">Gerencie a lista fixa de atletas para o sorteio inteligente.</p>
        </div>
        
        <form onSubmit={handleAdd} className="flex gap-2 w-full max-w-md">
          <input 
            type="text"
            placeholder="Nome do jogador..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1 md:w-64 bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-orange-500 outline-none"
          />
          <button 
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white p-3 rounded-xl shadow-lg shadow-orange-500/20 transition-colors"
          >
            <UserPlus size={24} />
          </button>
        </form>
      </header>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
        <input 
          type="text"
          placeholder="Buscar jogador..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-900/50 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:ring-2 focus:ring-orange-500 outline-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredPlayers.map((player) => (
            <motion.div
              layout
              key={player.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "group relative p-4 rounded-2xl border transition-all duration-300",
                player.active 
                  ? "bg-slate-900 border-white/10" 
                  : "bg-slate-900/30 border-white/5 opacity-60"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative group/photo">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center font-bold text-lg border-2 transition-all",
                      player.active ? "bg-orange-500/10 border-orange-500/30 text-orange-500" : "bg-slate-800 border-slate-700 text-slate-500"
                    )}>
                      {player.photo_url ? (
                        <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        player.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    
                    <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover/photo:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                      {uploadingId === player.id ? (
                        <Loader2 size={16} className="text-white animate-spin" />
                      ) : (
                        <Camera size={16} className="text-white" />
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handlePhotoUpload(player.id, e)}
                        disabled={uploadingId === player.id}
                      />
                    </label>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white truncate max-w-[120px]">
                      {player.name}
                    </span>
                    <span className="text-[10px] uppercase font-black tracking-tighter text-slate-500">
                      {player.wins || 0}V • {player.games_played || 0}J
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => onToggle(player.id)}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      player.active ? "text-green-500 hover:bg-green-500/10" : "text-slate-500 hover:bg-slate-500/10"
                    )}
                    title={player.active ? "Desativar" : "Ativar"}
                  >
                    {player.active ? <UserCheck size={20} /> : <UserMinus size={20} />}
                  </button>
                  <button 
                    onClick={() => onDelete(player.id)}
                    className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredPlayers.length === 0 && (
        <div className="text-center py-20">
          <p className="text-slate-500">Nenhum jogador encontrado.</p>
        </div>
      )}
    </div>
  );
};
