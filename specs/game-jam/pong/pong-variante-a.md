# JAM · PONG — Variante A (Duelo local a 2 jugadores + IA, carrera a 11)

> **Estado:** Borrador
> **Tipo:** Game Jam — variante A de 2 (numeración aislada; promover a `specs/NN-juego-<slug>.md` al aprobar)
> **Juego:** Pong (nuevo juego real desde cero)
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-10-19
> **Objetivo:** Crear Pong (variante duelo VERSUS local 2P + 1P vs IA, carrera a 11) como motor TS agnóstico + componente Angular dedicado, jugable en `jugar/pong`, con leaderboard real en Supabase.

---

## Por qué existe este spec

El catálogo tiene hoy las cuatro categorías de `CATS` ocupadas salvo **VERSUS**, que está vacío (`asteroides` SHOOTER, `bloque-buster`/`snake` ARCADE, `caida` PUZZLE). Pong es el juego de versus por antonomasia y llena ese hueco con el mínimo esfuerzo: dos palas, una bola y un rebote. Esta variante apuesta por el **duelo local a 2 jugadores en el mismo teclado** como protagonista (lo que de verdad estrena la categoría VERSUS en el Vault), con un **modo 1P vs IA** como alternativa que es la que alimenta el leaderboard.

La variante tiene tres particularidades que motivan sus decisiones:

1. **Dos modos en un mismo juego:** `duo` (2 jugadores local, el protagonista) y `cpu` (1 jugador vs IA). El jugador elige modo en el reproductor; el motor reinicia la partida al cambiar.
2. **Score individual en un juego de 2 jugadores** (riesgo medio): el guardado del Salón asume una puntuación individual. Se resuelve **guardando solo en modo `cpu`** (score = puntos del humano); en modo `duo` se muestra el ganador pero **no se guarda** (no hay score individual que tenga sentido en el ranking).
3. **Partida finita, carrera a un objetivo:** el primero en llegar a **11** gana; `phase` va de `playing` a `gameover`. No hay vidas ni niveles (eso lo explora la variante B).

Reutiliza la fontanería ya genérica (SPEC 05/06): el patrón "motor TS aislado + componente dedicado + ruta propia + guardado en el Salón" y las tablas `games`/`scores` de Supabase. No toca los servicios ni los consumidores del catálogo.

> **Alternativa mutuamente excluyente.** Esta es la **Variante A** de un game jam de Pong. Comparte identidad de catálogo (`id` `pong`, título `PONG`, categoría `VERSUS`, color `yellow`, posición 4) con la **Variante B** (`pong-variante-b.md`). Se implementa **una sola**: aprobar una variante y promoverla a `specs/NN-juego-pong.md` descarta la otra.

---

## Alcance

**Dentro:**

