# JAM · PONG — Variante B (Arcade en solitario vs IA, supervivencia con vidas)

> **Estado:** Borrador
> **Tipo:** Game Jam — variante B de 2 (numeración aislada; promover a `specs/NN-juego-<slug>.md` al aprobar)
> **Juego:** Pong (nuevo juego real desde cero)
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-10-19
> **Objetivo:** Crear Pong (variante arcade en solitario vs IA, supervivencia con 3 vidas y bola que acelera) como motor TS agnóstico + componente Angular dedicado, jugable en `jugar/pong`, con leaderboard real en Supabase.

---

## Por qué existe este spec

El catálogo tiene hoy las cuatro categorías de `CATS` ocupadas salvo **VERSUS**, que está vacío. Pong es el juego de versus por antonomasia; esta variante lo lleva al Vault como un **arcade en solitario contra la IA** pensado para puntuar: una sola pala humana, una IA que se endurece y una bola que acelera, con un **score individual limpio** que encaja de forma natural en el leaderboard por `game_id`. Es "versus" (tú contra la máquina), pero el foco está en **aguantar y sumar**, no en un duelo a dos.

La variante tiene tres particularidades que motivan sus decisiones:

1. **Un solo modo, 1P vs IA:** el duelo local a 2 jugadores en el mismo teclado se **difiere** a un spec futuro. Al no haber partida de dos, **no existe el problema del "score individual en un juego de 2 jugadores"**: el score siempre es del único humano. Así se neutraliza el riesgo medio de raíz, en el diseño.
2. **Supervivencia con vidas y aceleración (no carrera a 11):** la partida **no termina** por marcador; el humano tiene **3 vidas**, pierde una cada vez que la IA cuela la bola, y `phase` pasa de `playing` a `gameover` al agotarlas. El `score` es acumulativo (puntos marcados a la IA) y la bola/IA **aceleran** con el peloteo, al estilo de Bloque Buster (niveles de velocidad).
3. **IA creciente:** la rapidez de la IA sube por tramos conforme avanza la partida, para que la dificultad escale y el score tenga techo natural (acabas perdiendo).

Reutiliza la fontanería ya genérica (SPEC 05/06): el patrón "motor TS aislado + componente dedicado + ruta propia + guardado en el Salón" y las tablas `games`/`scores` de Supabase. No toca los servicios ni los consumidores del catálogo.

> **Alternativa mutuamente excluyente.** Esta es la **Variante B** de un game jam de Pong. Comparte identidad de catálogo (`id` `pong`, título `PONG`, categoría `VERSUS`, color `yellow`, posición 4) con la **Variante A** (`pong-variante-a.md`). Se implementa **una sola**: aprobar una variante y promoverla a `specs/NN-juego-pong.md` descarta la otra.

---

## Alcance

**Dentro:**

