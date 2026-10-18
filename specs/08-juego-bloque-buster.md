# SPEC 08 — Juego Bloque Buster (port de references/started-games/04-arkanoid)

> **Estado:** Implementado
> **Depende de:** SPEC 05 (motor TS agnóstico + componente dedicado + ruta `jugar/<id>` antes de `jugar/:id`, campo `playable`, marco CRT/overlay/táctil/guardado en `styles.css`), SPEC 06 (tablas `games`/`scores` con RLS, cliente tipado, `GamesService`/`ScoresService` async, Salón por `game_id`)
> **Fecha:** 2026-10-17
> **Objetivo:** Portar el Arkanoid vanilla (`references/started-games/04-arkanoid/game.js` + `levels.js`) a un motor TypeScript agnóstico y un componente Angular dedicado, activando el juego `bloque-buster` (fila ya sembrada) como jugable en `jugar/bloque-buster`, con redibujo neón, sonido y leaderboard real en Supabase.

---

## Por qué existe este spec

La plataforma ya es genérica: SPEC 05 dejó el patrón "motor TS aislado + componente dedicado + ruta propia + guardado en el Salón" probado con Asteroides, y SPEC 06 movió catálogo y puntuaciones a Supabase. La fila `bloque-buster` (BLOQUE BUSTER, ARCADE) ya existe en la tabla `games` como placeholder (`playable: false`), hoy abre el `GamePlayer` simulado. Este spec reutiliza esa fontanería para convertir `bloque-buster` en el **tercer juego real** sin tocar los servicios ni los consumidores del catálogo.

El port tiene cuatro particularidades frente a Asteroides y Caída, que motivan las decisiones de este spec:

1. El original dibuja paleta, bola y bloques desde un **spritesheet PNG** y una explosión de 4 frames. Aquí se decide **redibujar todo con vectores neón en canvas** (sin binario de imagen), de modo que el **recolor neón entra en el alcance** de este spec (a diferencia de SPEC 05/07, que lo aplazaron).
2. El original reproduce **dos efectos de sonido `.mp3`** (rebote de bola, rotura de bloque). Aquí **se portan** esos dos assets, con un **botón de silencio** persistido; es el primer juego real con audio.
3. La paleta del original se mueve con **ratón** (y flechas). Se porta a **teclado + arrastre (pointer) + botones táctiles ←/→** para cubrir escritorio y móvil.
4. Hay **3 vidas** y un **estado de victoria** (`win`) al superar los 5 niveles. Se conservan ambos finales (`gameover` y `win`) y el guardado del Salón aparece en los dos.

Además, la "pausa" del original es en realidad un **menú-truco para saltar de nivel** (clic en 1–5); se **retira** y se sustituye por el overlay estándar "EN PAUSA" de la plataforma.

---

## Alcance

**Dentro:**

