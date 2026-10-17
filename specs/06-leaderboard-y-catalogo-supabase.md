# SPEC 06 — Leaderboard y catálogo de juegos en Supabase

> **Estado:** Implementado
> **Depende de:** SPEC 04 (`SupabaseService` cliente-directo + RLS, generador de `environment` desde `.env-template`, clave publishable), SPEC 01 (`GamesService`, `ScoresService`, `HallOfFame`, `Library`/`GameCard`, `GameDetail`, `Home`, `SessionService`, modelo `Game`, `ScoreRow`), SPEC 05 (Asteroides guarda vía `ScoresService`, campo `playable`)
> **Fecha:** 2026-10-16
> **Objetivo:** Mover el catálogo de juegos y las puntuaciones a Supabase (tablas `games` y `scores` con RLS), de modo que `GamesService` lea el catálogo desde la BD y el Salón de la Fama muestre puntuaciones reales insertadas desde el navegador.

---

## Por qué existe este spec

SPEC 04 dejó el `SupabaseService` listo (cliente publishable + RLS, SSR-safe, **sin tipar**) y difirió explícitamente a "el spec de la primera tabla" tres cosas: la tabla `scores`, las políticas RLS y el tipado del cliente (`database.types.ts` + `createClient<Database>`). Este es ese spec. Hoy el catálogo es la constante estática `GAMES` y el Salón muestra puntuaciones **falsas** (`seededScores`): `ScoresService.save()` escribe en `localStorage` pero nadie lo lee de vuelta. Este spec convierte ambos en datos reales de Supabase.

## Alcance

**Dentro:**

- **Tabla `games`** en Supabase (esquema `public`): catálogo, **una fila por juego**, sembrada con los 9 juegos actuales (incluidos orden, `best`, `plays`, `playable`). Es la **fuente de verdad** del catálogo.
- **Tabla `scores`** en Supabase: **una tabla única** con columna `game_id` (no una tabla por juego); **arranca vacía**.
- **RLS en ambas tablas.** `games`: lectura pública, sin escritura desde el cliente. `scores`: lectura pública + **inserción anónima pública** (sin auth, clave publishable), **sin** `UPDATE`/`DELETE`, con `CHECK` de validación (`score >= 0`, longitud de `name`).
- **Tipado del cliente.** Generar `src/app/database.types.ts` y tipar `SupabaseService.client` con `createClient<Database>`. Los servicios usan `.from('games')`/`.from('scores')` tipados.
- **`GamesService` async:** lee el catálogo desde `games` (señal con estados carga/error) en vez de la constante `GAMES`. `byId` resuelve sobre la lista cargada. `CATS` (filtro de categorías) sigue en código.
- **Consumidores del catálogo adaptados a datos async:** `Library` (+ `GameCard`), `GameDetail`, `Home` (preview de juegos) y `HallOfFame` (pestañas por juego) manejan estados de carga, vacío y error; se conserva el filtro por categoría/búsqueda.
- **`ScoresService` async (leaderboard real):** `top()`/`hallOfFame()` consultan `scores` por `game_id` ordenado por `score` descendente y mapean a `ScoreRow` (con `rank` y fecha `dd/mm/yyyy`); `save()` hace `insert` en `scores` y reporta éxito/error.
- **`HallOfFame` con datos reales:** filas reales por pestaña, estado **"sin puntuaciones aún"** cuando el juego no tiene marcas; se retira la fila **"TÚ"** simulada.
- **Guardado real en Asteroides:** el botón "GUARDAR PUNTUACIÓN" inserta en `scores` (async); en éxito muestra "▸ PUNTUACIÓN GUARDADA" (sin doble guardado), en fallo muestra aviso y permite reintentar.
- **Retiro de datos falsos:** se eliminan `seededScores` y `PLAYERS` (`src/app/data/scores.data.ts` conserva solo el tipo `ScoreRow`; se retira `src/app/data/players.data.ts`), y la escritura a `localStorage` (`av_scores`) del flujo de guardado.
- **Migraciones aplicadas por MCP de Supabase** (proyecto remoto): esquema + RLS + siembra de `games`.
- Tests Vitest actualizados (mockeando `SupabaseService`) de `games.service`, `scores.service`, `hall-of-fame`, `library`, `game-detail`, `home`, `asteroids`.

**Fuera de alcance (para futuros specs):**