- **Juego nuevo `pong`** (PONG, VERSUS) en el catálogo `games`, **`playable: true`**, creado vía **`INSERT`** (no UPDATE — es un juego nuevo, no hay fila placeholder): `cover` = `cover-pong` (clase **nueva** en `styles.css`), `color` = `yellow` (único color de la paleta sin usar aún), `position` = 4 (siguiente tras `snake`), `best` = 0, `plays` = `'—'` (juego real recién creado, sin estadísticas sembradas falsas).
- **Un único modo: 1 jugador vs IA.** La pala izquierda es del humano; la derecha, de la IA. No hay modo de dos jugadores en esta variante (se difiere).
- **Motor TS aislado** `src/app/games/pong/pong-engine.ts`: Pong **procedural** desde cero, agnóstico de framework (no importa nada de Angular). API pública espejo de `AsteroidsEngine`/`BloqueBusterEngine`: `start()`, `pause()`, `resume()`, `restart()`, `destroy()`, `setInput(action, pressed)`, `getState()`, callback `onState`. Implementa: pista con la pala del humano (izquierda) y la de la IA (derecha), bola con vector de velocidad, **rebote AABB** bola↔pala (patrón portado de `bloque-buster-engine.ts`), rebote en muros superior/inferior, zonas de gol izquierda/derecha, saque, **3 vidas**, **score acumulativo** (puntos marcados a la IA), **aceleración** de la bola y de la IA por tramos, control de ángulo según el punto de impacto en la pala, y fin de partida al agotar las vidas.
- **Física de rebote reutilizada:** `collideAABB(pala, bola)` clonado del patrón de Bloque Buster; al golpear, se invierte la componente `x` de la velocidad, se fija la componente `y` según el **offset del impacto respecto al centro de la pala** (ángulo clásico de Pong) y la rapidez sube un factor por golpe hasta `BALL_SPEED_MAX`.
- **Supervivencia con vidas:** `LIVES` (3). Cuando la IA cuela la bola por el lado del humano → el humano pierde una vida; al llegar a 0 vidas → `phase: 'gameover'`. Cuando el humano cuela la bola por el lado de la IA → `score += SCORE_PER_POINT` (no quita vida; es "marcar").
- **Aceleración por tramos (nivel de velocidad):** `speed` (1..N) sube cada `HITS_PER_SPEEDUP` golpes de pala; con cada subida crecen la rapidez de la bola (hasta `BALL_SPEED_MAX`) y la rapidez máxima de la IA (`AI_MAX_SPEED` por tramo), para que la dificultad escale y la partida tenga un final natural.
- **Saque determinista** (sin RNG en la lógica jugable): tras un punto/fallo la bola vuelve al centro y sale **hacia el lado que acaba de marcar/encajar**, con la componente vertical alternando de signo; retardo de saque gestionado por un temporizador **dentro de `phase: 'playing'`** (sin fase intermedia). Esto mantiene `update(dt)` determinista y testeable.
- **IA creciente y beatable al principio:** la pala de la IA persigue la `y` de la bola con una rapidez máxima `AI_MAX_SPEED` (que sube por tramo de `speed`) y una **zona muerta** alrededor del centro; arranca vencible y se endurece.
- **Redibujo neón vectorial** (sin assets): pala, bola y **red central discontinua** se dibujan con formas y glow en canvas; sin sprites ni imágenes.
- **Componente dedicado** `Pong` en la ruta **`jugar/pong`** (declarada **antes** de `jugar/:id`). Hospeda el `<canvas>`; instancia el motor solo en navegador y lo destruye en `ngOnDestroy`.
- **HUD DOM neón** (SCORE / VIDAS / VELOCIDAD) en el marco del reproductor, **alimentado por `onState`** del motor.
- **Overlay en el canvas** dibujado por el motor para PAUSA ("EN PAUSA") y GAME OVER (marcador final). **Reinicio con `ESPACIO`** en `gameover`.
- **Canvas responsive con resolución lógica fija:** la simulación corre en un plano lógico fijo **800×600** (aspecto 4:3, como Bloque Buster); el motor escala el backing store al contenedor con `devicePixelRatio` en `resize`/`ResizeObserver` y mapea el `draw()` con `setTransform`. La pista no se deforma (no se recalcula W/H como en Asteroides).
- **Controles:** teclado — pala del humano con `W`/`S` **y** `↑`/`↓` (ambas mueven la única pala humana, para comodidad). **Controles táctiles** en pantalla: un clúster vertical ↑/↓ vía `setInput`.
- **Pausa** (`P`/`Esc` + botón de la plataforma) que congela el bucle y muestra "EN PAUSA". **La pausa la dispara el componente** (el motor no bindea `P`, para evitar doble toggle).
- **Guardado en el Salón con botón aparte:** en `gameover`, botón "GUARDAR PUNTUACIÓN" (iniciales por defecto `SessionService.user()?.name ?? 'INVITADO'`) → `ScoresService.save({ game: 'pong', score, name })` (async), con **`score` = puntos acumulados del humano** (individual por naturaleza). Estados "GUARDANDO…"/confirmación/error+reintento, sin doble guardado.
- **Portada CSS-only `cover-pong`** nueva en `styles.css` (pala + bola + red, estilo del resto de `cover-*`).
- **Estilos** nuevos en `src/styles.css` (canvas 4:3 dentro del CRT, el clúster táctil vertical ↑/↓), coordinando `frontend-design` + `ui-ux-pro-max`.
- **Tests Vitest:** unitarios del motor (lógica pura) y smoke del componente.

**Fuera de alcance (para futuros specs):**