- **Juego nuevo `pong`** (PONG, VERSUS) en el catálogo `games`, **`playable: true`**, creado vía **`INSERT`** (no UPDATE — es un juego nuevo, no hay fila placeholder): `cover` = `cover-pong` (clase **nueva** en `styles.css`), `color` = `yellow` (único color de la paleta sin usar aún), `position` = 4 (siguiente tras `snake`), `best` = 0, `plays` = `'—'` (juego real recién creado, sin estadísticas sembradas falsas).
- **Dos modos de juego** gobernados por el motor: `duo` (2 jugadores local, protagonista) y `cpu` (1 jugador vs IA). El modo por defecto al cargar es **`cpu`** (para que un visitante en solitario pueda jugar y puntuar de inmediato); el modo `duo` está a un clic. Cambiar de modo **reinicia** la partida.
- **Motor TS aislado** `src/app/games/pong/pong-engine.ts`: Pong **procedural** desde cero, agnóstico de framework (no importa nada de Angular). API pública espejo de `AsteroidsEngine`/`BloqueBusterEngine`: `start()`, `pause()`, `resume()`, `restart()`, `destroy()`, `setInput(action, pressed)`, `getState()`, callback `onState`, más `setMode(mode)`. Implementa: pista con dos palas (izquierda/derecha), bola con vector de velocidad, **rebote AABB** bola↔pala (patrón portado de `bloque-buster-engine.ts`), rebote en muros superior/inferior, zonas de gol izquierda/derecha, saque, aceleración de la bola por golpe (hasta un tope), control de ángulo según el punto de impacto en la pala, IA del lado derecho en modo `cpu`, y carrera a 11.
- **Física de rebote reutilizada:** `collideAABB(pala, bola)` clonado del patrón de Bloque Buster; al golpear, se invierte la componente `x` de la velocidad, se fija la componente `y` según el **offset del impacto respecto al centro de la pala** (ángulo clásico de Pong) y se incrementa la rapidez un factor por golpe hasta `BALL_SPEED_MAX`.
- **Saque determinista** (sin RNG en la lógica jugable): tras un punto la bola vuelve al centro y sale **hacia el lado que acaba de encajar el gol**, con la componente vertical alternando de signo; hay un pequeño retardo de saque gestionado por un temporizador **dentro de `phase: 'playing'`** (sin fase intermedia). Esto mantiene `update(dt)` determinista y testeable.
- **IA beatable (modo `cpu`):** la pala derecha persigue la `y` de la bola con una rapidez máxima `AI_MAX_SPEED` y una **zona muerta** alrededor del centro de la pala, de modo que es vencible por un humano. En modo `duo` la pala derecha la controla el jugador 2 y la IA no interviene.
- **Redibujo neón vectorial** (sin assets): palas, bola y **red central discontinua** se dibujan con formas y glow en canvas; sin sprites ni imágenes. El marcador grande puede dibujarse tenue en el canvas, pero el HUD oficial vive en el DOM (ver abajo).
- **Componente dedicado** `Pong` en la ruta **`jugar/pong`** (declarada **antes** de `jugar/:id`). Hospeda el `<canvas>`; instancia el motor solo en navegador y lo destruye en `ngOnDestroy`.
- **HUD DOM neón** alimentado por `onState`: marcador **IZQUIERDA : DERECHA** (etiquetas `TÚ`/`IA` en modo `cpu`, `JUGADOR 1`/`JUGADOR 2` en modo `duo`), objetivo (11) y el **selector de modo** (botones `1 JUGADOR` / `2 JUGADORES`).
- **Overlay en el canvas** dibujado por el motor para PAUSA ("EN PAUSA") y fin de partida (marcador final + "GANA TÚ/IA" en `cpu`, "GANA JUGADOR 1/2" en `duo`). **Reinicio con `ESPACIO`** en `gameover`.
- **Canvas responsive con resolución lógica fija:** la simulación corre en un plano lógico fijo **800×600** (aspecto 4:3, como Bloque Buster); el motor escala el backing store al contenedor con `devicePixelRatio` en `resize`/`ResizeObserver` y mapea el `draw()` con `setTransform`. La pista no se deforma (no se recalcula W/H como en Asteroides).
- **Controles:** teclado — pala izquierda `W`/`S`, pala derecha `↑`/`↓` (en modo `cpu` la pala izquierda es la del humano y también responde a `↑`/`↓` para comodidad del jugador en solitario; la derecha la lleva la IA). **Controles táctiles** en pantalla: dos clústeres verticales (izquierda ↑/↓, derecha ↑/↓) vía `setInput`; en modo `cpu` el clúster derecho se oculta/deshabilita.
- **Pausa** (`P`/`Esc` + botón de la plataforma) que congela el bucle y muestra "EN PAUSA". **La pausa la dispara el componente** (el motor no bindea `P`, para evitar doble toggle).
- **Guardado en el Salón con botón aparte, SOLO en modo `cpu`:** en `gameover` y `mode === 'cpu'`, botón "GUARDAR PUNTUACIÓN" (iniciales por defecto `SessionService.user()?.name ?? 'INVITADO'`) → `ScoresService.save({ game: 'pong', score, name })` con **`score` = puntos del humano** (`scoreLeft`). Estados "GUARDANDO…"/confirmación/error+reintento, sin doble guardado. En modo `duo`, el bloque de guardado se sustituye por un banner de ganador y una nota "el duelo local no se guarda en el Salón".
- **Portada CSS-only `cover-pong`** nueva en `styles.css` (dos palas + bola + red, estilo del resto de `cover-*`).
- **Estilos** nuevos en `src/styles.css` (canvas 4:3 dentro del CRT, los dos clústeres táctiles verticales, el selector de modo), coordinando `frontend-design` + `ui-ux-pro-max`.
- **Tests Vitest:** unitarios del motor (lógica pura) y smoke del componente.