- **Activación del juego `bloque-buster`** (BLOQUE BUSTER, ARCADE): la fila ya existe en `games` como placeholder; este spec la pone **`playable: true`** vía MCP. Se **conserva** su `position` (1), su portada `cover-bricks` (ya existe en `styles.css`), su `color` (`cyan`) y sus `best` (28450) / `plays` ("12.4K") sembrados. **UPDATE, no INSERT.**
- **Motor TS aislado** `src/app/games/bloque-buster/bloque-buster-engine.ts`: port fiel y **procedural** de `game.js` + `levels.js`. Agnóstico de framework (no importa nada de Angular). API pública espejo de `AsteroidsEngine`/`CaidaEngine`: `start()`, `pause()`, `resume()`, `restart()`, `destroy()`, `setInput(action, pressed)`, `getState()`, callback `onState`. Porta la paleta, la bola, la rejilla de bloques (10×6), colisiones AABB, rebotes en muros/paleta, los **5 niveles** con velocidad de bola creciente, las **3 vidas**, la puntuación (+10 por bloque) y el fin de partida.
- **Redibujo neón vectorial** (decisión del usuario): paleta, bola, bloques y la **explosión** al romper un bloque se dibujan con **formas y glow en canvas**, sin el spritesheet PNG del original. Los 6–7 nombres de color lógicos de los bloques se **conservan** como claves, pero se pintan con la paleta neón del Vault. El recolor neón es **parte de este spec**, no se aplaza.
- **Sonido portado:** los dos efectos `.mp3` del original (rebote de bola, rotura de bloque) se copian a `public/games/bloque-buster/` y los reproduce el motor **solo en navegador** (precargados, clonados para permitir solapamiento). **Botón de silencio** en el reproductor que alterna el mute del motor, persistido en `localStorage` con clave propia `av_bloque_buster_muted` (solo-navegador).
- **Componente dedicado** `BloqueBuster` en la ruta **`jugar/bloque-buster`** (declarada **antes** de `jugar/:id`). Hospeda el `<canvas>`; instancia el motor solo en navegador y lo destruye en `ngOnDestroy`.
- **HUD DOM neón** (SCORE / VIDAS / NIVEL) en el marco del reproductor, **alimentado por `onState`** del motor. El HUD interno que el original dibujaba en el canvas se **sustituye** por este HUD DOM (las vidas se muestran como contador/iconos neón); el canvas no duplica el HUD.
- **Overlay en el canvas** dibujado por el motor para PAUSA ("EN PAUSA"), GAME OVER (marcador final) y VICTORIA ("¡COMPLETADO!" con marcador). **Reinicio con `ESPACIO`** en ambos estados terminales (estilo Asteroides/Caída).
- **3 vidas y estado de victoria:** `phase` es `'playing' | 'gameover' | 'win'`. Al perder la bola con 0 vidas → `gameover`; al limpiar los bloques del nivel 5 → `win`. Ambos son estados terminales.
- **Canvas responsive con resolución lógica fija:** la simulación corre en un plano lógico fijo **800×600** (aspecto 4:3); el motor escala el backing store al contenedor con `devicePixelRatio` en `resize`/`ResizeObserver` y mapea el `draw()` con `setTransform`. No se deforma la rejilla de bloques (no se recalcula W/H como en Asteroides).
- **Controles:** teclado `←`/`→` (mueven la paleta a `PADDLE_SPEED`), **arrastre** con dedo/ratón sobre el canvas (el motor mapea las coordenadas de puntero a las lógicas y fija la `x` de la paleta), y **botones táctiles ←/→** en pantalla (vía `setInput`). Todos coexisten.
- **Pausa** (`P`/`Esc` + botón de la plataforma) que congela el bucle y muestra el overlay "EN PAUSA". **La pausa la dispara el componente** (el motor no bindea `P`, para evitar doble toggle).
- **Guardado en el Salón con botón aparte:** en `gameover` **y** en `win`, botón "GUARDAR PUNTUACIÓN" (iniciales por defecto `SessionService.user()?.name ?? 'INVITADO'`) → `ScoresService.save({ game: 'bloque-buster', score, name })` (async). Estados "GUARDANDO…"/confirmación/error+reintento, sin doble guardado.
- **Retiro del badge "PRÓXIMAMENTE"** para `bloque-buster` (consecuencia de `playable: true`): la tarjeta de biblioteca y la ficha dejan de mostrarlo.
- **Estilos** nuevos en `src/styles.css` (canvas de aspecto 4:3 dentro del CRT, controles táctiles del juego, botón de silencio), coordinando `frontend-design` + `ui-ux-pro-max`.
- **Tests Vitest:** unitarios del motor (lógica pura) y smoke del componente.

**Fuera de alcance (para futuros specs):**

- Convertir en reales los otros juegos simulados (`serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`): siguen con el `GamePlayer` simulado.
- El **menú-truco de salto de nivel** del original (clic en 1–5 en la pausa): se retira, no se porta.
- **Power-ups** (paleta ancha, multibola, láser), ladrillos de varios golpes o irrompibles, más de 5 niveles, editor de niveles.
- **Música de fondo** y más efectos de sonido además de los dos portados; ecualización/volumen por canal.
- Dificultad configurable, logros, marcador online en vivo.
- Derivar `best`/`plays` de `scores`, realtime del Salón, migraciones SQL versionadas, auth ligada a `scores`.
- Internacionalización (la UI queda solo en español).

