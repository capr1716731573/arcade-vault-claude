# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Arcade Vault" is an **Angular** application (Angular 22, standalone components, signals, `@angular/build`). All new code must be idiomatic Angular: standalone components with `templateUrl`, `input()`/`output()`/`viewChild()` signal APIs, `@for`/`@if` control flow, `computed()` for derived state, and routes in `src/app/app.routes.ts`. Do not introduce React, Next.js, or other frameworks.

`resources/resources/templates/` holds a throwaway React prototype (the design/behavior reference) and is **only a source to port from** — never extend it or import from it. Ignore `resources/__MACOSX` (zip junk). Its `styles.css` is already ported to `src/styles.css` and is the global theme.

## Commands

- `npm start` — dev server (`ng serve`)
- `npm run build` — production build
- `npm run watch` — dev build in watch mode
- `npm test` — unit tests via `ng test` (Vitest + jsdom, not Karma/Jasmine). Single file: `npx ng test --include=src/app/library/library.spec.ts`; one-shot run: `npx ng test --watch=false`
- Formatting: Prettier (`printWidth` 100, single quotes, Angular parser for `.html`)

## Skills

Usa siempre frontend-design junto con ui-ux-pro-max para realizar la interfaz de usuario, ponganse de acuerdo para que no se genere conflicto entre las dos

## Angular app architecture (`src/app`)

- `app.config.ts` — `provideRouter(routes)`; `app.html` renders the neon background layers (`av-bg`, `av-noise`) plus `<router-outlet />`.
- `games/games.data.ts` — `Game` model, `GameColor`, and `CATS`. The catalog itself now lives in the Supabase `games` table (SPEC 06): `GamesService` reads it **async** via a `resource()` (signal `games()` + `loading`/`error`, `byId()` resolves over the loaded list), ordered by `position`; `CATS` stays in code. `Game.playable` marks real games (only `asteroides`, listed first); the rest show a "PRÓXIMAMENTE" badge (`.soon-badge`, visual only — non-blocking) and still open the simulated `GamePlayer`. The old static `GAMES` array is retired from runtime — its 9 rows were seeded into the table by the SPEC 06 migration.
- `games/asteroids/` — first **real** game (SPEC 05), route `jugar/asteroides` (declared **before** `jugar/:id`). `asteroids-engine.ts` is a framework-agnostic TS port of `references/started-games/02-asteroids/game.js` (classes `Bullet`/`Asteroid`/`Ship`/`Particle`/`PowerUp`, RAF loop, responsive `W`/`H` read from the canvas, keyboard + `setInput` touch, `onState` callback, `pause`/`resume`/`restart`/`destroy`); it keeps the on-canvas HUD + `GAME OVER` overlay + SPACE-restart. `Asteroids` (standalone component) hosts the `<canvas>`, creates the engine only in the browser (`afterNextRender`) **outside the Angular zone** and destroys it in `ngOnDestroy`, mirrors `onState` into signals for the neon DOM HUD (both HUDs coexist), adds pause (P/Esc + button), on-screen touch controls, and a separate "GUARDAR PUNTUACIÓN" button that saves to the Salón via `ScoresService` (now the Supabase `scores` table, SPEC 06 — async insert with "GUARDANDO…"/error+retry states, no double-save) on gameover. The other 8 games keep the simulated `GamePlayer` (its own save button also writes to `scores`).
- `library/` — ported library screen (`Library` with `query`/`cat` signals and a `computed` filtered list over the async catalog, with loading/error states + retry) and `game-card/` (`GameCard` with 3D tilt on hover; emits `selected`). Route `''`.
- `home/` — landing screen (`Home` with 6 sections: hero, features, games preview, stats, activity, pricing+FAQ+CTA). Route `juego` (exact, before `juego/:id`). Sub-components: `FloatingSilhouettes`, `FeatureIcon`, `MiniCard`; directive `Reveal` (IntersectionObserver, threshold 0.12). Data served by `HomeService` from `data/home.data.ts`.
- `src/styles.css` — single global stylesheet, CSS variables (`--cyan`, `--magenta`, `--mono`, …), `av-` prefix for layout classes, CSS-only cover art (`.cover-*`). Components do not use encapsulated styles; reuse these classes. Fonts (Press Start 2P, JetBrains Mono) load from Google Fonts in `src/index.html`.
- `services/supabase.service.ts` — central Supabase client (SPEC 04): **direct-client + RLS** via `createClient` with the **publishable** key, `providedIn: 'root'`, SSR-safe (`persistSession:false`, `autoRefreshToken:false`, `detectSessionInUrl:false` — no `window`/`localStorage`). Every consumer goes through this service; no component builds its own client. Config comes from `src/environments/environment.ts`, which is **generated** and gitignored: `scripts/generate-environment.mjs` reads **only** `SUPABASE_URL` + `SUPABASE_KEY` from `.env-template` and runs via the `postinstall`/`prestart`/`prebuild`/`prewatch` npm hooks (so a fresh clone/CI always has the file). Server-only secrets (`SUPABASE_SECRET_KEY` — reserved, unused; `SUPABASE_DB_PASSWORD`; `API_KEY_RESEND`) never reach the generator or the bundle. The client is **typed** with `Database` from `src/app/database.types.ts` (generated from the live schema). Auth and realtime remain future specs.
- Supabase data layer (SPEC 06): two tables with RLS — `games` (catalog, public read, seeded with the 9 games) and `scores` (leaderboard, public read + **anonymous** insert with `CHECK`, no update/delete). Migrations were applied via the Supabase MCP (not versioned in the repo). `GamesService` (catalog) and `ScoresService` (`top()`/`hallOfFame()` query `scores`; `save()` inserts, returns `{ ok, error? }`) are the only consumers — both go through `SupabaseService`, no component queries Supabase directly. `best`/`plays` are static seeded columns (not derived from scores). `src/app/data/scores.data.ts` keeps only the `ScoreRow` type (`seededScores`/`PLAYERS` retired). Test helper: `src/app/testing/supabase-mock.ts`.
- UI text is in Spanish.

