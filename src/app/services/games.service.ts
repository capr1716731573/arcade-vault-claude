import { Injectable, computed, inject, resource } from '@angular/core';
import { CATS, Game, GameColor } from '../data/games.data';
import { SupabaseService } from './supabase.service';
export type { Game, GameColor } from '../data/games.data';
/**
 * Catálogo de juegos leído desde la tabla `games` de Supabase (fuente de verdad).
 * Carga el catálogo una vez con un `resource` y lo expone como señales
 * (`games`/`loading`/`error`). `all()`/`byId()` leen la señal, así que son
 * reactivos cuando se usan dentro de un `computed` o plantilla.
 *
 * Las categorías del filtro (`CATS`) siguen en código: no son datos de BD.
 */
@Injectable({ providedIn: 'root' })
export class GamesService {
  private readonly supabase = inject(SupabaseService);
  readonly categories = CATS;
  private readonly gamesResource = resource({
    loader: async (): Promise<Game[]> => {
      const { data, error } = await this.supabase.client
        .from('games')
        .select('*')
        .order('position', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        short: r.short,
        long: r.long,
        cat: r.cat,
        cover: r.cover,
        color: r.color as GameColor,
        best: r.best,
        plays: r.plays,
        playable: r.playable,
      }));
    },
  });
  /** Lista de juegos (vacía mientras carga o si hay error). */
  readonly games = computed<Game[]>(() =>
    this.gamesResource.hasValue() ? this.gamesResource.value() : [],
  );
  /** true mientras la consulta está en curso. */
  readonly loading = this.gamesResource.isLoading;
  /** Error de la última carga, o undefined. */
  readonly error = this.gamesResource.error;
  all(): Game[] {
    return this.games();
  }
  byId(id: string): Game | undefined {
    return this.games().find((g) => g.id === id);
  }
  /** Reintenta la carga del catálogo (para el estado de error de la UI). */
  reload(): void {
    this.gamesResource.reload();
  }
}