---

## Modelo de datos

No introduce tablas nuevas: reutiliza `games` y `scores` de SPEC 06. `scores` **no cambia** (tabla única por `game_id`; el leaderboard ya consulta `game_id = 'bloque-buster'`). Introduce la **activación de una fila de catálogo** y un **contrato de estado motor → componente**.

Fila existente en `public.games` — se actualiza (vía MCP; ver Plan):

```sql
update public.games set playable = true where id = 'bloque-buster';
-- position (1), cover ('cover-bricks'), color ('cyan'), best (28450), plays ('12.4K'): SIN CAMBIOS.
```

Contrato que el motor notifica al componente (ni el motor ni el contrato conocen Angular):

```ts
// src/app/games/bloque-buster/bloque-buster-engine.ts
export type BloqueBusterPhase = 'playing' | 'gameover' | 'win'; // 3 vidas + victoria al superar el nivel 5

export interface BloqueBusterState {
  score: number;
  lives: number;
  level: number;        // 1..5
  phase: BloqueBusterPhase;
}

export type TouchAction = 'left' | 'right'; // botones ←/→; el arrastre va aparte (pointer sobre el canvas)

export interface BloqueBusterEngineOptions {
  onState?: (s: BloqueBusterState) => void; // invocado solo cuando cambia el estado observable (dedupe)
  muted?: boolean;                          // estado inicial del silencio (lo lee el componente de localStorage)
}

export class BloqueBusterEngine {
  constructor(canvas: HTMLCanvasElement, opts?: BloqueBusterEngineOptions);
  start(): void;
  pause(): void;                                     // cancela RAF y pinta "EN PAUSA" en el canvas
  resume(): void;
  restart(): void;                                   // reinicia la partida (equivalente a ESPACIO en gameover/win)
  setInput(a: TouchAction, pressed: boolean): void;  // táctil ←/→ → mismos flags que el teclado
  setMuted(muted: boolean): void;                    // silencia/activa los dos efectos
  getState(): BloqueBusterState;
  destroy(): void;                                   // cancela RAF, quita listeners de teclado/puntero/resize, ResizeObserver
}
```

Constantes portadas del original (exportadas para tests): resolución lógica `W` (800) / `H` (600); `PADDLE_SPEED` (400); rejilla `BLOCK_COLS` (10) / `BLOCK_ROWS` (6) / `BLOCK_W` (64) / `BLOCK_H` (24) y su origen centrado; `BASE_BALL_VX` (200) / `BASE_BALL_VY` (−300); `SCORE_PER_BLOCK` (10); `LIVES` (3); `EXPLOSION_DURATION` (ms); `LEVELS` (5 niveles con `speed` 1.00/1.10/1.21/1.33/1.46 y sus `blocks[]` generados, port de `levels.js`). El estado observable para `onState` es `score`/`lives`/`level`/`phase`. El `name` se normaliza a mayúsculas y se acota a ≤ 12 caracteres. El silencio persiste en `localStorage` (`av_bloque_buster_muted`) **solo en navegador**. Los 6–7 nombres de color lógicos de los bloques (`red`/`yellow`/`cyan`/`magenta`/`hotpink`/`green`/`gray`) se conservan como claves y se mapean a la paleta neón al dibujar.

---

## Plan de implementación

Numerado; cada paso deja la app compilando y navegable.