- **Modo 2 jugadores local** (duelo en el mismo teclado, `W`/`S` vs `↑`/`↓`): se **difiere** — lo implementa la **Variante A**. Si llega aquí, será en su propio spec.
- **Dificultad de la IA configurable** o selección manual de nivel: la IA escala sola por tramos; no hay ajuste manual.
- **Sonido/música** (rebote, gol): esta variante es muda (vectores neón, sin audio).
- **Power-ups** (bola doble, pala ancha, efecto), obstáculos en la pista, muros interiores.
- **Multijugador online / en red**, emparejamiento, salas.
- Derivar `best`/`plays` de `scores`, realtime del Salón, migraciones SQL versionadas, auth ligada a `scores`.
- Internacionalización (la UI queda solo en español).

---

## Modelo de datos

No introduce tablas nuevas: reutiliza `games` y `scores` de SPEC 06. `scores` **no cambia** (tabla única por `game_id`; el leaderboard ya consulta `game_id = 'pong'`). Introduce el **alta de una fila de catálogo** (INSERT) y un **contrato de estado motor → componente**.

Fila nueva en `public.games` (vía MCP; ver Plan):

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, playable, position)
values (
  'pong', 'PONG',
  'Aguanta el peloteo contra la IA que acelera.',
  'El clásico de los clásicos, en modo arcade. Una sola pala, tres vidas y una IA que se endurece con cada peloteo. Marca todos los puntos que puedas y aguanta antes de que la bola —cada vez más rápida— te supere. Tu mejor marca va directa al Salón.',
  'VERSUS', 'cover-pong', 'yellow', 0, '—', true, 4
);
```

Resultado esperado del catálogo (5 filas, todas jugables): `asteroides` (0), `bloque-buster` (1), `caida` (2), `snake` (3), `pong` (4).

Contrato que el motor notifica al componente (ni el motor ni el contrato conocen Angular):

```ts
// src/app/games/pong/pong-engine.ts
export type PongPhase = 'playing' | 'gameover'; // una sola vida-humana con 3 reintentos: gameover al agotar vidas

export interface PongState {
  score: number;    // puntos marcados a la IA (acumulado)
  lives: number;    // 3; baja cuando la IA cuela la bola
  speed: number;    // nivel de velocidad (1..N), sube con el peloteo
  phase: PongPhase;
}

export type TouchAction = 'up' | 'down'; // clúster vertical de la única pala humana

export interface PongEngineOptions {
  onState?: (s: PongState) => void; // invocado solo cuando cambia el estado observable (dedupe)
}