- **Autenticación.** La inserción es **anónima** (clave publishable + RLS). No se liga `scores` a un usuario ni se activa persistencia de sesión; `SessionService` + `localStorage` (`av_user`) siguen igual.
- **Derivar `best`/`plays` de las puntuaciones reales:** siguen siendo **columnas estáticas** sembradas con los valores actuales. Calcular récord/partidas desde `scores` es otro spec.
- **Migraciones versionadas en el repo** (`supabase/migrations/*.sql`): en este spec se aplican **solo por MCP** al proyecto remoto.
- **Realtime** (Salón que se actualiza en vivo), **edge functions**, **paginación** del Salón, anti-spam / rate limiting de inserciones.
- Escribir en `games`/`scores` desde un backend con el `SUPABASE_SECRET_KEY` (reservado en SPEC 04, sigue sin usarse).
- Convertir en reales los otros 8 juegos simulados, o migrar el `GamePlayer` simulado.
- Fallback offline a `localStorage` para puntuaciones (se descartó: Supabase es la única fuente).
- Internacionalización (la UI sigue solo en español).

## Modelo de datos

Introduce **dos tablas** en Supabase (`public`) y el **tipado** del cliente. `src/app/data/games.data.ts` conserva el tipo `Game`, `GameColor` y la constante `CATS`; el array `GAMES` deja de usarse en runtime y sus valores se portan a la siembra de la tabla. `src/app/data/scores.data.ts` conserva solo el tipo `ScoreRow`.

**Tabla `games`** (fuente de verdad del catálogo):

```sql
create table public.games (
  id        text primary key,        -- 'asteroides', 'bloque-buster', ...
  title     text    not null,
  short     text    not null,
  long      text    not null,
  cat       text    not null,        -- 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS'
  cover     text    not null,        -- clase CSS: 'cover-asteroides', ...
  color     text    not null,        -- 'cyan' | 'magenta' | 'yellow' | 'green'
  best      integer not null default 0,
  plays     text    not null default '—',
  playable  boolean not null default false,
  position  integer not null default 0   -- preserva el orden actual (asteroides primero)
);
```

**Tabla `scores`** (leaderboard, arranca vacía):

```sql
create table public.scores (
  id         uuid        primary key default gen_random_uuid(),
  game_id    text        not null references public.games(id),
  name       text        not null check (char_length(name) between 1 and 12),
  score      integer     not null check (score >= 0),
  created_at timestamptz not null default now()
);
create index scores_game_score_idx on public.scores (game_id, score desc);
```

**RLS** (ambas con `enable row level security`):

```sql
-- games: lectura pública; sin escritura desde el cliente (la siembra la hace la migración)
create policy games_select_public on public.games for select using (true);

-- scores: lectura pública + inserción anónima; sin update/delete
create policy scores_select_public on public.scores for select using (true);
create policy scores_insert_public on public.scores for insert
  with check (score >= 0 and char_length(name) between 1 and 12);
```

**Contrato que consumen los servicios** (sin cambios de forma para la UI):

```ts
// src/app/data/scores.data.ts  (se conserva solo este tipo)
export interface ScoreRow {
  rank: number;     // calculado en el cliente tras ordenar por score desc
  name: string;
  score: number;
  date: string;     // created_at formateado dd/mm/yyyy
}
```

Convenciones: ningún componente crea su propio cliente ni consulta Supabase directamente — todo pasa por `GamesService`/`ScoresService`, que a su vez usan `SupabaseService` (patrón de servicios fachada de SPEC 01/04). La inserción se hace con rol `anon` (clave publishable); `name` se normaliza a mayúsculas y se acota a ≤ 12 caracteres (por defecto `SessionService.user()?.name ?? 'INVITADO'`). Las lecturas async usan señales de Angular 22 (`resource()`/`rxResource`) con estados `loading`/`error`; la app renderiza bajo `RenderMode.Client` (SPEC 03), así que las consultas ocurren en navegador y el `SupabaseService` sigue SSR-safe.

## Plan de implementación