1. **Ruta + cascarón.** Crear un componente `BloqueBuster` mínimo en `src/app/games/bloque-buster/bloque-buster.ts|html`; declarar `{ path: 'jugar/bloque-buster', component: BloqueBuster }` en `src/app/app.routes.ts` **antes** de `{ path: 'jugar/:id', component: GamePlayer }` (import incluido). Prueba: `/jugar/bloque-buster` renderiza el cascarón; `/jugar/<otro>` sigue abriendo el `GamePlayer` simulado; `npm run build` compila. (El badge y la activación de catálogo van en el paso 6.)
2. **Assets de sonido.** Copiar `ball-bounce.mp3` y `break-sound.mp3` del original a `public/games/bloque-buster/` (Angular sirve `public/` en la raíz web; se referencian como `/games/bloque-buster/<archivo>.mp3`). No se copia el spritesheet PNG (se redibuja). Prueba: los archivos existen y el build los incluye en `dist`.
3. **Motor.** Crear `src/app/games/bloque-buster/bloque-buster-engine.ts` portando `game.js` + `levels.js` de forma procedural: paleta, bola, `loadLevel`/`initBall`, colisión `collideAABB`, rebotes en muros/paleta, colisión con bloques (+10, explosión, avance de nivel), 3 vidas, `win` al limpiar el nivel 5, `LEVELS` (velocidad creciente). Cambios respecto al original: resolución **lógica fija 800×600** con backing store `devicePixelRatio` recalculado en `resize` + `ResizeObserver`; listeners de teclado propios con `preventDefault` en flechas/espacio, **activos solo mientras el motor corre** (`←`/`→` mueven, `Espacio` reinicia en gameover/win); **arrastre de puntero sobre el canvas** que mapea `clientX` a coordenada lógica y fija `paddle.x`; `setInput('left'|'right')` para los botones táctiles; `emitState` con dedupe que invoca `onState` al cambiar `score`/`lives`/`level`/`phase`; `pause`/`resume`/`restart`/`destroy`; `setMuted`; reproducción de los dos `.mp3` solo en navegador (precarga + clon para solapar, respetando el flag de mute); el motor dibuja los overlays "EN PAUSA"/"GAME OVER"/"¡COMPLETADO!" y la **explosión neón** al romper bloque. `update(dt)` público y **sin tocar `ctx`** (testeable); `draw()` aislado; `dt` capado. **La pausa por `P`/`Esc` la dispara el componente** (el motor no bindea `P`). Prueba: tests del paso 7 + humo manual.
4. **Componente.** `src/app/games/bloque-buster/bloque-buster.ts|html` (standalone, signals, `imports: [EsNumberPipe, RouterLink]`, `host: { class: 'av-player fade-in' }`, `implements OnDestroy`). `viewChild.required` del `<canvas #canvas>`. Leer el mute de `localStorage` (`av_bloque_buster_muted`, solo-navegador). Instanciar el motor **solo en navegador** con `afterNextRender` + `NgZone.runOutsideAngular` (sin `isPlatformBrowser` redundante), pasando `onState: s => zone.run(() => this.applyState(s))` y `muted`; `engine.start()`; `destroy()` en `ngOnDestroy`. Signals espejo `score`/`lives`/`level`/`phase` + UI `paused`/`saved`/`saving`/`saveError`/`name`/`muted`. Handler aparte de `keydown` para `P`/`Escape` → pausa (con `preventDefault`), guardado en campo y retirado en `ngOnDestroy`. `applyState(s)` copia a signals y, si detecta reinicio (`phase === 'playing'` tras `saved`/`saveError`), rehabilita el guardado. Táctil `press(action, pressed, e)` → `preventDefault` + `engine.setInput`. Botón de silencio: alterna `muted`, llama `engine.setMuted`, persiste en `localStorage`. Prueba: jugar, pausar, morir/ganar, silenciar, salir sin dejar RAF/listeners vivos.
5. **HUD + guardado (HTML).** Marco CRT reutilizado: `.player-hud` con SCORE/VIDAS/NIVEL (via `onState`), el botón de silencio y `.hud-actions` (PAUSA/REANUDAR, SALIR). `.crt > .crt-screen` con `<canvas #canvas>`; `.touch-controls` con 2 botones ←/→ (pointerdown/up/leave/cancel → `press`). `@if (phase() === 'gameover' || phase() === 'win')` bloque `.av-save` con marcador final, input de iniciales, botón cuyo label es `saving() ? 'GUARDANDO…' : saveError() ? 'REINTENTAR' : 'GUARDAR PUNTUACIÓN'`, línea de error opcional y "VOLVER AL VAULT" (`RouterLink` a `''`). El guardado llama `ScoresService.save({ game: 'bloque-buster', score: this.score(), name: this.name() })` solo en estados terminales, sin doble guardado. Prueba: en `gameover`/`win` el botón guarda una vez y refleja estado; el HUD DOM coincide con la partida.
6. **Catálogo + estilos.** Vía MCP (paso siguiente lo detalla) poner `bloque-buster.playable = true`; verificar que la tarjeta/ficha de `bloque-buster` **ya no** muestra "PRÓXIMAMENTE" y que `/juego/bloque-buster` funciona. Añadir a `src/styles.css`: canvas de aspecto **4:3** dentro del CRT (sin desbordar a 360 px; clonar el cuerpo de `.asteroids-canvas` como `.bloque-buster-canvas` por el aspecto distinto), estilo de los 2 controles táctiles y del botón de silencio. Reutilizar lo existente (`.soon-badge.lg`, marco CRT, `.game-overlay`, `.touch-controls`/`.touch-cluster`/`.touch-btn`, `.av-save`, `@media prefers-reduced-motion`). Coordinar `frontend-design` + `ui-ux-pro-max` (foco visible, contraste, `prefers-reduced-motion` atenúa decoración no jugabilidad, SVG/íconos `aria-hidden`).
7. **Alta en `games` vía MCP.** `UPDATE public.games SET playable = true WHERE id = 'bloque-buster';` con `mcp__supabase__apply_migration` (o `execute_sql`). `position`/`cover`/`color`/`best`/`plays` sin cambios. `scores` no requiere nada. Prueba (MCP): `select playable from games where id='bloque-buster'` → `true`.
8. **Tests + Docs.** `bloque-buster-engine.spec.ts` (lógica pura, `new BloqueBusterEngine(document.createElement('canvas'))`, conduciendo la simulación con paleta/bola/bloques y `update(dt)`; **sin** `getContext`/`draw`): rebote en los 3 muros y en la paleta; colisión con bloque suma `SCORE_PER_BLOCK`, lo marca muerto y genera explosión; limpiar todos los bloques avanza de nivel y, en el nivel 5, pasa a `win`; perder la bola resta una vida y al llegar a 0 pasa a `gameover`; `LEVELS` aplica la velocidad por nivel. `bloque-buster.spec.ts` (`TestBed` + `provideRouter([{ path: '', component: BloqueBuster }])`; en `beforeEach` stub de RAF: `vi.stubGlobal('requestAnimationFrame', () => 0)` y `cancelAnimationFrame`): monta y refleja `onState` en el HUD DOM; `vi.spyOn(ScoresService,'save').mockResolvedValue({ ok: true })` para verificar que guarda solo en `gameover`/`win`, envía `{ game: 'bloque-buster', score, name }`, sin doble guardado, y que el error fija `saveError`; que el botón de silencio alterna `muted`. Ajustar `GAMES_FIXTURE` en `src/app/testing/supabase-mock.ts` y el conteo en `games.service.spec.ts` si procede. Comando: `npx ng test --watch=false`. Actualizar `CLAUDE.md` ("Port status" y el bullet de `games/`): `bloque-buster` como **tercer juego real** (Arkanoid), motor TS en `games/bloque-buster/`, activado vía `UPDATE playable=true`, con redibujo neón y sonido; los demás siguen simulados.

