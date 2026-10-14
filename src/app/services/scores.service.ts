import { Injectable } from '@angular/core';
import { ScoreRow, seededScores } from '../data/scores.data';

export type { ScoreRow } from '../data/scores.data';

export interface SavedScore {
  game: string;
  score: number;
  name: string;
  at: number;
}

const KEY = 'av_scores';

@Injectable({ providedIn: 'root' })
export class ScoresService {
  private memory: SavedScore[] = [];

  top(gameId: string, count = 10): ScoreRow[] {
    return seededScores(gameId.length * 17 + 3, count);
  }

  hallOfFame(gameId: string, count = 12): ScoreRow[] {
    return seededScores(gameId.length * 23 + 7, count);
  }

  save(entry: Omit<SavedScore, 'at'>): void {
    const saved: SavedScore = { ...entry, at: Date.now() };
    try {
      const all = JSON.parse(localStorage.getItem(KEY) || '[]');
      const list: SavedScore[] = Array.isArray(all) ? all : [];
      list.push(saved);
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      this.memory.push(saved);
    }
  }
}