1. **Esquema + RLS + siembra (MCP).** Vía `apply_migration` crear `public.games` y `public.scores` con sus `CHECK`, el índice y las políticas RLS de arriba; sembrar `games` con los 9 juegos actuales (valores de `GAMES`: orden en `position`, `best`/`plays`/`playable` tal cual). `scores` queda vacía. Prueba (MCP/`execute_sql` con contexto anónimo): `select` a `games` devuelve 9 filas ordenadas; `insert` anónimo válido en `scores` entra; `insert` con `score < 0` o `name` vacío lo rechaza el `CHECK`; `update`/`delete` anónimos denegados por RLS. La app sigue intacta (aún usa la constante).
2. **Tipado del cliente.** Generar `src/app/database.types.ts` (MCP `generate_typescript_types`) y tipar `SupabaseService.client` con `createClient<Database>`. Prueba: `npm run build` compila; `.from('games')` autocompleta columnas.
3. **`GamesService` async.** Reescribirlo para leer `games` desde Supabase ordenado por `position`, exponiendo la lista como señal con estados `loading`/`error` y `byId` sobre la lista cargada; `categories = CATS` sigue en código. Prueba: un consumidor muestra los 9 juegos leídos de la BD.
4. **Consumidores del catálogo.** Adaptar `Library` (+ `GameCard`), `GameDetail`, `Home` (preview) y `HallOfFame` (pestañas) a la lista async, con estados de carga, vacío y error, conservando filtro por categoría/búsqueda. Prueba: biblioteca, ficha `/juego/:id`, home y salón renderizan juegos desde la BD.
5. **`ScoresService` async.** Reescribir `top()`/`hallOfFame()` para consultar `scores` por `game_id` ordenado por `score desc` (map a `ScoreRow` con `rank` + fecha `dd/mm/yyyy`); `save()` hace `insert` en `scores` y devuelve resultado (éxito/error). Retirar `seededScores`, `PLAYERS`, `src/app/data/players.data.ts` y la escritura a `localStorage`. Prueba: con `scores` vacía, `hallOfFame` devuelve `[]`; tras un `insert` aparece la fila.
6. **`HallOfFame` real.** Filas reales por pestaña; estado "sin puntuaciones aún" cuando el juego no tiene marcas; quitar la fila "TÚ" simulada. Prueba: el Salón muestra vacío por juego hasta que haya marcas reales.
7. **Guardado en Asteroides.** El botón "GUARDAR PUNTUACIÓN" llama a `save()` async; en éxito "▸ PUNTUACIÓN GUARDADA" (sin doble guardado); en error, aviso + reintentar. Prueba: jugar Asteroides, morir, guardar, ver la marca en la pestaña `asteroides` del Salón.
8. **Tests, build y docs.** Actualizar los specs de `games.service`, `scores.service`, `hall-of-fame`, `library`, `game-detail`, `home` y `asteroids` mockeando `SupabaseService`; `npx ng test --watch=false` y `npm run build`. Actualizar CLAUDE.md (tablas `games`/`scores` + RLS, cliente tipado, `GamesService`/`ScoresService` async desde Supabase, Salón real, retiro de `seededScores`/`PLAYERS`/`localStorage`).

Cada paso deja la app compilando y navegable.

## Criterios de aceptación

- [ ] `npm run build` y `npx ng test --watch=false` terminan sin errores.
- [ ] Existen en Supabase las tablas `public.games` y `public.scores` con RLS habilitada; `games` tiene 9 filas sembradas (orden, `best`, `plays`, `playable` como hoy) y `scores` arranca vacía.
- [ ] Con la clave publishable (rol anónimo): `select` a `games` y a `scores` funciona; `insert` en `scores` con datos válidos entra; `insert` con `score < 0` o `name` fuera de 1..12 es rechazado; `update`/`delete` sobre `scores` y cualquier escritura sobre `games` están denegados.
- [ ] `SupabaseService.client` está tipado con `createClient<Database>` (desde `src/app/database.types.ts`); no se usa el secret key en el cliente.
- [ ] `GamesService` lee el catálogo desde la tabla `games` (no de la constante `GAMES`); la biblioteca (`''`), la ficha `/juego/:id`, la preview de la home (`juego`) y el Salón (`salon`) muestran los juegos leídos de la BD.
- [ ] La biblioteca mantiene el filtro por categoría y la búsqueda; durante la carga hay un estado visible y, si la consulta falla, un estado de error (no pantalla en blanco silenciosa).
- [ ] El Salón de la Fama muestra puntuaciones **reales** por juego desde `scores`; un juego sin marcas muestra "sin puntuaciones aún"; ya no aparece la fila "TÚ" simulada ni datos de `seededScores`.
- [ ] En `gameover` de Asteroides, "GUARDAR PUNTUACIÓN" inserta en `scores` (`game_id: 'asteroides'`, score final, iniciales); tras guardar muestra confirmación y no permite doble guardado; si falla, avisa y permite reintentar.
- [ ] Una marca guardada en Asteroides aparece en la pestaña `asteroides` del Salón, ordenada por puntuación.
- [ ] Ya no se escribe en `localStorage` (`av_scores`) al guardar; se han retirado `seededScores`, `PLAYERS` y `src/app/data/players.data.ts`.
- [ ] La app renderiza bajo SSR sin errores (las consultas ocurren en navegador; `SupabaseService` sigue sin tocar `localStorage`/`window` en servidor).
- [ ] Ningún componente consulta Supabase directamente ni crea su propio cliente: todo pasa por `GamesService`/`ScoresService` → `SupabaseService`.
- [ ] No hay errores en la consola del navegador al recorrer biblioteca, ficha, home, Salón, y al jugar/guardar en Asteroides.