---

## Criterios de aceptación

- [ ] `npm run build` y `npx ng test --watch=false` terminan sin errores.
- [ ] `bloque-buster` tiene `playable: true` en `games` (y `position` 1, `cover-bricks`, `cyan`, `best` 28450 / `plays` "12.4K" intactos); aparece sin badge "PRÓXIMAMENTE" en la biblioteca y su ficha `/juego/bloque-buster` funciona.
- [ ] `/jugar/bloque-buster` carga el componente dedicado `BloqueBuster`; `/jugar/<otro-id>` sigue abriendo el `GamePlayer` simulado.
- [ ] El juego es jugable con teclado (`←`/`→` mueven la paleta), con **arrastre** de dedo/ratón sobre el canvas, y con los **botones táctiles ←/→**.
- [ ] La bola rebota en los muros izquierdo/derecho/superior y en la paleta; romper un bloque suma 10 puntos y dibuja una **explosión neón**.
- [ ] Hay 5 niveles con layouts distintos y velocidad de bola creciente; al limpiar un nivel se carga el siguiente; al limpiar el nivel 5 la partida pasa a `win` ("¡COMPLETADO!").
- [ ] Hay 3 vidas; perder la bola resta una vida; con 0 vidas la partida pasa a `gameover` (marcador final en el canvas); `ESPACIO` reinicia en `gameover` y en `win`.
- [ ] El HUD DOM neón (SCORE/VIDAS/NIVEL) refleja el estado notificado por el motor; el canvas no duplica el HUD.
- [ ] Los gráficos (paleta, bola, bloques, explosión) se dibujan con **vectores neón**, sin spritesheet PNG; no se añade ningún `.png` al repo para este juego.
- [ ] Suenan los dos efectos (rebote, rotura) al jugar; el **botón de silencio** los apaga/enciende y el estado se **persiste** en `localStorage` (`av_bloque_buster_muted`).
- [ ] La pausa (`P`/`Esc` o botón) congela el bucle y muestra "EN PAUSA" en el canvas; reanudar continúa sin reiniciar; no existe el menú-truco de salto de nivel.
- [ ] En `gameover` **y** en `win`, "GUARDAR PUNTUACIÓN" inserta en `scores` con `game_id: 'bloque-buster'`, el score final y las iniciales; muestra "GUARDANDO…", luego confirmación; sin doble guardado; en fallo avisa y permite reintentar; la marca aparece en la pestaña `bloque-buster` del Salón ordenada por puntuación.
- [ ] El canvas escala al contenedor preservando su aspecto **4:3**; sin scroll horizontal a 360 px; la resolución interna (backing store) se recalcula al redimensionar sin deformar la rejilla.
- [ ] Al abandonar `/jugar/bloque-buster` el motor se destruye: sin `requestAnimationFrame` activos ni listeners de teclado/puntero/`resize`; las flechas/espacio no hacen scroll de la página durante el juego.
- [ ] La app renderiza bajo SSR sin tocar `window`/`document`/canvas/`Audio`/`localStorage` en servidor (el motor solo se crea en navegador).
- [ ] Ningún componente consulta Supabase directamente; el motor no importa nada de Angular.
- [ ] Sin errores en la consola al jugar, pausar, morir, ganar, silenciar, guardar y salir.