**Fuera de alcance (para futuros specs):**

- **Dificultad de la IA configurable**, varios niveles de IA, o IA que aprenda: la IA es una sola, fija y beatable.
- **Objetivo configurable** (a 11 fijo; no se ofrece "a 5"/"a 21" ni modo sin fin): el modelo de supervivencia con vidas y aceleración lo explora la **Variante B**.
- **Sonido/música** (rebote, gol): esta variante es muda (vectores neón, sin audio) — lo difiere, coherente con el enfoque de bajo esfuerzo.
- **Power-ups** (bola doble, pala ancha, efecto), obstáculos en la pista, muros interiores, saque con efecto manual.
- **Multijugador online / en red**, emparejamiento, salas: VERSUS aquí es **local** (mismo teclado) o contra IA; la red queda para otro spec (arrastra auth/realtime).
- **Guardar el resultado del duelo `duo`** en el Salón: no hay score individual; solo se guarda el modo `cpu`.
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
  'Duelo de palas: el primero en llegar a 11 gana.',
  'El clásico de los clásicos, ahora en el Vault. Mueve tu pala, devuelve la bola y cuela el punto en el lado contrario. Juega un duelo local a dos en el mismo teclado o mide tu reflejo contra la IA; la bola acelera con cada golpe hasta que alguien llega a 11.',
  'VERSUS', 'cover-pong', 'yellow', 0, '—', true, 4
);
```

Resultado esperado del catálogo (5 filas, todas jugables): `asteroides` (0), `bloque-buster` (1), `caida` (2), `snake` (3), `pong` (4).

Contrato que el motor notifica al componente (ni el motor ni el contrato conocen Angular):

```ts
// src/app/games/pong/pong-engine.ts
export type PongPhase = 'playing' | 'gameover'; // partida finita: gana quien llega a TARGET

export type PongMode = 'cpu' | 'duo'; // 1 jugador vs IA | 2 jugadores local

export interface PongState {
  mode: PongMode;
  scoreLeft: number;             // puntos de la pala izquierda (el humano en modo cpu)
  scoreRight: number;            // puntos de la pala derecha (la IA en modo cpu)
  target: number;                // objetivo de la carrera (11)
  winner: 'left' | 'right' | null;
  phase: PongPhase;
}

export type TouchAction = 'leftUp' | 'leftDown' | 'rightUp' | 'rightDown'; // dos clústeres verticales

export interface PongEngineOptions {
  onState?: (s: PongState) => void; // invocado solo cuando cambia el estado observable (dedupe)
  mode?: PongMode;                  // modo inicial (por defecto 'cpu')
}