export class PongEngine {
  constructor(canvas: HTMLCanvasElement, opts?: PongEngineOptions);
  start(): void;
  pause(): void;                                     // cancela RAF y pinta "EN PAUSA" en el canvas
  resume(): void;
  restart(): void;                                   // reinicia la partida (equivalente a ESPACIO en gameover)
  setInput(a: TouchAction, pressed: boolean): void;  // táctil → mismos flags que el teclado
  getState(): PongState;
  destroy(): void;                                   // cancela RAF, quita listeners de teclado/resize, ResizeObserver
}
```

Constantes y convenciones (exportadas para tests): plano lógico `W` (800) / `H` (600); `PADDLE_W` (14) / `PADDLE_H` (96) / `PADDLE_SPEED` (460 px/s); `BALL` (14, lado del cuadrado neón); `BALL_SPEED_0` (340) / `BALL_SPEED_MAX` (860) / `SPEED_UP` (×1.05 por golpe hasta el tope); `LIVES` (3); `SCORE_PER_POINT` (100 por punto marcado a la IA); `HITS_PER_SPEEDUP` (4, golpes de pala para subir un tramo de `speed`); `AI_MAX_SPEED` base (≈ 320 px/s) que crece por tramo de `speed` y `AI_DEADZONE` (zona muerta). El rebote bola↔pala usa `collideAABB` (patrón de Bloque Buster): invierte `vx`, fija `vy` según el offset del impacto, y multiplica la rapidez por `SPEED_UP` hasta `BALL_SPEED_MAX`. Muros superior/inferior invierten `vy`. Si la bola cruza el borde de la IA → `score += SCORE_PER_POINT` y saque; si cruza el borde del humano → `lives--` y saque; `lives === 0` → `phase: 'gameover'`. Saque determinista hacia el lado que marcó/encajó (vertical alternando, **sin RNG**). El estado observable para `onState` es `score`/`lives`/`speed`/`phase`. El `name` se normaliza a mayúsculas y se acota a ≤ 12 caracteres.

---

## Plan de implementación

Numerado; cada paso deja la app compilando y navegable.

1. **Ruta + cascarón.** Crear un componente `Pong` mínimo en `src/app/games/pong/pong.ts|html`; declarar `{ path: 'jugar/pong', component: Pong }` en `src/app/app.routes.ts` **antes** de `{ path: 'jugar/:id', component: GamePlayer }` (import incluido). Prueba: `/jugar/pong` renderiza el cascarón; `/jugar/<otro>` sigue abriendo el `GamePlayer` simulado; `npm run build` compila. (El catálogo y los estilos van en pasos 5–6.)
2. **Motor.** Crear `src/app/games/pong/pong-engine.ts` desde cero, procedural: pista 800×600, pala humana (izquierda) con `y`/`vy`, pala IA (derecha), bola con `x`/`y`/`vx`/`vy`, `collideAABB` (clonado del patrón de Bloque Buster), rebote en muros superior/inferior, control de ángulo por offset de impacto, aceleración por golpe hasta `BALL_SPEED_MAX`, tramos de `speed` cada `HITS_PER_SPEEDUP` golpes (suben bola e IA), gol de la IA → `lives--` (0 → `gameover`), gol del humano → `score += SCORE_PER_POINT`, saque determinista, IA que persigue la bola con `AI_MAX_SPEED` por tramo + `AI_DEADZONE`. Infra espejo de los otros motores: resolución **lógica fija 800×600** con backing store `devicePixelRatio` recalculado en `resize` + `ResizeObserver` y `setTransform`; listeners de teclado propios con `preventDefault` en `W`/`S`/flechas/espacio, **activos solo mientras el motor corre** (`W`/`S` y `↑`/`↓` = pala humana; `Espacio` = reinicio en `gameover`); `setInput('up'|'down')` para el clúster táctil; `emitState` con dedupe que invoca `onState` al cambiar `score`/`lives`/`speed`/`phase`; `pause`/`resume`/`restart`/`destroy`; el motor dibuja "EN PAUSA" y "GAME OVER" en el canvas. `update(dt)` público y **sin tocar `ctx`** (testeable); `draw()` aislado; `dt` capado. **La pausa por `P`/`Esc` la dispara el componente** (el motor no bindea `P`). Prueba: tests del paso 7 + humo manual.
3. **Componente.** `src/app/games/pong/pong.ts|html` (standalone, signals, `imports: [EsNumberPipe, RouterLink]`, `host: { class: 'av-player fade-in' }`, `implements OnDestroy`). `viewChild.required` del `<canvas #canvas>`. Instanciar el motor **solo en navegador** con `afterNextRender` + `NgZone.runOutsideAngular` (sin `isPlatformBrowser` redundante), pasando `onState: s => zone.run(() => this.applyState(s))`; `engine.start()`; `destroy()` en `ngOnDestroy`. Signals espejo `score`/`lives`/`speed`/`phase` + UI `paused`/`saved`/`saving`/`saveError`/`name`. Handler aparte de `keydown` para `P`/`Escape` → pausa (con `preventDefault`), guardado en campo y retirado en `ngOnDestroy`. `applyState(s)` copia a signals y, si detecta reinicio (`phase === 'playing'` tras `saved`/`saveError`), rehabilita el guardado. Táctil `press(action, pressed, e)` → `preventDefault` + `engine.setInput`. Prueba: jugar, pausar, morir, salir sin dejar RAF/listeners vivos.
4. **HUD + guardado (HTML).** Marco CRT reutilizado: `.player-hud` con SCORE/VIDAS/VELOCIDAD (via `onState`) y `.hud-actions` (PAUSA/REANUDAR, SALIR). `.crt > .crt-screen` con `<canvas #canvas>`; `.touch-controls` con un **clúster vertical ↑/↓** (pointerdown/up/leave/cancel → `press`). `@if (phase() === 'gameover')` bloque `.av-save` con marcador final, input de iniciales, botón cuyo label es `saving() ? 'GUARDANDO…' : saveError() ? 'REINTENTAR' : 'GUARDAR PUNTUACIÓN'`, línea de error opcional y "VOLVER AL VAULT" (`RouterLink` a `''`). El guardado llama `ScoresService.save({ game: 'pong', score: this.score(), name: this.name() })` solo en `gameover`, sin doble guardado. Prueba: en `gameover` el botón guarda una vez y refleja estado; el HUD DOM coincide con la partida.
5. **Catálogo + estilos.** Vía MCP (paso 6 lo detalla) `INSERT` de `pong`; sincronizar `src/app/data/games.data.ts` (añadir la 5.ª entrada `pong`, `playable: true`) y `GAMES_FIXTURE` (5 filas) + el conteo en `games.service.spec.ts`. Verificar que `pong` aparece sin "PRÓXIMAMENTE" y que `/juego/pong` funciona. Añadir a `src/styles.css`: la **portada `cover-pong`** (pala + bola + red, estilo de los `cover-*` existentes), el canvas **4:3** dentro del CRT (clonar el cuerpo de `.asteroids-canvas` como `.pong-canvas` por el aspecto distinto) y el clúster táctil vertical ↑/↓. Reutilizar lo existente (`.soon-badge.lg`, marco CRT, `.game-overlay`, `.touch-controls`/`.touch-cluster`/`.touch-btn`, `.av-save`, `@media prefers-reduced-motion`). Coordinar `frontend-design` + `ui-ux-pro-max` (foco visible, contraste, `prefers-reduced-motion` atenúa decoración no jugabilidad, SVG/íconos `aria-hidden`).
6. **Alta en `games` vía MCP.** Con `mcp__supabase__apply_migration` (o `execute_sql`): el `INSERT` de `pong` del Modelo de datos. `scores` no requiere nada. Pruebas (MCP): `select id, playable, position from games order by position` → 5 filas jugables con `pong` en la 4; `select cat from games where id='pong'` → `VERSUS`.
7. **Tests.** `pong-engine.spec.ts` (lógica pura, `new PongEngine(document.createElement('canvas'))`, conduciendo la simulación poniendo posiciones de palas/bola y llamando `update(dt)`; **sin** `getContext`/`draw`): la bola rebota en los muros superior/inferior (invierte `vy`); `collideAABB` con la pala invierte `vx`, fija `vy` por offset y acelera hasta `BALL_SPEED_MAX`; colar la bola por el lado de la IA suma `SCORE_PER_POINT`; colar por el lado del humano resta una vida y al llegar a 0 pasa a `gameover`; cada `HITS_PER_SPEEDUP` golpes sube `speed` y la rapidez de bola e IA; la IA no supera su `AI_MAX_SPEED` del tramo. `pong.spec.ts` (`TestBed` + `provideRouter([{ path: '', component: Pong }])`; en `beforeEach` stub de RAF: `vi.stubGlobal('requestAnimationFrame', () => 0)` y `cancelAnimationFrame`): monta y refleja `onState` en el HUD DOM; `vi.spyOn(ScoresService,'save').mockResolvedValue({ ok: true })` para verificar que guarda solo en `gameover`, envía `{ game: 'pong', score, name }`, sin doble guardado, y que el error fija `saveError`. Ajustar `GAMES_FIXTURE` (5 filas) en `src/app/testing/supabase-mock.ts` y el conteo en `games.service.spec.ts`. Comando: `npx ng test --watch=false`.
8. **Docs.** Actualizar `CLAUDE.md` ("Port status" y el bullet de `games/`): `pong` como **quinto juego real** (motor TS en `games/pong/`, VERSUS, arcade 1P vs IA, supervivencia con 3 vidas + aceleración, score acumulado), creado vía `INSERT`; VERSUS deja de estar vacío; el modo 2 jugadores local queda para un spec futuro.

