import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SupabaseService } from '../services/supabase.service';
/** Fila de la tabla `games` tal como la devuelve Supabase. */
export interface GameRow {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: string;
  best: number;
  plays: string;
  playable: boolean;
  position: number;
}
const g = (
  id: string,
  title: string,
  cat: string,
  color: string,
  position: number,
  playable = false,
): GameRow => ({
  id,
  title,
  short: `corta ${id}`,
  long: `larga ${id}`,
  cat,
  cover: `cover-${id}`,
  color,
  best: position * 1000,
  plays: '1K',
  playable,
  position,
});
/** Catálogo real (SPEC 09): solo juegos implementados, misma forma/orden que la siembra. */
export const GAMES_FIXTURE: GameRow[] = [
  g('asteroides', 'ASTEROIDES', 'SHOOTER', 'cyan', 0, true),
  g('bloque-buster', 'BLOQUE BUSTER', 'ARCADE', 'cyan', 1, true),
  g('caida', 'CAÍDA', 'PUZZLE', 'magenta', 2, true),
  g('snake', 'SNAKE', 'ARCADE', 'green', 3, true),
  g('frogger', 'FROGGER', 'ARCADE', 'green', 4, true),
];
export interface ScoreDbRow {
  name: string;
  score: number;
  created_at: string;
}
export const scoreRow = (name: string, score: number, iso = '2026-10-16T10:00:00Z'): ScoreDbRow => ({
  name,
  score,
  created_at: iso,
});
export interface MockData {
  games?: GameRow[];
  scores?: ScoreDbRow[];
  gamesError?: { message: string } | null;
  scoresError?: { message: string } | null;
  insertError?: { message: string } | null;
  /** Recolecta las filas insertadas por `save()`. */
  inserted?: Array<Record<string, unknown>>;
}
/**
 * Provider de `SupabaseService` falso. Su `client.from(table)` devuelve un
 * builder encadenable (`select/eq/order/limit`) que es "thenable": `await` del
 * builder resuelve `{ data, error }`. `insert()` registra la fila y resuelve
 * `{ error }`.
 */
export function provideSupabaseMock(data: MockData = {}) {
  const resultFor = (table: string) =>
    table === 'games'
      ? { data: data.games ?? [], error: data.gamesError ?? null }
      : { data: data.scores ?? [], error: data.scoresError ?? null };
  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(resultFor(table)).then(resolve, reject),
        insert: (row: Record<string, unknown>) => {
          data.inserted?.push(row);
          return Promise.resolve({ error: data.insertError ?? null });
        },
      };
      return builder;
    },
  };
  return { provide: SupabaseService, useValue: { client } };
}
/** Arranca los efectos/resources pendientes y espera a que la app se estabilice. */
export async function settle(): Promise<void> {
  (TestBed as unknown as { tick?: () => void }).tick?.();
  await TestBed.inject(ApplicationRef).whenStable();
}