export class PongEngine {
  constructor(canvas: HTMLCanvasElement, opts?: PongEngineOptions);
  start(): void;
  pause(): void;                                     // cancela RAF y pinta "EN PAUSA" en el canvas
  resume(): void;
  restart(): void;                                   // reinicia la partida (equivalente a ESPACIO en gameover)
  setInput(a: TouchAction, pressed: boolean): void;  // táctil → mismos flags que el teclado
  setMode(mode: PongMode): void;                     // cambia de modo y reinicia la partida
  getState(): PongState;
  destroy(): void;                                   // cancela RAF, quita listeners de teclado/resize, ResizeObserver
}
```

Constantes y convenciones (exportadas para tests): plano lógico `W` (800) / `H` (600); `PADDLE_W` (14) / `PADDLE_H` (96) / `PADDLE_SPEED` (460 px/s); `BALL` (14, lado del cuadrado neón); `BALL_SPEED_0` (360) / `BALL_SPEED_MAX` (820) / `SPEED_UP` (×1.05 por golpe hasta el tope); `TARGET` (11); `AI_MAX_SPEED` (≈ 380 px/s, menor que `PADDLE_SPEED` para que sea vencible) y `AI_DEADZONE` (zona muerta alrededor del centro de la pala). El rebote bola↔pala usa `collideAABB` (patrón de Bloque Buster): invierte `vx`, fija `vy` según el offset del impacto respecto al centro de la pala, y multiplica la rapidez por `SPEED_UP` hasta `BALL_SPEED_MAX`. Muros superior/inferior invierten `vy`. Gol cuando la bola cruza el borde izquierdo/derecho → punto para el lado opuesto y saque hacia el que encajó (vertical alternando de signo, **sin RNG**). El estado observable para `onState` es `mode`/`scoreLeft`/`scoreRight`/`winner`/`phase` (`target` es constante). El `name` se normaliza a mayúsculas y se acota a ≤ 12 caracteres.

---

## Plan de implementación

Numerado; cada paso deja la app compilando y navegable.

1. **Ruta + cascarón.** Crear un componente `Pong` mínimo en `src/app/games/pong/pong.ts|html`; declarar `{ path: 'jugar/pong', component: Pong }` en `src/app/app.routes.ts` **antes** de `{ path: 'jugar/:id', component: GamePlayer }` (import incluido). Prueba: `/jugar/pong` renderiza el cascarón; `/jugar/<otro>` sigue abriendo el `GamePlayer` simulado; `npm run build` compila. (El catálogo y los estilos van en pasos 5–6.)
2. **Motor.** Crear `src/app/games/pong/pong-engine.ts` desde cero, procedural: pista 800×600, dos palas con su `y` y `vy`, bola con `x`/`y`/`vx`/`vy`, `collideAABB` (clonado del patrón de Bloque Buster), rebote en muros superior/inferior, control de ángulo por offset de impacto, aceleración por golpe hasta `BALL_SPEED_MAX`, gol y saque determinista hacia el lado que encajó, carrera a `TARGET` → `winner` + `phase: 'gameover'`, IA del lado derecho en modo `cpu` (persigue la bola con `AI_MAX_SPEED` + `AI_DEADZONE`), `setMode` que reinicia. Infra espejo de los otros motores: resolución **lógica fija 800×600** con backing store `devicePixelRatio` recalculado en `resize` + `ResizeObserver` y `setTransform`; listeners de teclado propios con `preventDefault` en `W`/`S`/flechas/espacio, **activos solo mientras el motor corre** (`W`/`S` = pala izquierda, `↑`/`↓` = pala derecha y, en `cpu`, también izquierda; `Espacio` = reinicio en `gameover`); `setInput` para los clústeres táctiles; `emitState` con dedupe que invoca `onState` al cambiar `mode`/`scoreLeft`/`scoreRight`/`winner`/`phase`; `pause`/`resume`/`restart`/`destroy`; el motor dibuja "EN PAUSA" y el fin de partida en el canvas. `update(dt)` público y **sin tocar `ctx`** (testeable); `draw()` aislado; `dt` capado. **La pausa por `P`/`Esc` la dispara el componente** (el motor no bindea `P`). Prueba: tests del paso 7 + humo manual.
3. **Componente.** `src/app/games/pong/pong.ts|html` (standalone, signals, `imports: [EsNumberPipe, RouterLink]`, `host: { class: 'av-player fade-in' }`, `implements OnDestroy`). `viewChild.required` del `<canvas #canvas>`. Instanciar el motor **solo en navegador** con `afterNextRender` + `NgZone.runOutsideAngular` (sin `isPlatformBrowser` redundante), pasando `onState: s => zone.run(() => this.applyState(s))` y `mode` inicial (`cpu`); `engine.start()`; `destroy()` en `ngOnDestroy`. Signals espejo `mode`/`scoreLeft`/`scoreRight`/`winner`/`phase` + UI `paused`/`saved`/`saving`/`saveError`/`name`. Handler aparte de `keydown` para `P`/`Escape` → pausa (con `preventDefault`), guardado en campo y retirado en `ngOnDestroy`. `applyState(s)` copia a signals y, si detecta reinicio (`phase === 'playing'` tras `saved`/`saveError`), rehabilita el guardado. Selector de modo: botones que llaman `engine.setMode('cpu'|'duo')`. Táctil `press(action, pressed, e)` → `preventDefault` + `engine.setInput`. Prueba: jugar en ambos modos, pausar, terminar, cambiar de modo, salir sin dejar RAF/listeners vivos.
4. **HUD + guardado (HTML).** Marco CRT reutilizado: `.player-hud` con el marcador IZQUIERDA : DERECHA (etiquetas según modo), el objetivo (11) y el **selector de modo** (`1 JUGADOR` / `2 JUGADORES`), más `.hud-actions` (PAUSA/REANUDAR, SALIR). `.crt > .crt-screen` con `<canvas #canvas>`; `.touch-controls` con dos clústeres verticales (izq ↑/↓, der ↑/↓; pointerdown/up/leave/cancel → `press`), el derecho oculto en modo `cpu`. `@if (phase() === 'gameover')`: si `mode() === 'cpu'`, bloque `.av-save` con marcador final, input de iniciales, botón cuyo label es `saving() ? 'GUARDANDO…' : saveError() ? 'REINTENTAR' : 'GUARDAR PUNTUACIÓN'`, línea de error opcional y "VOLVER AL VAULT"; si `mode() === 'duo'`, banner "GANA JUGADOR 1/2" + nota "el duelo local no se guarda en el Salón" + "VOLVER AL VAULT". El guardado llama `ScoresService.save({ game: 'pong', score: this.scoreLeft(), name: this.name() })` solo en `gameover` **y** `mode === 'cpu'`, sin doble guardado. Prueba: en `gameover` de `cpu` el botón guarda una vez; en `duo` no hay botón de guardar; el HUD DOM coincide con la partida.
5. **Catálogo + estilos.** Vía MCP (paso 6 lo detalla) `INSERT` de `pong`; sincronizar `src/app/data/games.data.ts` (añadir la 5.ª entrada `pong`, `playable: true`) y `GAMES_FIXTURE` (5 filas) + el conteo en `games.service.spec.ts`. Verificar que `pong` aparece sin "PRÓXIMAMENTE" y que `/juego/pong` funciona. Añadir a `src/styles.css`: la **portada `cover-pong`** (dos palas + bola + red, estilo de los `cover-*` existentes), el canvas **4:3** dentro del CRT (clonar el cuerpo de `.asteroids-canvas` como `.pong-canvas` por el aspecto distinto), los dos clústeres táctiles verticales y el selector de modo. Reutilizar lo existente (`.soon-badge.lg`, marco CRT, `.game-overlay`, `.touch-controls`/`.touch-cluster`/`.touch-btn`, `.av-save`, `@media prefers-reduced-motion`). Coordinar `frontend-design` + `ui-ux-pro-max` (foco visible, contraste, `prefers-reduced-motion` atenúa decoración no jugabilidad, SVG/íconos `aria-hidden`).
6. **Alta en `games` vía MCP.** Con `mcp__supabase__apply_migration` (o `execute_sql`): el `INSERT` de `pong` del Modelo de datos. `scores` no requiere nada. Pruebas (MCP): `select id, playable, position from games order by position` → 5 filas jugables con `pong` en la 4; `select cat from games where id='pong'` → `VERSUS`.
7. **Tests.** `pong-engine.spec.ts` (lógica pura, `new PongEngine(document.createElement('canvas'))`, conduciendo la simulación poniendo posiciones de palas/bola y llamando `update(dt)`; **sin** `getContext`/`draw`): la bola rebota en los muros superior/inferior (invierte `vy`); `collideAABB` con la pala invierte `vx`, fija `vy` por offset y acelera hasta `BALL_SPEED_MAX`; cruzar el borde derecho suma 1 a `scoreLeft` y saca hacia la derecha; llegar a `TARGET` fija `winner` y `phase: 'gameover'`; la IA (modo `cpu`) mueve la pala derecha hacia la bola sin superar `AI_MAX_SPEED`; `setMode('duo')` reinicia marcador y desactiva la IA. `pong.spec.ts` (`TestBed` + `provideRouter([{ path: '', component: Pong }])`; en `beforeEach` stub de RAF: `vi.stubGlobal('requestAnimationFrame', () => 0)` y `cancelAnimationFrame`): monta y refleja `onState` en el HUD DOM; `vi.spyOn(ScoresService,'save').mockResolvedValue({ ok: true })` para verificar que guarda solo en `gameover` **y** `mode === 'cpu'`, envía `{ game: 'pong', score: scoreLeft, name }`, sin doble guardado, y que el error fija `saveError`; que en `duo` no se renderiza el botón de guardar. Ajustar `GAMES_FIXTURE` (5 filas) en `src/app/testing/supabase-mock.ts` y el conteo en `games.service.spec.ts`. Comando: `npx ng test --watch=false`.
8. **Docs.** Actualizar `CLAUDE.md` ("Port status" y el bullet de `games/`): `pong` como **quinto juego real** (motor TS en `games/pong/`, VERSUS, duelo local 2P + 1P vs IA, carrera a 11, guardado solo en `cpu`), creado vía `INSERT`; VERSUS deja de estar vacío.