---

## Criterios de aceptación

- [ ] `npm run build` y `npx ng test --watch=false` terminan sin errores.
- [ ] `pong` existe en `games` con `playable: true`, `cat` `VERSUS`, `cover-pong`, `yellow`, `position` 4, `best` 0, `plays` '—'; aparece sin badge "PRÓXIMAMENTE" en la biblioteca y su ficha `/juego/pong` funciona. El catálogo pasa a 5 filas jugables.
- [ ] `/jugar/pong` carga el componente dedicado `Pong`; `/jugar/<otro-id>` sigue abriendo el `GamePlayer` simulado.
- [ ] El juego es jugable en solitario con teclado (`W`/`S` y `↑`/`↓` mueven la única pala humana) y con el clúster táctil vertical ↑/↓.
- [ ] La bola rebota en los muros superior/inferior y en las palas (AABB); el ángulo de salida depende del punto de impacto en la pala; la bola acelera con cada golpe hasta un tope.
- [ ] Colar la bola por el lado de la IA suma `SCORE_PER_POINT` al score; colar por el lado del humano resta una vida.
- [ ] La IA es vencible al principio y se endurece: su rapidez máxima sube con el nivel de VELOCIDAD; la bola también acelera por tramos.
- [ ] Al agotar las 3 vidas la partida termina: el motor pinta "GAME OVER" con el marcador final en el canvas; `ESPACIO` reinicia.
- [ ] El HUD DOM neón (SCORE/VIDAS/VELOCIDAD) refleja el estado notificado por el motor; coincide con la partida del canvas.
- [ ] La pausa (`P`/`Esc` o botón) congela el bucle y muestra "EN PAUSA" en el canvas; reanudar continúa sin reiniciar.
- [ ] En `gameover`, "GUARDAR PUNTUACIÓN" inserta en `scores` con `game_id: 'pong'`, el `score` acumulado del humano y las iniciales; muestra "GUARDANDO…", luego confirmación; sin doble guardado; en fallo avisa y permite reintentar; la marca aparece en la pestaña `pong` del Salón ordenada por puntuación.
- [ ] El canvas escala al contenedor preservando su aspecto **4:3**; sin scroll horizontal a 360 px; la resolución interna se recalcula al redimensionar sin deformar la pista.
- [ ] Al abandonar `/jugar/pong` el motor se destruye: sin `requestAnimationFrame` activos ni listeners de teclado/`resize`; `W`/`S`/flechas/espacio no hacen scroll de la página durante el juego.
- [ ] La app renderiza bajo SSR sin tocar `window`/`document`/canvas en servidor (el motor solo se crea en navegador).
- [ ] Ningún componente consulta Supabase directamente; el motor no importa nada de Angular.
- [ ] Sin errores en la consola al jugar, pausar, morir, guardar y salir.