---

## Decisiones tomadas y descartadas

- **Sí:** **activar** la fila existente `bloque-buster` con `UPDATE playable=true`, conservando `position` (1), `cover-bricks`, `color` y `best`/`plays`. **No:** `INSERT` de una fila nueva ni crear `cover-bloque-buster` — la fila y la portada ya existen desde SPEC 06.
- **Sí:** **motor TS aislado procedural**, port fiel de `game.js` + `levels.js`, con la **misma API pública** que `AsteroidsEngine`/`CaidaEngine`. **No:** reescribir la lógica como clases/servicios Angular — más riesgo de desviarse del comportamiento probado.
- **Sí:** **redibujo neón vectorial** de paleta/bola/bloques/explosión, sin el spritesheet PNG; el recolor neón **entra** en este spec. **No:** portar el `spritesheet-breakout.png` ni mantener el look original — el usuario prefiere el redibujo neón (a diferencia de Asteroides/Caída, que conservaron su arte y aplazaron el neón).
- **Sí:** **portar los dos efectos `.mp3`** (rebote, rotura) con **botón de silencio** persistido en `localStorage`. **No:** aplazar el sonido como en SPEC 05/07 — el usuario lo quiere en este spec; es el primer juego real con audio. (Música de fondo y más efectos siguen fuera.)
- **Sí:** **HUD DOM neón** (SCORE/VIDAS/NIVEL) alimentado por `onState`, sustituyendo al HUD que el original dibujaba en el canvas. **No:** duplicar el HUD dentro del canvas (el marco neón queda mejor en DOM, como en Caída).
- **Sí:** **overlays de PAUSA/GAME OVER/VICTORIA dibujados en el canvas** y **reinicio con `ESPACIO`** (estilo Asteroides/Caída). **No:** overlay/botón Angular de fin — competiría con el reinicio del canvas.
- **Sí:** fases `'playing' | 'gameover' | 'win'`, **3 vidas**, y **guardar en los dos** estados terminales. **No:** descartar el estado de victoria ni restringir el guardado solo a `gameover`.
- **Sí:** **resolución lógica fija 800×600** (aspecto 4:3) escalada al contenedor con `devicePixelRatio`. **No:** recalcular W/H desde el contenedor como en Asteroides — deformaría la rejilla de bloques y las distancias.
- **Sí:** **controles = teclado + arrastre de puntero + botones táctiles ←/→**; el arrastre (pointer sobre el canvas) porta el ratón del original y sirve en móvil. **No:** limitarse a flechas + botones ni a solo arrastre.
- **Sí:** **retirar el menú-truco de salto de nivel** de la pausa y usar el overlay estándar "EN PAUSA". **No:** portar el truco de saltar a cualquier nivel (no encaja con una partida puntuable).
- **Sí:** la **pausa la dispara el componente** (`P`/`Esc`/botón); el motor no bindea `P`. **No:** que el motor y el componente bindeen `P` a la vez (doble toggle).
- **Sí:** alta de catálogo **vía MCP** (`UPDATE`). **No:** versionar SQL en el repo (decisión heredada de SPEC 06).

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Fugas de `requestAnimationFrame` y listeners de teclado/puntero/`resize` al cambiar de ruta | `destroy()` centraliza el ciclo de vida y lo llama `ngOnDestroy`; un criterio de aceptación lo verifica. |
| El motor toca `window`/`document`/canvas/`Audio`/`localStorage` en SSR | Se instancia solo en navegador (`afterNextRender`); rutas en `RenderMode.Client`; `Audio` y la lectura del mute se hacen solo en navegador. |
| `ESPACIO`/flechas hacen scroll de la página mientras se juega | `preventDefault` en teclas de juego; listeners activos solo mientras corre; `ESPACIO` solo reinicia (en gameover/win), no interfiere en juego. |
| Canvas responsive deforma la rejilla de bloques (debe ser 4:3) | Resolución lógica fija 800×600; el backing store se escala con `devicePixelRatio` manteniendo el aspecto 4:3; acotar tamaño mínimo. |
| El arrastre de puntero no coincide con las coordenadas lógicas tras escalar | El motor mapea `clientX`/`clientY` a coordenadas lógicas con el factor `canvas.width / rect.width` (como el original), no con los px CSS. |
| Reproducir `.mp3` en cada rebote satura o solapa mal el audio | Se precargan y se **clonan** para permitir solapamiento (patrón del original); el flag de mute corta la reproducción; sin bucles. |
| Doble toggle de pausa si el motor también bindea `P` | El motor **no** bindea `P`; la pausa la dispara solo el componente (`P`/`Esc`/botón) vía `pause()`/`resume()`. |
| Tests que dependen del canvas real (jsdom no implementa `2d`) | El motor se testea por lógica (rebotes/colisión/puntos/avance de nivel/`win`/`gameover`) sin `getContext`; `draw()` aislado; en el componente se stubbea RAF. |
| Fallo de red/RLS al guardar deja al jugador sin feedback | `save()` async devuelve `{ ok, error? }`; la UI muestra "GUARDANDO…", error y reintento; sin escritura silenciosa. |

---

## Lo que **no** entra en este spec

- Convertir en reales los otros juegos simulados (`serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`).
- El menú-truco de salto de nivel del original.
- Power-ups, ladrillos de varios golpes/irrompibles, más niveles, editor de niveles.
- Música de fondo y más efectos de sonido; control de volumen por canal.
- Dificultad configurable, logros, marcador online en vivo.
- Derivar `best`/`plays` de `scores`, realtime, migraciones versionadas, auth ligada a `scores`.
- Internacionalización.

Cada uno, si llega, va en su propio spec.