## Port status (prototype → Angular)

Done: library screen, home screen (`home.jsx` → `home/`), about + contact screen (`about.jsx` → `about/`), navbar "Inicio" and "Acerca de" links. All prototype screens under `resources/resources/templates/` are now ported; nothing pending.

SPEC 03 introduced an Angular SSR server (`src/server.ts`, via `ng add @angular/ssr`) so the About contact form can send a real email through Resend: `POST /api/contacto`, with the pure logic in `src/app/contact/send-contact-email.ts` and the client façade `ContactService` (`src/app/services/contact.service.ts`). The Resend API key lives only in `.env-template` (gitignored) and is read from `process.env.API_KEY_RESEND` on the server — never in the client bundle. Pages still render client-side (`src/app/app.routes.server.ts` uses `RenderMode.Client`), and `angular.json` sets `security.allowedHosts: ["*"]` so the built server serves any host.

SPEC 05 ported the first real game, **Asteroides** (`games/asteroids/`), as a new `asteroides` catalog entry (`playable: true`) playable at `jugar/asteroides` through a framework-agnostic engine driven by a dedicated standalone component (see the `games/asteroids/` bullet above). The other games stay on the simulated `GamePlayer` and now show a non-blocking "PRÓXIMAMENTE" badge (`Game.playable`).

SPEC 06 moved the catalog and the leaderboard to Supabase: tables `games` + `scores` with RLS, the client typed via `database.types.ts`, `GamesService`/`ScoresService` now read/write Supabase async (see the Supabase data layer bullet above), and the Salón (`HallOfFame`) shows real scores with a "sin puntuaciones aún" empty state (the simulated "TÚ" row was removed). `scores` starts empty. Auth is still `SessionService` + `localStorage` (`av_user`); deriving `best`/`plays` from scores, realtime, and versioned SQL migrations remain future specs.

Prototype behavior to preserve when porting: routes were `{name, id?}` in the URL hash (`biblioteca` | `detalle` | `player` | `auth` | `salon`) → map to Angular routes. The logged-in user still persists in `localStorage` (`av_user`); scores now live in the Supabase `scores` table (the old `av_scores` localStorage key is retired).
