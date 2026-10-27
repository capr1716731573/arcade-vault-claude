import { Injectable, inject } from '@angular/core';
import { ScoreRow } from '../data/scores.data';
import { SupabaseService } from './supabase.service';
export type { ScoreRow } from '../data/scores.data';
/** Entrada a guardar en el leaderboard. */
export interface SavedScore {
  game: string;
  score: number;
  name: string;
}
/** Resultado de un guardado: ok, o ko con el mensaje de error. */
export interface SaveResult {
  ok: boolean;
  error?: string;
}
/** Puntuación de un usuario con su perfil unido (vista `scores_con_perfil`, SPEC 15). */
export interface ScoreConPerfil {
  game: string;
  name: string;
  score: number;
  date: string;
  username: string | null;
  provider: string | null;
}
/**
 * Leaderboard real sobre la tabla `scores` de Supabase. Lee/escribe siempre a
 * través del `SupabaseService` (ningún componente consulta Supabase directamente).
 * Supabase es la única fuente: no hay respaldo en `localStorage`.
 */
@Injectable({ providedIn: 'root' })
export class ScoresService {
  private readonly supabase = inject(SupabaseService);
  /** Mejores `count` marcas de un juego (para la ficha del juego). */
  top(gameId: string, count = 10): Promise<ScoreRow[]> {
    return this.query(gameId, count);
  }
  /** Mejores `count` marcas de un juego (para el Salón de la Fama). */
  hallOfFame(gameId: string, count = 12): Promise<ScoreRow[]> {
    return this.query(gameId, count);
  }
  /**
   * Puntuaciones de un usuario con su perfil unido (SPEC 15), leídas de la
   * vista `scores_con_perfil` filtrando por `user_id` y ordenadas por score.
   */
  async porUsuario(userId: string): Promise<ScoreConPerfil[]> {
    const { data, error } = await this.supabase.client
      .from('scores_con_perfil')
      .select('game_id, name, score, created_at, perfil_username, perfil_provider')
      .eq('user_id', userId)
      .order('score', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      game: r.game_id ?? '',
      name: r.name ?? '',
      score: r.score ?? 0,
      date: r.created_at ? this.formatDate(r.created_at) : '',
      username: r.perfil_username,
      provider: r.perfil_provider,
    }));
  }
  /** Inserta una marca. Devuelve {ok:false, error} si Supabase rechaza. */
  async save(entry: SavedScore): Promise<SaveResult> {
    const { error } = await this.supabase.client.from('scores').insert({
      game_id: entry.game,
      name: entry.name,
      score: entry.score,
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  private async query(gameId: string, count: number): Promise<ScoreRow[]> {
    const { data, error } = await this.supabase.client
      .from('scores')
      .select('name, score, created_at')
      .eq('game_id', gameId)
      .order('score', { ascending: false })
      .limit(count);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r, i) => ({
      rank: i + 1,
      name: r.name,
      score: r.score,
      date: this.formatDate(r.created_at),
    }));
  }
  private formatDate(iso: string): string {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }
}
