# SPEC 12 — Juego Frogger (nuevo juego real, construido desde cero en Angular)

> **Estado:** Implementado
> **Depende de:** SPEC 05 (motor TS agnóstico + componente dedicado + ruta `jugar/<id>` antes de `jugar/:id`, campo `playable`, marco CRT/overlay/táctil/guardado en `styles.css`), SPEC 06 (tablas `games`/`scores` con RLS, cliente tipado, `GamesService`/`ScoresService` async, Salón por `game_id`), SPEC 09 (convención «cada juego se crea en la BD al implementarlo» + patrón de juego construido desde cero con dibujo vectorial neón)
> **Fecha:** 2026-10-24
> **Objetivo:** Crear Frogger como motor TS agnóstico de framework + componente Angular dedicado, jugable en `jugar/frogger` con leaderboard real en Supabase, reutilizando la capa de plataforma genérica sin tocar servicios ni consumidores del catálogo.

---

## Por qué existe este spec

La plataforma ya es genérica: SPEC 05 dejó el patrón «motor TS aislado + componente dedicado + ruta propia + guardado en el Salón», SPEC 06 movió catálogo y puntuaciones a Supabase, y SPEC 09 fijó la convención de **crear cada juego en la BD al implementarlo** (no se siembran placeholders). Este spec reutiliza esa fontanería para añadir el **quinto juego real** (Frogger) **sin tocar los servicios ni los consumidores del catálogo**.

Particularidades que motivan las decisiones:

1. **El material de referencia venía en React/Next.js** (un spec de game-jam con `FroggerGame.tsx`, `app/games/frogger/play/page.tsx`, `dynamic(ssr:false)`, props/callbacks). **Este repo es solo Angular** (`CLAUDE.md`): el diseño de juego se **porta** al patrón del repo (motor TS agnóstico + componente standalone), **no** se implementa en React. Toda la mecánica (grilla, zonas, saltos, tortugas, bocas, timer, vidas, puntuación) se conserva; el andamiaje de framework se reescribe.
2. **Construido desde cero**, como Snake (SPEC 09): no hay `game.js` que portar. Motor **procedural** con la misma API pública que los demás motores.
3. **Dibujo 100% vectorial neón** (sin sprites bitmap): coches, camiones, troncos, tortugas, rana y bocas se dibujan con primitivas canvas y la paleta neón del Vault. No se cargan imágenes.
4. **Plano lógico fijo 640×560** (16×14 celdas de 40px), como el plano fijo 800×600 de Bloque Buster (SPEC 08): `resize()` solo escala el backing store con `devicePixelRatio`; la grilla **nunca se deforma**.

---

## Alcance

**Dentro:**