## Decisiones tomadas y descartadas

- **Sí:** un **único spec** para las dos tablas. Comparten el mismo patrón (tabla + RLS + servicio async + cliente tipado); separarlas duplicaría la fontanería. **No:** dividir en leaderboard primero y catálogo después.
- **Sí:** **una tabla `games`** (catálogo, una fila por juego) + **una tabla `scores`** única con `game_id`. **No:** una tabla de puntuaciones por juego (`asteroides_scores`, …) — obligaría a `CREATE TABLE` + RLS por cada juego nuevo y a consultas por nombre de tabla dinámico.
- **Sí:** `games` como **fuente de verdad async** que la app realmente lee. **No:** dejar la tabla solo como cimiento con `GamesService` aún sobre la constante — la tabla quedaría decorativa.
- **Sí:** **inserción anónima pública** en `scores` (clave publishable + RLS con `CHECK`), único modelo viable sin auth. **No:** insertar vía edge function con el secret key — añade una función server-side fuera del patrón cliente-directo; el anti-spam se difiere.
- **Sí:** `scores` **arranca vacía**; el Salón muestra "sin puntuaciones aún" por juego. **No:** sembrar puntuaciones falsas en la BD — se prefirió un Salón honesto aunque se vea vacío mientras solo Asteroides sea jugable.
- **Sí:** `best`/`plays` como **columnas estáticas** sembradas con los valores actuales (las tarjetas se ven igual). **No:** derivarlas de `scores` — con la tabla vacía todo saldría en 0/— y añade agregaciones; se difiere.
- **Sí:** **Supabase como única fuente** del guardado; en fallo, error + reintento. **No:** mantener fallback a `localStorage` — evita puntuaciones divergentes entre dispositivo y BD.
- **Sí:** **tipar** el cliente ahora (`database.types.ts` + `createClient<Database>`), como difirió SPEC 04 a la primera tabla. **No:** seguir con el cliente sin tipar.
- **Sí:** migraciones **aplicadas por MCP** al proyecto remoto. **No:** versionar SQL en `supabase/migrations/*.sql` en este spec — se difiere (riesgo anotado abajo).
- **Sí:** señales async de Angular 22 (`resource()`/`rxResource`) con estados carga/error en los consumidores. **No:** bloquear el render hasta tener datos ni usar resolvers de router.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Esquema **no versionado en el repo** (solo MCP): un clon nuevo / CI no reproduce las tablas | Decisión consciente del usuario; se documenta en CLAUDE.md qué tablas/políticas existen; versionar en `supabase/migrations/` queda como spec futuro. |
| Volver async `GamesService` rompe los 4 consumidores síncronos (`Library`, `GameDetail`, `Home`, `HallOfFame`) | Paso 4 adapta cada uno con estados carga/vacío/error; los tests de cada componente se actualizan mockeando `SupabaseService`. |
| **Spam de inserciones** en `scores` (insert anónimo público) | `CHECK` de `score`/`name`; sin `UPDATE`/`DELETE`; rate limiting / anti-spam se declara fuera de alcance y se difiere. |
| Incoherencia visual: tarjeta con `best` sembrado (p. ej. 28450) frente a Salón vacío del mismo juego | Es preexistente (hoy las tarjetas ya traen récords de atrezo); se asume y se documenta; unificar vía `best` derivado es otro spec. |
| Fallo de red / RLS al guardar en Asteroides deja al jugador sin feedback | `save()` async devuelve resultado; la UI muestra aviso y permite reintentar; sin escritura silenciosa a `localStorage`. |
| Consulta a Supabase durante SSR rompe el render | Rutas en `RenderMode.Client`; las consultas corren en navegador; `SupabaseService` sigue `persistSession:false` sin tocar `window`/`localStorage`. |
| `games` vacía o inaccesible deja la app sin catálogo | Estado de error visible en los consumidores (no pantalla en blanco); la siembra de las 9 filas es criterio de aceptación. |

## Lo que **no** entra en este spec

- Autenticación y ligar `scores` a un usuario.
- Derivar `best`/`plays` de las puntuaciones reales.
- Versionar las migraciones en `supabase/migrations/*.sql`.
- Realtime, edge functions, paginación y anti-spam del Salón.
- Fallback offline de puntuaciones a `localStorage`.
- Convertir en reales los otros 8 juegos o retirar el `GamePlayer` simulado.
- Internacionalización.

Cada uno, si llega, va en su propio spec.