---

## Criterios de aceptación

- [ ] `npm run build` y `npx ng test --watch=false` terminan sin errores.
- [ ] `pong` existe en `games` con `playable: true`, `cat` `VERSUS`, `cover-pong`, `yellow`, `position` 4, `best` 0, `plays` '—'; aparece sin badge "PRÓXIMAMENTE" en la biblioteca y su ficha `/juego/pong` funciona. El catálogo pasa a 5 filas jugables.
- [ ] `/jugar/pong` carga el componente dedicado `Pong`; `/jugar/<otro-id>` sigue abriendo el `GamePlayer` simulado.
- [ ] En modo `duo` el juego es jugable a dos en el mismo teclado: pala izquierda con `W`/`S`, pala derecha con `↑`/`↓`; y con los dos clústeres táctiles verticales.
- [ ] En modo `cpu` el humano controla la pala izquierda (`W`/`S` o `↑`/`↓`) y la IA la derecha; la IA es vencible (no imbatible).
- [ ] El selector de modo alterna `cpu`/`duo` y reinicia la partida; el HUD etiqueta el marcador según el modo (`TÚ`/`IA` o `JUGADOR 1`/`JUGADOR 2`).
- [ ] La bola rebota en los muros superior/inferior y en las palas (AABB); el ángulo de salida depende del punto de impacto en la pala; la bola acelera con cada golpe hasta un tope.
- [ ] Colar la bola por un lado suma un punto al lado contrario; la bola saca hacia el lado que encajó (saque determinista, sin aleatoriedad).
- [ ] El primero en llegar a 11 gana: el motor pinta el marcador final y el ganador en el canvas; `ESPACIO` reinicia.
- [ ] El HUD DOM neón refleja el estado notificado por el motor (marcador, objetivo, modo); coincide con la partida del canvas.
- [ ] La pausa (`P`/`Esc` o botón) congela el bucle y muestra "EN PAUSA" en el canvas; reanudar continúa sin reiniciar.
- [ ] En `gameover` **de modo `cpu`**, "GUARDAR PUNTUACIÓN" inserta en `scores` con `game_id: 'pong'` y `score` = puntos del humano (`scoreLeft`); muestra "GUARDANDO…", luego confirmación; sin doble guardado; en fallo avisa y permite reintentar; la marca aparece en la pestaña `pong` del Salón ordenada por puntuación.
- [ ] En `gameover` **de modo `duo`** NO hay botón de guardar: se muestra el ganador y la nota de que el duelo local no se guarda.
- [ ] El canvas escala al contenedor preservando su aspecto **4:3**; sin scroll horizontal a 360 px; la resolución interna se recalcula al redimensionar sin deformar la pista.
- [ ] Al abandonar `/jugar/pong` el motor se destruye: sin `requestAnimationFrame` activos ni listeners de teclado/`resize`; `W`/`S`/flechas/espacio no hacen scroll de la página durante el juego.
- [ ] La app renderiza bajo SSR sin tocar `window`/`document`/canvas en servidor (el motor solo se crea en navegador).
- [ ] Ningún componente consulta Supabase directamente; el motor no importa nada de Angular.
- [ ] Sin errores en la consola al jugar en ambos modos, pausar, terminar, cambiar de modo, guardar y salir.