- **Juego nuevo `frogger`** (FROGGER, ARCADE) en el catálogo `games`, **`playable: true`**, creado vía **`INSERT`** (no UPDATE): `cover` = `cover-frogger` (clase **nueva** en `styles.css`), `color` = `green`, `position` = 4, `best` = 0, `plays` = `'—'`.
- **Motor TS aislado** `src/app/games/frogger/frogger-engine.ts`: lógica de Frogger **procedural**, agnóstica de framework (no importa nada de Angular). API pública espejo de los demás motores: `start()`, `pause()`, `resume()`, `restart()`, `destroy()`, `setInput(action, pressed)`, `getState()`, callback `onState`. Implementa:
  - **Grilla lógica fija** `COLS`×`ROWS` (16×14) de `CELL` 40px → plano `CANVAS_W`×`CANVAS_H` = 640×560.
  - **Zonas por fila** (0 = arriba): fila 0 **bocas destino**; filas 1–6 **río**; fila 7 **segura** (mediana); filas 8–12 **carretera**; fila 13 **base de inicio** (segura).
  - **Rana con saltos discretos**: cada pulsación mueve la rana **exactamente 1 celda** en 4 direcciones tras una animación de salto de `HOP_MS` (120 ms). No puede salir por los bordes laterales (saltos). La lógica de la celda destino (muerte/meta/puntuación) se resuelve al **completar** el salto.
  - **Carriles de carretera** (filas 8–12): coches y camiones de 1–3 celdas, velocidades y sentidos por carril, movimiento horizontal en loop (reentran por el lado opuesto). Colisión con la rana = muerte.
  - **Carriles de río** (filas 1–6): troncos (2–4 celdas) y grupos de tortugas (2–3), movimiento horizontal en loop. La rana **solo sobrevive** en el río si está sobre un tronco o tortugas **visibles**; si no hay soporte, cae al agua y muere. Las **tortugas se sumergen** periódicamente (visible → bajo el agua → visible); sumergidas **no dan soporte**. Mientras descansa sobre una entidad, la rana **deriva** con ella; si la deriva la saca por un borde lateral del río, muere.
  - **Bocas destino** (fila 0): **5 bocas**, cada una asociada a una columna-ancla. Llegar a una boca libre la **ocupa** y puntúa; una boca ya ocupada (o una posición de la fila 0 que no es boca) = muerte. Al ocupar las **5** bocas se **completa la ronda** y empieza la siguiente.
  - **Temporizador de ronda**: `ROUND_TIME_BASE` 15 s, decrece con el nivel; agotarlo = muerte.
  - **3 vidas**: cada muerte resta 1 y reposiciona la rana en la base; a 0 vidas → `gameover`.
  - **Puntuación**: +10 por **nueva fila** alcanzada hacia arriba (primera vez en la ronda), +50 al ocupar una boca, +200 al completar una ronda, y **bonus de tiempo** = `timeLeft × 10` al ocupar una boca.
  - **Dificultad por nivel**: todas las velocidades +15% por nivel; el temporizador de ronda se acorta por nivel.
  - **Infra espejo** de los otros motores: plano fijo con backing store `devicePixelRatio` en `resize`/`ResizeObserver` (`ctx.setTransform` para no deformar); listeners de teclado propios con `preventDefault` en flechas/espacio, **activos solo mientras el motor corre**; `setInput` para los botones táctiles; `emitState` con **dedupe** que invoca `onState` al cambiar `score`/`lives`/`level`/`timeLeft`/`phase`; el motor dibuja los overlays **EN PAUSA**/**GAME OVER** en el canvas y **`ESPACIO` reinicia** en `gameover`. `update(dt)` público y **sin tocar `ctx`** (testeable); `draw()` aislado; `dt` capado.
- **Componente dedicado** `Frogger` en la ruta **`jugar/frogger`** (declarada **antes** de `jugar/:id`). Hospeda el `<canvas>`; instancia el motor solo en navegador (`afterNextRender` + `NgZone.runOutsideAngular`) y lo destruye en `ngOnDestroy`.
- **HUD DOM neón** (SCORE / VIDAS / NIVEL / TIEMPO) en el marco del reproductor, **alimentado por `onState`**. Coexiste con el HUD interno dibujado en el canvas (doble HUD, patrón de la plataforma).
- **Controles:** teclado **flechas** y **WASD** (saltos, con tope en bordes laterales), **D-pad táctil de 4 botones** (↑/↓/←/→) vía `setInput`. **Pausa** (`P`/`Esc` + botón de la plataforma) que congela el bucle y muestra "EN PAUSA"; la pausa **la dispara el componente** (el motor **no** bindea `P`).
- **Guardado en el Salón con botón aparte:** en `gameover`, botón "GUARDAR PUNTUACIÓN" (iniciales por defecto `SessionService.user()?.name ?? 'INVITADO'`) → `ScoresService.save({ game: 'frogger', score, name })` (async). Estados "GUARDANDO…"/confirmación/error+reintento, sin doble guardado.
- **Estilos** nuevos en `src/styles.css`: portada **CSS-only** `.cover-frogger` (patrón gradientes + `::before`/`::after`) y el canvas dentro del CRT (clonar el cuerpo de `.asteroids-canvas` como `.frogger-canvas`, `touch-action: none`). Reutilizar el resto del marco CRT, overlay, táctil y zona de guardado ya existentes.
- **Tests Vitest:** unitarios del motor (lógica pura) y smoke del componente.

**Fuera de alcance (para futuros specs):**

- **Sprites bitmap** (la rana, vehículos y río se dibujan con vectores neón).
- **Animaciones de muerte elaboradas** (explosiones/partículas más allá de lo básico).
- **Power-ups / eventos**: mosca bonus en la boca, cocodrilo disfrazado de tronco, serpientes en la mediana.
- **Sonido/música.**
- **Dificultad configurable**, más tipos de carril, modos alternativos.
- **Derivar `best`/`plays` de `scores`**, realtime del Salón, migraciones SQL versionadas, auth ligada a `scores`.
- **Internacionalización** (la UI queda solo en español).

---

## Modelo de datos

No introduce tablas nuevas: reutiliza `games` y `scores` de SPEC 06. `scores` **no cambia** (tabla única por `game_id`; el leaderboard ya consulta `game_id = 'frogger'`). Este spec introduce el **alta de una fila de catálogo** y un **contrato de estado motor → componente**.

Alta en `public.games` (vía MCP; ver Plan):

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, playable, position)
values (
  'frogger', 'FROGGER',
  'Cruza la carretera y el río sin convertirte en papilla.',
  'Guía a tu rana por una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.',
  'ARCADE', 'cover-frogger', 'green', 0, '—', true, 4
);
```

Resultado esperado del catálogo (5 filas, todas jugables): `asteroides` (0), `bloque-buster` (1), `caida` (2), `snake` (3), `frogger` (4).

Contrato que el motor notifica al componente (ni el motor ni el contrato conocen Angular):

```ts
// src/app/games/frogger/frogger-engine.ts
export type FroggerPhase = 'playing' | 'gameover'; // las vidas se gestionan dentro; gameover al llegar a 0

export interface FroggerState {
  score: number;
  lives: number;    // 3 → 0
  level: number;    // 1..N, sube al completar ronda
  timeLeft: number; // segundos restantes de la ronda (para la barra de tiempo del HUD)
  phase: FroggerPhase;
}

export type TouchAction = 'up' | 'down' | 'left' | 'right'; // D-pad; mismo efecto que las flechas

export interface FroggerEngineOptions {
  onState?: (s: FroggerState) => void; // invocado solo cuando cambia el estado observable (dedupe)
}

export class FroggerEngine {
  constructor(canvas: HTMLCanvasElement, opts?: FroggerEngineOptions);
  start(): void;
  pause(): void;                                     // cancela RAF y pinta "EN PAUSA" en el canvas
  resume(): void;
  restart(): void;                                   // reinicia la partida (equivalente a ESPACIO en gameover)
  setInput(a: TouchAction, pressed: boolean): void;  // táctil → mismo salto que el teclado
  getState(): FroggerState;
  destroy(): void;                                   // cancela RAF, quita listeners de teclado/resize, ResizeObserver
}
```

Constantes y convenciones (exportadas para tests):

- **Grilla / plano:** `COLS` 16, `ROWS` 14, `CELL` 40 → `CANVAS_W` 640, `CANVAS_H` 560 (plano lógico fijo). Zonas por índice de fila (0 = arriba): `ROW_GOALS` 0; río 1–6 (`ROW_RIVER_TOP` 1, `ROW_RIVER_BOT` 6); `ROW_SAFE_MID` 7; carretera 8–12 (`ROW_ROAD_TOP` 8, `ROW_ROAD_BOT` 12); `ROW_START` 13.
- **Salto:** `HOP_MS` 120. La rana arranca en `ROW_START`, columna central (8). Durante la animación se interpola solo para dibujar; la lógica de celda destino se resuelve al terminar.
- **Entidades:** `type EntityKind = 'car' | 'truck' | 'log' | 'turtle'`. `interface Lane { row; speed; dir: 1 | -1; entities: Entity[] }`, `interface Entity { col: number; width: number; kind: EntityKind; submerged?: boolean }`. `col` es flotante (posición continua en celdas); al salir por un borde reentra por el opuesto (`col = -width` o `col = COLS`).
- **Tortugas:** ciclo de inmersión por grupo (p. ej. 3 s visible / 1.5 s sumergida). `submerged === true` ⇒ sin soporte.
- **Soporte en río:** `getSupport(frog, lanes)` devuelve la entidad del carril de la rana cuyo rango `[col, col+width)` cubre la columna de la rana y **no** es tortuga sumergida; si no hay, la rana muere (agua). Si hay, la rana deriva con `entity.speed * dir`; salir por un borde lateral = muerte.
- **Colisión en carretera:** `checkRoadCollision(frog, lanes)` ⇒ muerte si una entidad del carril de la rana solapa su columna.
- **Bocas:** 5 bocas en la fila 0 (columnas-ancla con huecos). Boca libre ⇒ ocupar + puntuar; boca ocupada o posición no-boca ⇒ muerte. 5 ocupadas ⇒ ronda completa.
- **Temporizador:** `ROUND_TIME_BASE` 15 s; por nivel `roundTime = max(MIN_ROUND_TIME, ROUND_TIME_BASE − (level−1)·TIME_STEP)` (`TIME_STEP` ~1.5, `MIN_ROUND_TIME` ~8). A 0 ⇒ muerte por tiempo.
- **Velocidad:** cada nivel multiplica las velocidades base de todos los carriles por `1.15^(level−1)`.
- **Puntuación:** `SCORE_ADVANCE` 10 (por fila nueva hacia arriba, 1ª vez en la ronda), `SCORE_GOAL` 50, `SCORE_ROUND` 200, bonus de tiempo `timeLeft × TIME_BONUS` (`TIME_BONUS` 10) al ocupar boca.
- **Vidas:** `LIVES_START` 3; cada muerte −1 y reposiciona en `ROW_START`/col central + resetea temporizador; a 0 ⇒ `phase = 'gameover'`.
- El estado observable para `onState` es `score`/`lives`/`level`/`timeLeft`/`phase`. El `name` se normaliza a mayúsculas y se acota a ≤ 12 caracteres.

---

## Plan de implementación

Numerado; cada paso deja la app compilando y navegable.

1. **Ruta + cascarón.** Crear un componente `Frogger` mínimo en `src/app/games/frogger/frogger.ts|html`; declarar `{ path: 'jugar/frogger', component: Frogger }` en `src/app/app.routes.ts` **antes** de `{ path: 'jugar/:id', component: GamePlayer }` (import incluido, junto a los demás `jugar/<id>`). Prueba: `/jugar/frogger` renderiza el cascarón; `/jugar/<otro>` sigue abriendo el `GamePlayer` simulado; `npm run build` compila. (El catálogo y los estilos van en pasos 5–7.)
2. **Motor — lógica base.** Crear `src/app/games/frogger/frogger-engine.ts` con la grilla/zonas, la rana con saltos discretos (`HOP_MS`, tope en bordes), `buildLanes(level)` (carriles de carretera y río con velocidades por nivel, entidades precargadas con huecos atravesables; tortugas con ciclo de inmersión), `update(dt)` (avance continuo de entidades con reentrada por el lado opuesto; animación de salto; deriva en río; decremento de temporizador; resolución de celda destino), `checkRoadCollision`, `getSupport`, `checkGoal`, `completeRound`, `killFrog`, puntuación. **`update(dt)` sin tocar `ctx`**; `dt` capado. Prueba: tests del paso 8.
3. **Motor — infra y dibujo.** Añadir al motor: `resize()` con plano fijo 640×560 y backing store `devicePixelRatio` (`setTransform`, sin recalcular `W`/`H` lógicos) + `ResizeObserver`; listeners de teclado propios (`preventDefault` en flechas/espacio), **activos solo mientras corre** (flechas/WASD saltan; `Espacio` reinicia en `gameover`); `setInput` para los 4 botones táctiles; `emitState` con dedupe → `onState`; `pause`/`resume`/`restart`/`destroy`; `draw()` **vectorial neón** (zonas de fondo por color; coches/camiones/troncos/tortugas visibles/sumergidas; rana; bocas libres/ocupadas; HUD interno: score, nivel, iconos de vida, barra de tiempo). **La pausa por `P`/`Esc` la dispara el componente** (el motor no bindea `P`). Prueba: humo manual + build.
4. **Componente.** `src/app/games/frogger/frogger.ts|html` (standalone, signals, `imports: [EsNumberPipe, RouterLink]`, `host: { class: 'av-player fade-in', style: 'display: block' }`, `implements OnDestroy`). `viewChild.required` del `<canvas #canvas>`. Instanciar el motor **solo en navegador** con `afterNextRender` + `NgZone.runOutsideAngular` (sin `isPlatformBrowser` redundante), pasando `onState: s => zone.run(() => this.applyState(s))`; `engine.start()`; `destroy()` en `ngOnDestroy`. Signals espejo `score`/`lives`/`level`/`timeLeft`/`phase` + UI `paused`/`saved`/`saving`/`saveError`/`name`. Handler aparte de `keydown` para `P`/`Escape` → pausa (con `preventDefault`), guardado en campo y retirado en `ngOnDestroy`. `applyState(s)` copia a signals y, si detecta reinicio (`phase === 'playing'` tras `saved`/`saveError`), rehabilita el guardado. Táctil `press(action, pressed, e)` → `preventDefault` + `engine.setInput`. Método `restartGame()` → `engine.restart()` + rehabilitar guardado (para el botón «JUGAR DE NUEVO» del patrón móvil SPEC 10). Prueba: jugar, pausar, morir, salir sin dejar RAF/listeners vivos.
5. **HUD + guardado (HTML).** Marco CRT reutilizado: `.player-hud` con SCORE/VIDAS/NIVEL/TIEMPO (via `onState`) y `.hud-actions` (PAUSA/REANUDAR, SALIR). `.crt > .crt-screen` con `<canvas #canvas>`; `.touch-controls` con el **D-pad de 4 botones** (↑/↓/←/→; pointerdown/up/leave/cancel → `press`). `@if (phase() === 'gameover')` bloque `.av-save` con marcador final, input de iniciales, botón cuyo label es `saving() ? 'GUARDANDO…' : saveError() ? 'REINTENTAR' : 'GUARDAR PUNTUACIÓN'`, línea de error opcional, botón «JUGAR DE NUEVO» (`.av-restart` → `restartGame()`) y "VOLVER AL VAULT" (`RouterLink` a `''`). El guardado llama `ScoresService.save({ game: 'frogger', score: this.score(), name: this.name() })` solo en `gameover`, sin doble guardado. Prueba: en `gameover` el botón guarda una vez y refleja estado; el HUD DOM coincide con la partida.
6. **Estilos.** Añadir a `src/styles.css`: portada **CSS-only** `.cover-frogger` en el bloque de "Cover art generators" (gradientes + `::before`/`::after`, tema rana/carretera/río, legible sobre fondo oscuro) y el canvas dentro del CRT (clonar `.asteroids-canvas` como `.frogger-canvas`). Reutilizar lo existente (`.soon-badge.lg`, marco CRT, `.game-overlay`, `.touch-controls`/`.touch-cluster`/`.touch-btn`, `.av-save`, `.av-restart`, `@media prefers-reduced-motion`). Coordinar **`frontend-design` + `ui-ux-pro-max`** (foco visible, contraste, `prefers-reduced-motion` atenúa decoración no jugabilidad, SVG/íconos `aria-hidden`).
7. **Catálogo en `games` vía MCP.** Con `mcp__supabase__apply_migration` (o `execute_sql`): el `INSERT` de `frogger` del Modelo de datos (`playable: true`, `position` 4). `scores` no requiere nada. Sincronizar la semilla de referencia `src/app/data/games.data.ts` (añadir la entrada `frogger`, `playable: true`) y `GAMES_FIXTURE` en `src/app/testing/supabase-mock.ts` (añadir la 5.ª fila) + el conteo esperado en `games.service.spec.ts` si lo verifica. Pruebas (MCP): `select id, playable, position from games order by position` → 5 filas jugables con `frogger` en la posición 4; `select playable from games where id='frogger'` → `true`. Verificar que `frogger` aparece sin "PRÓXIMAMENTE" y que `/juego/frogger` funciona.
8. **Tests.** `frogger-engine.spec.ts` (lógica pura, `new FroggerEngine(document.createElement('canvas'))`, conduciendo la simulación poniendo la rana/carriles y llamando `update(dt)`; **sin** `getContext`/`draw`): un salto avanza la rana exactamente 1 celda tras `HOP_MS` y no cruza los bordes laterales; `checkRoadCollision` mata al solapar un vehículo; en el río sin soporte la rana muere, con tronco/tortuga visible sobrevive y deriva, con tortuga sumergida muere; una boca libre puntúa y se marca, una ocupada mata; completar las 5 bocas incrementa `level` y resetea; agotar el temporizador mata; cada muerte decrementa `lives` y a 0 pone `phase: 'gameover'`; el bonus de tiempo y los puntos por avance/boca/ronda suman según las constantes; subir de nivel acelera y acorta el tiempo. `frogger.spec.ts` (`TestBed` + `provideRouter([{ path: '', component: Frogger }])`; en `beforeEach` stub de RAF: `vi.stubGlobal('requestAnimationFrame', () => 0)` y `cancelAnimationFrame`): monta y refleja `onState` en el HUD DOM; `vi.spyOn(ScoresService,'save').mockResolvedValue({ ok: true })` para verificar que guarda solo en `gameover`, envía `{ game: 'frogger', score, name }`, sin doble guardado, y que el error fija `saveError`. Ajustar `GAMES_FIXTURE` (5 filas) y el conteo en `games.service.spec.ts`. Comando: `npx ng test --watch=false` (o un solo archivo con `--include=`).
9. **Docs.** Actualizar `CLAUDE.md` ("Port status" y el bullet de `games/`): `frogger` como **quinto juego real** (motor TS en `games/frogger/`, grilla 16×14, vectores neón, 3 vidas, bocas/río/carretera/tortugas), creado vía `INSERT` (posición 4). Actualizar la tabla "Juegos implementados" (5 juegos).

---

## Criterios de aceptación

- [ ] `npm run build` y un spec unitario del motor (`npx ng test --include=src/app/games/frogger/frogger-engine.spec.ts --watch=false`) terminan sin errores. (La suite completa no se corre por riesgo OOM.)
- [ ] La tabla `games` tiene `frogger` con `playable: true`, `cover-frogger`, `green`, `position` 4, `best` 0, `plays` '—'; aparece sin badge "PRÓXIMAMENTE" en la biblioteca y su ficha `/juego/frogger` funciona. El catálogo queda con 5 filas jugables.
- [ ] `/jugar/frogger` carga el componente dedicado `Frogger`; `/jugar/<otro-id>` sigue abriendo el `GamePlayer` simulado.
- [ ] El canvas (plano lógico 640×560) muestra las **cuatro zonas** visualmente diferenciadas (carretera, río, zonas seguras, bocas destino); la grilla no se deforma al redimensionar (plano fijo, backing store DPR).
- [ ] La rana aparece centrada en la fila de inicio al cargar; salta **exactamente 1 celda (40px)** por pulsación con animación de 120 ms; **no sale por los bordes laterales** mediante saltos.
- [ ] Coches y camiones se mueven en loop por sus carriles y reentran por el lado opuesto; troncos y tortugas igual; las tortugas alternan visible/sumergida con su ciclo.
- [ ] La rana muere por: vehículo, caída al agua (sin soporte), tortuga que se sumerge bajo ella, deriva fuera del borde lateral del río, y agotar el temporizador.
- [ ] En el río, estar sobre tronco/tortugas **visibles** mantiene viva a la rana y la **arrastra** con la entidad.
- [ ] Llegar a una boca libre la **ocupa**, suma +50 y el **bonus de tiempo** (`timeLeft × 10`); llegar a una boca ocupada (o posición no-boca de la fila 0) **mata**.
- [ ] Ocupar las **5 bocas** completa la ronda (+200), sube `level`, acelera las entidades y acorta el temporizador.
- [ ] Avanzar a una fila nueva hacia arriba suma +10 la primera vez en la ronda.
- [ ] **3 vidas**: cada muerte resta 1 y reposiciona la rana en la base; a 0 → `gameover` (el motor pinta "GAME OVER" con el marcador en el canvas y `ESPACIO` reinicia).
- [ ] El HUD DOM neón (SCORE/VIDAS/NIVEL/TIEMPO) refleja el estado notificado por el motor y coincide con el HUD interno del canvas.
- [ ] La pausa (`P`/`Esc` o botón) congela el bucle y muestra "EN PAUSA"; reanudar continúa sin reiniciar; `P`/`Esc` **no** provocan una pausa independiente del canvas (la dispara solo el componente).
- [ ] El juego es jugable con teclado (flechas y WASD) y con los **4 botones táctiles** (↑/↓/←/→).
- [ ] En `gameover`, "GUARDAR PUNTUACIÓN" inserta en `scores` con `game_id: 'frogger'`, el score final y las iniciales; muestra "GUARDANDO…", luego confirmación; sin doble guardado; en fallo avisa y permite reintentar; la marca aparece en la pestaña `frogger` del Salón ordenada por puntuación.
- [ ] Al abandonar `/jugar/frogger` el motor se destruye: sin `requestAnimationFrame` activos ni listeners de teclado/`resize`; las flechas/espacio no hacen scroll de la página durante el juego.
- [ ] La app renderiza bajo SSR sin tocar `window`/`document`/canvas en servidor (el motor solo se crea en navegador).
- [ ] Ningún componente consulta Supabase directamente; el motor no importa nada de Angular.
- [ ] `src/app/data/games.data.ts` y `GAMES_FIXTURE` reflejan la fila `frogger`.
- [ ] Sin errores en la consola al jugar, pausar, morir, guardar y salir.

---

## Decisiones tomadas y descartadas

- **Sí:** **portar el diseño React/Next a Angular** (motor TS agnóstico + componente standalone) conservando toda la mecánica. **No:** implementar en React/Next.js — `CLAUDE.md` prohíbe otros frameworks; el material de game-jam era solo referencia de diseño.
- **Sí:** **construir desde cero** (como Snake), motor **procedural** con la **misma API pública** que los demás motores. **No:** escribir la lógica como servicios Angular ni depender de `@Component`.
- **Sí:** **dibujo vectorial neón** (sin sprites). **No:** cargar `fruits.png`-style bitmaps — no hay assets de Frogger y los vectores evitan dependencias de carga (coherente con Bloque Buster SPEC 08).
- **Sí:** **plano lógico fijo 640×560** (16×14×40), solo backing store DPR en `resize` (como Bloque Buster). **No:** recalcular `W`/`H` responsivos (deformaría la grilla).
- **Sí:** **movimiento discreto por celda** con animación de salto de 120 ms. **No:** movimiento continuo/interpolado — complica colisiones y soporte (comparar filas/columnas enteras es canónico de Frogger).
- **Sí:** **3 vidas** y una sola fase terminal (`'playing' | 'gameover'`, las vidas se gestionan dentro). **No:** fase intermedia `dead` separada.
- **Sí:** **tortugas con ciclo de inmersión**, **temporizador de ronda** y **5 bocas** — mecánicas canónicas que dan riesgo/urgencia/estructura. **No:** diferirlas (son la esencia de Frogger).
- **Sí:** **color `green`** (rana) y **portada nueva `cover-frogger`**. **No:** `lime` del material original (no es un `GameColor` válido: `cyan`/`magenta`/`yellow`/`green`).
- **Sí:** alta de catálogo **vía MCP** (`INSERT`), `position` 4, convención «crear al implementar» (SPEC 09). **No:** versionar SQL en el repo; **no:** sembrar placeholder.
- **Sí:** **contrato único `onState`** (score/lives/level/timeLeft/phase) + `setInput`. **No:** props/callbacks separados estilo React (`onScoreChange`, `onLivesChange`, …): se consolidan en `onState`.
- **Sí:** **D-pad táctil de 4 botones** (como Snake) + método `restartGame()` para encajar con el patrón móvil (SPEC 10/11), que `@mobile-porter` conformará después. **No:** declarar los controles móviles "fuera de alcance" (el repo ya tiene capa móvil transversal).

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Fugas de `requestAnimationFrame` y listeners de teclado/`resize` al cambiar de ruta | `destroy()` centraliza el ciclo de vida y lo llama `ngOnDestroy`; un criterio de aceptación lo verifica. |
| El motor toca `window`/`document`/canvas en SSR | Se instancia solo en navegador (`afterNextRender`); rutas en `RenderMode.Client`. |
| `ESPACIO`/flechas hacen scroll de la página mientras se juega | `preventDefault` en teclas de juego; listeners activos solo mientras corre; `ESPACIO` solo reinicia (en `gameover`). |
| Doble toggle de pausa si el motor también bindea `P` | El motor **no** bindea `P`; la pausa la dispara solo el componente (`P`/`Esc`/botón). |
| Grilla deformada al redimensionar (celdas deben respetar la relación del plano) | Plano lógico fijo 640×560; `resize()` solo escala el backing store con `devicePixelRatio` vía `setTransform`. |
| Soporte en río mal resuelto (la rana "flota" o muere en falso) | `getSupport()` compara rango de columnas con la posición de la rana en su carril y excluye tortugas sumergidas; tests lo cubren. |
| Giro/salto durante la animación (saltos encolados o perdidos) | Mientras `animating`, se ignoran nuevas direcciones o se encola solo la última; la lógica de celda se resuelve al completar el salto; test del salto unitario. |
| Carriles sin huecos atravesables (nivel imposible) | `buildLanes()` garantiza huecos mínimos; velocidades acotadas por nivel; verificación manual + revisión del array en test. |
| Tests que dependen del canvas real (jsdom no implementa `2d`) | El motor se testea por lógica (salto/colisión/soporte/bocas/timer/vidas/puntuación) sin `getContext`; `draw()` aislado; en el componente se stubbea RAF. |
| Fallo de red/RLS al guardar deja al jugador sin feedback | `save()` async devuelve `{ ok, error? }`; la UI muestra "GUARDANDO…", error y reintento; sin escritura silenciosa. |

---

## Lo que **no** entra en este spec

- Sprites bitmap, animaciones de muerte elaboradas, power-ups/eventos (mosca bonus, cocodrilo, serpientes).
- Sonido/música, dificultad configurable, más tipos de carril, modos alternativos.
- Derivar `best`/`plays` de `scores`, realtime, migraciones versionadas, auth ligada a `scores`.
- Internacionalización.

Cada uno, si llega, va en su propio spec.
