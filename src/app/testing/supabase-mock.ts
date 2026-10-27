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
/** Fila de la vista `scores_con_perfil` (score + perfil unido), SPEC 15. */
export interface ScorePerfilDbRow {
  game_id: string;
  name: string;
  score: number;
  created_at: string;
  perfil_username: string | null;
  perfil_provider: string | null;
}
export const scorePerfilRow = (
  game_id: string,
  name: string,
  score: number,
  perfil_username: string | null = null,
  perfil_provider: string | null = null,
  iso = '2026-10-16T10:00:00Z',
): ScorePerfilDbRow => ({
  game_id,
  name,
  score,
  created_at: iso,
  perfil_username,
  perfil_provider,
});
/** Usuario mínimo de Supabase Auth para los mocks (SPEC 14). */
export interface AuthUserRow {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: { provider?: string };
}
export interface MockData {
  games?: GameRow[];
  scores?: ScoreDbRow[];
  /** Filas que devuelve la vista `scores_con_perfil` (SPEC 15). */
  scoresConPerfil?: ScorePerfilDbRow[];
  gamesError?: { message: string } | null;
  scoresError?: { message: string } | null;
  scoresConPerfilError?: { message: string } | null;
  insertError?: { message: string } | null;
  /** Recolecta las filas insertadas por `save()`. */
  inserted?: Array<Record<string, unknown>>;
  /** Usuario de sesión que devuelven `auth.getSession()`/`onAuthStateChange`. */
  authUser?: AuthUserRow | null;
}
/**
 * Provider de `SupabaseService` falso. Su `client.from(table)` devuelve un
 * builder encadenable (`select/eq/order/limit`) que es "thenable": `await` del
 * builder resuelve `{ data, error }`. `insert()` registra la fila y resuelve
 * `{ error }`.
 */
export function provideSupabaseMock(data: MockData = {}) {
  const resultFor = (table: string) => {
    if (table === 'games') return { data: data.games ?? [], error: data.gamesError ?? null };
    if (table === 'scores_con_perfil')
      return { data: data.scoresConPerfil ?? [], error: data.scoresConPerfilError ?? null };
    return { data: data.scores ?? [], error: data.scoresError ?? null };
  };
  const session = data.authUser ? { user: data.authUser } : null;
  const client = {
    auth: {
      getSession: () => Promise.resolve({ data: { session }, error: null }),
      onAuthStateChange: (cb: (event: string, s: unknown) => void) => {
        cb('INITIAL_SESSION', session);
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signUp: () =>
        Promise.resolve({ data: { user: data.authUser ?? null, session: null }, error: null }),
      resend: () => Promise.resolve({ data: {}, error: null }),
      signInWithPassword: () =>
        Promise.resolve({ data: { session, user: data.authUser ?? null }, error: null }),
      signInWithOAuth: () =>
        Promise.resolve({ data: { provider: 'google', url: 'https://example.test' }, error: null }),
      resetPasswordForEmail: () => Promise.resolve({ data: {}, error: null }),
      updateUser: () => Promise.resolve({ data: { user: data.authUser ?? null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
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