---

## Decisiones tomadas y descartadas

- **Eje diferenciador frente a la Variante B (modos + fin de partida):** esta variante hace **protagonista el duelo local 2P** y ofrece además `cpu`, con un final **finito a 11** (`playing | gameover`, sin vidas). La Variante B hace protagonista el **1P vs IA en solitario** con **supervivencia (3 vidas) + aceleración** y **difiere el 2P local**. Son **alternativas mutuamente excluyentes**: se implementa una sola.
- **Sí:** **crear `pong` vía `INSERT`** (juego nuevo), `cat` `VERSUS`, `color` `yellow` (único libre), `position` 4, `best` 0 / `plays` '—'. **No:** `UPDATE` de una fila placeholder — no existe; SPEC 09 fijó la convención de **crear cada juego al implementarlo**.
- **Sí:** **motor TS aislado procedural desde cero** con la **misma API pública** que `AsteroidsEngine`/`BloqueBusterEngine` (`start/pause/resume/restart/destroy/setInput/getState/onState`) más `setMode`. **No:** reescribir la lógica como servicios Angular.
- **Sí:** **duelo local 2P como protagonista** (estrena de verdad la categoría VERSUS) + modo `cpu`. **No:** limitarse a 1P vs IA (eso es el enfoque de la Variante B).
- **Sí:** **carrera finita a 11** con `winner` y `phase: 'gameover'`. **No:** vidas ni niveles ni partida sin fin — ese modelo es el de la Variante B.
- **Sí:** **guardar en el Salón solo en modo `cpu`** con `score` = puntos del humano (`scoreLeft`); en `duo` mostrar ganador sin guardar. **No:** guardar el duelo local (no hay score individual con sentido en el ranking) — así se resuelve el riesgo de "score individual en un juego de 2 jugadores".
- **Sí:** **redibujo neón vectorial** (palas/bola/red) sin assets ni sonido — enfoque de bajo esfuerzo. **No:** sprites, imágenes ni audio (lo difiere).
- **Sí:** **rebote AABB** reutilizando el patrón probado en `bloque-buster-engine.ts` y **plano lógico fijo 800×600** escalado con `devicePixelRatio`. **No:** recalcular W/H desde el contenedor como en Asteroides — deformaría la pista y las distancias.
- **Sí:** **saque determinista** (hacia el lado que encajó, vertical alternando) para que `update(dt)` sea testeable sin RNG. **No:** saque con dirección aleatoria.
- **Sí:** **IA única y beatable** (persigue la bola con tope de rapidez + zona muerta). **No:** dificultad configurable ni varios niveles de IA (se difiere).
- **Sí:** **controles = teclado (`W`/`S` + `↑`/`↓`) + dos clústeres táctiles verticales**. **No:** arrastre de puntero (encaja mejor en Bloque Buster; aquí dos palas lo complican).
- **Sí:** la **pausa la dispara el componente** (`P`/`Esc`/botón); el motor no bindea `P`. **No:** que motor y componente bindeen `P` a la vez (doble toggle).
- **Sí:** alta de catálogo **vía MCP** (`INSERT`). **No:** versionar SQL en el repo (decisión heredada de SPEC 06).

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Score individual en un juego de 2 jugadores (el Salón asume una puntuación por jugador) | El guardado se **limita al modo `cpu`** con `score` = puntos del humano; en `duo` solo se muestra el ganador, sin escribir en `scores`. Un criterio de aceptación lo verifica. |
| Fugas de `requestAnimationFrame` y listeners de teclado/`resize` al cambiar de ruta | `destroy()` centraliza el ciclo de vida y lo llama `ngOnDestroy`; un criterio de aceptación lo verifica. |
| El motor toca `window`/`document`/canvas en SSR | Se instancia solo en navegador (`afterNextRender`); rutas en `RenderMode.Client`. |
| `W`/`S`/flechas/espacio hacen scroll de la página mientras se juega | `preventDefault` en teclas de juego; listeners activos solo mientras corre; `ESPACIO` solo reinicia (en `gameover`). |
| Canvas responsive deforma la pista (debe ser 4:3) | Plano lógico fijo 800×600; el backing store se escala con `devicePixelRatio` vía `setTransform` manteniendo el aspecto; acotar tamaño mínimo. |
| IA imbatible o demasiado floja (el modo `cpu` no es divertido ni puntuable con sentido) | `AI_MAX_SPEED` menor que `PADDLE_SPEED` + `AI_DEADZONE`; valores de balance ajustables; un test comprueba que la IA no supera su rapidez máxima. |
| Dos jugadores en el mismo teclado con teclas simultáneas que no registran (ghosting) | Teclas separadas por lado (`W`/`S` vs `↑`/`↓`) y seguimiento por `Set` de teclas pulsadas, no por eventos sueltos; `preventDefault` evita el scroll. |
| Saque aleatorio rompería el determinismo de los tests | El saque es determinista (hacia el lado que encajó, vertical alternando); sin `Math.random` en `update(dt)`. |
| Doble toggle de pausa si el motor también bindea `P` | El motor **no** bindea `P`; la pausa la dispara solo el componente (`P`/`Esc`/botón) vía `pause()`/`resume()`. |
| Tests que dependen del canvas real (jsdom no implementa `2d`) | El motor se testea por lógica (rebotes/AABB/gol/carrera a 11/IA/`setMode`) sin `getContext`; `draw()` aislado; en el componente se stubbea RAF. |
| Fallo de red/RLS al guardar deja al jugador sin feedback | `save()` async devuelve `{ ok, error? }`; la UI muestra "GUARDANDO…", error y reintento; sin escritura silenciosa. |

---

## Lo que **no** entra en este spec

- Dificultad de la IA configurable, varios niveles de IA o IA adaptativa.
- Objetivo configurable (a 11 fijo) y el modelo de supervivencia con vidas/aceleración (eso es la Variante B).
- Sonido/música, power-ups, obstáculos, saque con efecto.
- Multijugador online/en red, emparejamiento, salas.
- Guardar el resultado del duelo `duo` en el Salón.
- Derivar `best`/`plays` de `scores`, realtime, migraciones versionadas, auth ligada a `scores`.
- Internacionalización.

Cada uno, si llega, va en su propio spec.