---

## Decisiones tomadas y descartadas

- **Eje diferenciador frente a la Variante A (alcance de modos + modelo de puntuación/fin):** esta variante hace protagonista el **1P vs IA en solitario** y **difiere el 2P local**, con un modelo de **supervivencia (3 vidas) + score acumulado + aceleración por tramos** (`playing | gameover` al agotar vidas). La Variante A hace protagonista el **duelo local 2P** y usa **carrera finita a 11** (sin vidas). Son **alternativas mutuamente excluyentes**: se implementa una sola.
- **Sí:** **crear `pong` vía `INSERT`** (juego nuevo), `cat` `VERSUS`, `color` `yellow` (único libre), `position` 4, `best` 0 / `plays` '—'. **No:** `UPDATE` de una fila placeholder — no existe; SPEC 09 fijó la convención de **crear cada juego al implementarlo**.
- **Sí:** **motor TS aislado procedural desde cero** con la **misma API pública** que `AsteroidsEngine`/`BloqueBusterEngine` (`start/pause/resume/restart/destroy/setInput/getState/onState`). **No:** reescribir la lógica como servicios Angular.
- **Sí:** **un único modo 1P vs IA** con score individual limpio. **No:** modo 2 jugadores local en esta variante — se difiere (lo cubre la Variante A). Así se **neutraliza en el diseño** el riesgo de "score individual en un juego de 2 jugadores": aquí el score es siempre del único humano.
- **Sí:** **supervivencia con 3 vidas + score acumulado + aceleración por tramos** (estilo de niveles de velocidad de Bloque Buster). **No:** carrera finita a 11 — ese modelo es el de la Variante A.
- **Sí:** **IA creciente y beatable al inicio** (rapidez máxima por tramo de `speed` + zona muerta). **No:** dificultad configurable ni selección manual de nivel (se difiere).
- **Sí:** **redibujo neón vectorial** (pala/bola/red) sin assets ni sonido — enfoque de bajo esfuerzo. **No:** sprites, imágenes ni audio.
- **Sí:** **rebote AABB** reutilizando el patrón probado en `bloque-buster-engine.ts` y **plano lógico fijo 800×600** escalado con `devicePixelRatio`. **No:** recalcular W/H desde el contenedor como en Asteroides — deformaría la pista y las distancias.
- **Sí:** **saque determinista** (hacia el lado que marcó/encajó, vertical alternando) para que `update(dt)` sea testeable sin RNG. **No:** saque con dirección aleatoria.
- **Sí:** **controles = teclado (`W`/`S` + `↑`/`↓` sobre una sola pala) + clúster táctil vertical ↑/↓**. **No:** arrastre de puntero (encaja mejor en Bloque Buster).
- **Sí:** la **pausa la dispara el componente** (`P`/`Esc`/botón); el motor no bindea `P`. **No:** que motor y componente bindeen `P` a la vez (doble toggle).
- **Sí:** alta de catálogo **vía MCP** (`INSERT`). **No:** versionar SQL en el repo (decisión heredada de SPEC 06).

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Score individual en un juego pensado para 2 jugadores | Esta variante **no tiene** modo 2 jugadores: el score siempre es del único humano, así que el guardado individual del Salón encaja de forma natural y el riesgo desaparece en el diseño. |
| Fugas de `requestAnimationFrame` y listeners de teclado/`resize` al cambiar de ruta | `destroy()` centraliza el ciclo de vida y lo llama `ngOnDestroy`; un criterio de aceptación lo verifica. |
| El motor toca `window`/`document`/canvas en SSR | Se instancia solo en navegador (`afterNextRender`); rutas en `RenderMode.Client`. |
| `W`/`S`/flechas/espacio hacen scroll de la página mientras se juega | `preventDefault` en teclas de juego; listeners activos solo mientras corre; `ESPACIO` solo reinicia (en `gameover`). |
| Canvas responsive deforma la pista (debe ser 4:3) | Plano lógico fijo 800×600; el backing store se escala con `devicePixelRatio` vía `setTransform` manteniendo el aspecto; acotar tamaño mínimo. |
| La IA imbatible desde el inicio hace la partida muy corta y poco puntuable | `AI_MAX_SPEED` base menor que `PADDLE_SPEED`, crece solo por tramos de `speed`; valores de balance ajustables; un test comprueba que la IA no supera su rapidez del tramo. |
| Aceleración sin tope hace la bola incontrolable (imposible puntuar) | `BALL_SPEED_MAX` capa la rapidez; la subida por golpe (`SPEED_UP`) es acotada; `dt` del bucle también capado para no "atravesar" palas a alta velocidad (comprobación de colisión robusta). |
| Saque aleatorio rompería el determinismo de los tests | El saque es determinista (hacia el lado que marcó/encajó, vertical alternando); sin `Math.random` en `update(dt)`. |
| Doble toggle de pausa si el motor también bindea `P` | El motor **no** bindea `P`; la pausa la dispara solo el componente (`P`/`Esc`/botón) vía `pause()`/`resume()`. |
| Tests que dependen del canvas real (jsdom no implementa `2d`) | El motor se testea por lógica (rebotes/AABB/vidas/score/aceleración/IA) sin `getContext`; `draw()` aislado; en el componente se stubbea RAF. |
| Fallo de red/RLS al guardar deja al jugador sin feedback | `save()` async devuelve `{ ok, error? }`; la UI muestra "GUARDANDO…", error y reintento; sin escritura silenciosa. |

---

## Lo que **no** entra en este spec

- Modo 2 jugadores local (duelo en el mismo teclado): lo cubre la Variante A; si llega aquí, en su propio spec.
- Dificultad de la IA configurable o selección manual de nivel.
- Sonido/música, power-ups, obstáculos, muros interiores.
- Multijugador online/en red, emparejamiento, salas.
- Derivar `best`/`plays` de `scores`, realtime, migraciones versionadas, auth ligada a `scores`.
- Internacionalización.

Cada uno, si llega, va en su propio spec.
