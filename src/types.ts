export interface Player {
  id: string;
  name: string;
  active: boolean;
  is_temporary?: boolean;
}

export interface Match {
  id: string;
  team_a_score: number;
  team_b_score: number;
  sets_a: number;
  sets_b: number;
  created_at: string;
}

export interface Settings {
  id?: string;
  points_per_set: number;
  max_sets: number;
  team_a_color: string;
  team_b_color: string;
  team_a_name: string;
  team_b_name: string;
  enable_sounds: boolean;
  enable_voice: boolean;
}

export interface Draw {
  id: string;
  teams: string[][];
  created_at: string;
}

export type View = 'scoreboard' | 'players' | 'shuffler' | 'history' | 'settings';
