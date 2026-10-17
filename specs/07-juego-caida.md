# SPEC 07 — Juego Caída (port de references/started-games/03-tetris)

> **Estado:** Aprobado
> **Depende de:** SPEC 05 (motor TS agnóstico + componente dedicado + ruta `jugar/<id>` antes de `jugar/:id`, campo `playable`, marco CRT/overlay/táctil/guardado en `styles.css`), SPEC 06 (tablas `games`/`scores` con RLS, cliente tipado, `GamesService`/`ScoresService` async, Salón por `game_id`)
> **Fecha:** 2026-10-17
> **Objetivo:** Portar el Tetris vanilla (`references/started-games/03-tetris/game.js`) a un motor TypeScript agnóstico y un componente Angular dedicado, activando el juego `caida` (fila ya sembrada) como jugable en `jugar/caida` con leaderboard real en Supabase.

---

## Por qué existe este spec

La plataforma ya es genérica: SPEC 05 dejó el patrón "motor TS aislado + componente dedicado + ruta propia + guardado en el Salón" probado con Asteroides, y SPEC 06 movió catálogo y puntuaciones a Supabase. La fila `caida` (CAÍDA, PUZZLE) ya existe en la tabla `games` como placeholder (`playable: false`), hoy abre el `GamePlayer` simulado. Este spec reutiliza esa fontanería para convertir `caida` en el **segundo juego real** sin tocar los servicios ni los consumidores del catálogo.

El port tiene tres particularidades frente a Asteroides, que motivan las decisiones de este spec:

1. El original es **procedural** (sin clases) y su HUD (SCORE/LINES/LEVEL) y la vista previa **NEXT** viven en el **DOM**, no en el canvas; el overlay de PAUSA/GAME OVER también es DOM.
2. Tetris tiene **una sola vida**: al no caber una pieza nueva, la partida termina (no hay fase intermedia tipo `dead`).
3. Trae un **toggle de tema claro/oscuro** por juego que se conserva, pero acotado al tablero (no al tema neón global del Vault).

---

## Alcance

**Dentro:**

- **Activación del juego `caida`** (CAÍDA, PUZZLE): la fila ya existe en `games` como placeholder; este spec la pone **`playable: true`** vía MCP. Se **conserva** su `position` (2), su portada `cover-tetro` (ya existe en `styles.css`), su `color` (`magenta`) y sus `best`/`plays` sembrados. **UPDATE, no INSERT.**
- **Motor TS aislado** `src/app/games/caida/caida-engine.ts`: port fiel y **procedural** de `game.js`. Agnóstico de framework (no importa nada de Angular). API pública espejo de `AsteroidsEngine`: `start()`, `pause()`, `resume()`, `restart()`, `destroy()`, `setInput(action, pressed)`, `getState()`, callback `onState`. Porta el tablero 10×20, las piezas, rotación con wall-kicks, colisiones, line-clear, ghost piece, caída automática por nivel y el sistema de puntos.
- **8 piezas, incluida la "tuerca"** (índice 8, anillo 3×3 hueco `[[8,8,8],[8,0,8],[8,8,8]]`): **se conserva** como pieza más del repertorio (port fiel), igual que las 7 tetrominós estándar.
- **Colores originales por pieza** (I cian, O amarillo, T morado, S verde, Z rojo, J azul claro, L naranja, tuerca gris): se **conservan**; el recolor neón se aplaza.
- **Componente dedicado** `Caida` en la ruta **`jugar/caida`** (declarada **antes** de `jugar/:id`). Hospeda el `<canvas>` del tablero y un segundo `<canvas>` para NEXT; instancia el motor solo en navegador y lo destruye en `ngOnDestroy`.
- **HUD DOM neón** (SCORE / LÍNEAS / NIVEL) en el marco del reproductor, **alimentado por `onState`** del motor. La vista previa **NEXT** se dibuja en un **segundo canvas** que el motor pinta (recibe ambos canvas).
- **Overlay en el canvas** para PAUSA ("EN PAUSA") y GAME OVER (marcador final), dibujado por el motor (estilo Asteroides). **Reinicio con `ESPACIO`** en gameover. Durante el juego `ESPACIO` es la **caída dura** (hard-drop); al ser estados mutuamente excluyentes por `phase`, no colisionan.
- **Una sola vida:** al no caber la nueva pieza, `phase` pasa de `playing` a `gameover` directamente (sin fase `dead`).
- **Canvas responsive:** el tablero mantiene su **aspecto 1:2** (10×20) escalando al contenedor; el motor recalcula el backing store con `devicePixelRatio` en `resize` (no resolución fija 300×600 por atributo).
- **Pausa** (`P`/`Esc` + botón de la plataforma) que congela el bucle y muestra el overlay "EN PAUSA".
- **Controles táctiles** en pantalla: **5 acciones** — ←, →, rotar, bajar (soft-drop), caída (hard-drop).
- **Toggle de tema claro/oscuro del tablero:** botón en el reproductor que alterna la paleta que dibuja el motor **solo en el tablero** (fondo + rejilla), persistido en `localStorage` con clave propia `av_caida_theme` (solo-navegador). No toca el tema neón del Vault ni el chrome.
- **Guardado en el Salón con botón aparte:** en `gameover`, botón "GUARDAR PUNTUACIÓN" (iniciales por defecto `SessionService.user()?.name ?? 'INVITADO'`) → `ScoresService.save({ game: 'caida', score, name })` (async). Estados "GUARDANDO…"/confirmación/error+reintento, sin doble guardado.
- **Retiro del badge "PRÓXIMAMENTE"** para `caida` (consecuencia de `playable: true`): la tarjeta de biblioteca y la ficha dejan de mostrarlo.
- **Estilos** nuevos en `src/styles.css` (canvas de tablero portrait dentro del CRT, canvas NEXT, controles táctiles del juego, paleta clara del tablero), coordinando `frontend-design` + `ui-ux-pro-max`.
- **Tests Vitest:** unitarios del motor (lógica pura) y smoke del componente.

**Fuera de alcance (para futuros specs):**

- **Recolor neón** de las piezas o del tablero: se conservan los colores originales (como Asteroides conservó sus vectores).
- Convertir en reales los otros juegos simulados (`bloque-buster`, `serpentina`, `rocas`, etc.): siguen con el `GamePlayer` simulado.
- **Hold piece**, bolsa 7-bag, SRS completo, T-spins, soft-drop con auto-repeat/DAS afinado, sonido/música, dificultad configurable, logros.
- **Aplicar el modo claro a todo el Vault** o al chrome del reproductor: el toggle se acota al tablero.
- Derivar `best`/`plays` de `scores`, realtime del Salón, migraciones SQL versionadas, auth ligada a `scores`.
- Internacionalización (la UI queda solo en español).

---

## Modelo de datos

No introduce tablas nuevas: reutiliza `games` y `scores` de SPEC 06. `scores` **no cambia** (tabla única por `game_id`; el leaderboard ya consulta `game_id = 'caida'`). Introduce la **activación de una fila de catálogo** y un **contrato de estado motor → componente**.

Fila existente en `public.games` — se actualiza (vía MCP; ver Plan):

```sql
update public.games set playable = true where id = 'caida';
-- position (2), cover ('cover-tetro'), color ('magenta'), best, plays: SIN CAMBIOS.
```

Contrato que el motor notifica al componente (ni el motor ni el contrato conocen Angular):

```ts
// src/app/games/caida/caida-engine.ts
export type CaidaPhase = 'playing' | 'gameover'; // una sola vida: no hay fase 'dead'

export interface CaidaState {
  score: number;
  lines: number;
  level: number;
  phase: CaidaPhase;
}

export type TouchAction = 'left' | 'right' | 'rotate' | 'soft' | 'hard';

export interface CaidaEngineOptions {
  onState?: (s: CaidaState) => void;    // invocado solo cuando cambia el estado observable (dedupe)
  nextCanvas?: HTMLCanvasElement;       // 2º canvas: el motor dibuja ahí la vista previa NEXT
}

export class CaidaEngine {
  constructor(canvas: HTMLCanvasElement, opts?: CaidaEngineOptions);
  start(): void;
  pause(): void;                        // cancela RAF y pinta "EN PAUSA" en el canvas
  resume(): void;
  restart(): void;                      // reinicia la partida (equivalente a ESPACIO en gameover)
  setInput(a: TouchAction, pressed: boolean): void; // táctil → mismos handlers que el teclado
  setBoardTheme(theme: 'dark' | 'light'): void;     // alterna solo la paleta del tablero/rejilla
  getState(): CaidaState;
  destroy(): void;                      // cancela RAF, quita listeners de teclado/resize, ResizeObserver
}
```

Convenciones y constantes portadas (del original, exportadas para tests): `COLS` (10), `ROWS` (20), `COLORS` (índices 1–8), `PIECES` (1–8, incl. tuerca), `LINE_SCORES` (`[0,100,300,500,800]`). Puntuación: líneas = `LINE_SCORES[n] * level`; hard-drop `+2`/celda; soft-drop `+1`/fila. Nivel = `floor(lines/10)+1`; `dropInterval = max(100, 1000 − (level−1)·90)` ms. Rotación `rotateCW` (transpuesta + inversión) con wall-kicks `[0,−1,1,−2,2]`. El estado observable para `onState` es `score`/`lines`/`level`/`phase` (la forma de la pieza NEXT no va en el contrato: la dibuja el motor en `nextCanvas`). El `name` se normaliza a mayúsculas y se acota a ≤ 12 caracteres. El toggle de tema del tablero persiste en `localStorage` (`av_caida_theme`) **solo en navegador**.

---

## Plan de implementación

Numerado; cada paso deja la app compilando y navegable.

1. **Ruta + cascarón.** Crear un componente `Caida` mínimo en `src/app/games/caida/caida.ts|html`; declarar `{ path: 'jugar/caida', component: Caida }` en `src/app/app.routes.ts` **antes** de `{ path: 'jugar/:id', component: GamePlayer }` (import incluido). Prueba: `/jugar/caida` renderiza el cascarón; `/jugar/<otro>` sigue abriendo el `GamePlayer` simulado; `npm run build` compila. (El badge y la activación de catálogo van en el paso 5.)
2. **Motor.** Crear `src/app/games/caida/caida-engine.ts` portando `game.js` de forma procedural: tablero 10×20, `PIECES`/`COLORS` (incl. tuerca), `collide`/`rotateCW`/`tryRotate` (wall-kicks), `merge`/`clearLines`, `ghostY`, `hardDrop`/`softDrop`/`lockPiece`/`spawn`, caída automática por `dropInterval`. Cambios respecto al original: `W`/`H` responsive tomados del canvas y recalculados en `resize` + `ResizeObserver`; listeners de teclado propios con `preventDefault` en flechas/espacio, **activos solo mientras el motor corre** (flechas = mover/soft, `↑`/`X` = rotar, `Espacio` = hard-drop en juego / reinicio en gameover); `setInput` para táctil (mismos handlers); `emitState` con dedupe que invoca `onState` al cambiar `score`/`lines`/`level`/`phase`; `pause`/`resume`/`restart`/`destroy`; `setBoardTheme`; el motor dibuja el overlay "EN PAUSA"/"GAME OVER" en el canvas y la vista previa en `nextCanvas`. `update(dt)` público y **sin tocar `ctx`** (testeable); `draw()` aislado. `dt` capado. **La pausa por `P`/`Esc` la dispara el componente** (el motor no bindea `P`, para evitar doble toggle). Prueba: tests del paso 6 + humo manual.
3. **Componente.** `src/app/games/caida/caida.ts|html` (standalone, signals, `imports: [EsNumberPipe, RouterLink]`, `host: { class: 'av-player fade-in' }`, `implements OnDestroy`). `viewChild.required` del `<canvas #canvas>` (tablero) y `<canvas #next>` (NEXT). Instanciar el motor **solo en navegador** con `afterNextRender` + `NgZone.runOutsideAngular` (sin `isPlatformBrowser` redundante), pasando `onState: s => zone.run(() => this.applyState(s))` y `nextCanvas`; `engine.start()`; `destroy()` en `ngOnDestroy`. Signals espejo `score`/`lines`/`level`/`phase` + UI `paused`/`saved`/`saving`/`saveError`/`name`/`boardTheme`. Handler aparte de `keydown` para `P`/`Escape` → pausa (con `preventDefault`), guardado en campo y retirado en `ngOnDestroy`. `applyState(s)` copia a signals y, si detecta reinicio (`phase === 'playing'` tras `saved`/`saveError`), rehabilita el guardado. Táctil `press(action, pressed, e)` → `preventDefault` + `engine.setInput`. Toggle de tema: botón que alterna `boardTheme`, llama `engine.setBoardTheme`, persiste en `localStorage` (`av_caida_theme`), leído al iniciar (solo-navegador). Prueba: jugar, pausar, morir, alternar tema, salir sin dejar RAF/listeners vivos.
4. **HUD + guardado (HTML).** Marco CRT reutilizado: `.player-hud` con SCORE/LÍNEAS/NIVEL (via `onState`), el canvas NEXT, el botón de tema y `.hud-actions` (PAUSA/REANUDAR, SALIR). `.crt > .crt-screen` con `<canvas #canvas>`; `.touch-controls` con 5 botones (pointerdown/up/leave/cancel → `press`). `@if (phase() === 'gameover')` bloque `.av-save` con marcador final, input de iniciales, botón cuyo label es `saving() ? 'GUARDANDO…' : saveError() ? 'REINTENTAR' : 'GUARDAR PUNTUACIÓN'`, línea de error opcional y "VOLVER AL VAULT" (`RouterLink` a `''`). El guardado llama `ScoresService.save({ game: 'caida', score: this.score(), name: this.name() })` solo en `gameover`, sin doble guardado. Prueba: en `gameover` el botón guarda una vez y refleja estado; el HUD DOM coincide con la partida.
5. **Catálogo + estilos.** Vía MCP (paso siguiente lo detalla) poner `caida.playable = true`; verificar que la tarjeta/ficha de `caida` **ya no** muestra "PRÓXIMAMENTE" y que `/juego/caida` funciona. Añadir a `src/styles.css`: canvas de tablero **portrait** (aspecto 1:2, sin desbordar a 360 px; clonar el cuerpo de `.asteroids-canvas` como `.caida-canvas` por el aspecto distinto), estilo del canvas NEXT, controles táctiles del juego y la **paleta clara del tablero**. Reutilizar lo existente (`.soon-badge.lg`, marco CRT, `.game-overlay`, `.touch-controls`/`.touch-cluster`/`.touch-btn`, `.av-save`, `@media prefers-reduced-motion`). Coordinar `frontend-design` + `ui-ux-pro-max` (foco visible, contraste, `prefers-reduced-motion` atenúa decoración no jugabilidad, SVG/íconos `aria-hidden`).
6. **Alta en `games` vía MCP.** `UPDATE public.games SET playable = true WHERE id = 'caida';` con `mcp__supabase__apply_migration` (o `execute_sql`). `position`/`cover`/`color`/`best`/`plays` sin cambios. `scores` no requiere nada. Prueba (MCP): `select playable from games where id='caida'` → `true`.
7. **Tests.** `caida-engine.spec.ts` (lógica pura, `new CaidaEngine(document.createElement('canvas'))`, conduciendo la simulación con el tablero/pieza y `update(dt)`; **sin** `getContext`/`draw`): `rotateCW`/`tryRotate` con kicks; `collide` en bordes y ocupación; `clearLines` suma `LINE_SCORES[n]·level` para n=1..4 y sube nivel/velocidad cada 10 líneas; `hardDrop` suma `+2`/celda y bloquea; `softDrop` `+1`; `spawn` que colisiona → `phase: 'gameover'` (una vida). `caida.spec.ts` (`TestBed` + `provideRouter([{ path: '', component: Caida }])`; en `beforeEach` stub de RAF: `vi.stubGlobal('requestAnimationFrame', () => 0)` y `cancelAnimationFrame`): monta y refleja `onState` en el HUD DOM; `vi.spyOn(ScoresService,'save').mockResolvedValue({ ok: true })` para verificar que guarda solo en `gameover`, envía `{ game: 'caida', score, name }`, sin doble guardado, y que el error fija `saveError`; que el toggle de tema alterna `boardTheme`. Ajustar `GAMES_FIXTURE` en `src/app/testing/supabase-mock.ts` y el conteo en `games.service.spec.ts` si procede. Comando: `npx ng test --watch=false`.
8. **Docs.** Actualizar `CLAUDE.md` ("Port status" y el bullet de `games/`): `caida` como **segundo juego real** (Tetris), motor TS en `games/caida/`, activado vía `UPDATE playable=true`; los demás siguen simulados.

---

## Criterios de aceptación

- [ ] `npm run build` y `npx ng test --watch=false` terminan sin errores.
- [ ] `caida` tiene `playable: true` en `games` (y `position` 2, `cover-tetro`, `magenta`, `best`/`plays` intactos); aparece sin badge "PRÓXIMAMENTE" en la biblioteca y su ficha `/juego/caida` funciona.
- [ ] `/jugar/caida` carga el componente dedicado `Caida`; `/jugar/<otro-id>` sigue abriendo el `GamePlayer` simulado.
- [ ] El juego es jugable con teclado: `←`/`→` mueven, `↓` baja (soft-drop), `↑`/`X` rotan (con wall-kick), `Espacio` hace caída dura.
- [ ] Están las 8 piezas, incluida la tuerca, con sus colores originales; el ghost piece se muestra bajo la pieza activa.
- [ ] Al completar filas, la puntuación suma `LINE_SCORES[n]·nivel` (100/300/500/800 × nivel para 1/2/3/4 líneas); cada 10 líneas sube el nivel y acelera la caída.
- [ ] El HUD DOM neón (SCORE/LÍNEAS/NIVEL) refleja el estado notificado por el motor; la vista previa NEXT se dibuja en su propio canvas.
- [ ] Al no caber una pieza nueva, la partida termina (una sola vida): el motor pinta "GAME OVER" con el marcador en el canvas y `ESPACIO` reinicia.
- [ ] La pausa (`P`/`Esc` o botón) congela el bucle y muestra "EN PAUSA" en el canvas; reanudar continúa sin reiniciar.
- [ ] Hay controles táctiles en pantalla (←, →, rotar, bajar, caída) que mueven igual que el teclado.
- [ ] El toggle de tema alterna la paleta **solo del tablero** (fondo/rejilla), se persiste en `localStorage` (`av_caida_theme`) y no altera el tema neón del Vault.
- [ ] En `gameover`, "GUARDAR PUNTUACIÓN" inserta en `scores` con `game_id: 'caida'`, el score final y las iniciales; muestra "GUARDANDO…", luego confirmación; sin doble guardado; en fallo avisa y permite reintentar; la marca aparece en la pestaña `caida` del Salón ordenada por puntuación.
- [ ] El tablero escala al contenedor preservando su aspecto 1:2; sin scroll horizontal a 360 px; la resolución interna se recalcula al redimensionar.
- [ ] Al abandonar `/jugar/caida` el motor se destruye: sin `requestAnimationFrame` activos ni listeners de teclado/`resize`; las flechas/espacio no hacen scroll de la página durante el juego.
- [ ] La app renderiza bajo SSR sin tocar `window`/`document`/canvas/`localStorage` en servidor (el motor solo se crea en navegador).
- [ ] Ningún componente consulta Supabase directamente; el motor no importa nada de Angular.
- [ ] Sin errores en la consola al jugar, pausar, morir, alternar tema, guardar y salir.

---

## Decisiones tomadas y descartadas

- **Sí:** **activar** la fila existente `caida` con `UPDATE playable=true`, conservando `position` (2), `cover-tetro`, `color` y `best`/`plays`. **No:** `INSERT` de una fila nueva ni crear `cover-caida` — la fila y la portada ya existen desde SPEC 06.
- **Sí:** **motor TS aislado procedural**, port fiel de `game.js`, con la **misma API pública** que `AsteroidsEngine` (`start/pause/resume/restart/destroy/setInput/getState/onState`). **No:** reescribir la lógica como clases/servicios Angular — más riesgo de desviarse del comportamiento probado. (El motor puede ser procedural por dentro mientras exponga la API.)
- **Sí:** **conservar la 8ª pieza "tuerca"** y los **colores originales** de todas las piezas. **No:** reducir a 7 tetrominós estándar ni recolorear a neón — el recolor se aplaza (coherente con Asteroides).
- **Sí:** **HUD DOM neón** (SCORE/LÍNEAS/NIVEL) alimentado por `onState` + **NEXT en un 2º canvas** que el motor dibuja. **No:** dibujar el HUD dentro del canvas principal (el original ya lo tenía en DOM; el marco neón queda mejor en DOM).
- **Sí:** **overlay de PAUSA/GAME OVER dibujado en el canvas** y **reinicio con `ESPACIO`** (estilo Asteroides). **No:** overlay/botón Angular de fin — competiría con el reinicio del canvas. `ESPACIO` es hard-drop en juego y reinicio en gameover (estados excluyentes).
- **Sí:** **una sola vida** — `phase` va de `playing` a `gameover` directo. **No:** fase `dead` intermedia (Tetris no tiene vidas).
- **Sí:** **canvas responsive** (aspecto 1:2, W/H recalculados en `resize`). **No:** resolución fija 300×600 por atributo escalada por CSS.
- **Sí:** **controles táctiles con 5 acciones** (incluye soft-drop) en este spec. **No:** diferir el táctil ni recortar el soft-drop.
- **Sí:** **conservar el toggle de tema claro/oscuro**, acotado **solo al tablero** (paleta del canvas), persistido en `localStorage` (`av_caida_theme`). **No:** aplicar el modo claro a todo el Vault ni al chrome del reproductor — rompería el tema neón global.
- **Sí:** **guardado con botón aparte** en `gameover` → `ScoresService.save({ game: 'caida', … })`, async, sin doble guardado. **No:** modal Angular de fin de partida.
- **Sí:** alta de catálogo **vía MCP** (`UPDATE`). **No:** versionar SQL en el repo (decisión heredada de SPEC 06).

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Fugas de `requestAnimationFrame` y listeners de teclado/`resize` al cambiar de ruta | `destroy()` centraliza el ciclo de vida y lo llama `ngOnDestroy`; un criterio de aceptación lo verifica. |
| El motor toca `window`/`document`/canvas/`localStorage` en SSR | Se instancia solo en navegador (`afterNextRender`); rutas en `RenderMode.Client`; la lectura del tema se hace solo en navegador. |
| `ESPACIO` hace scroll de la página o choca entre hard-drop y reinicio | `preventDefault` en teclas de juego; listeners activos solo mientras corre; hard-drop y reinicio están separados por `phase` (juego vs gameover). |
| Canvas responsive distorsiona el tablero (debe ser 1:2 con celdas cuadradas) | Mantener aspecto 1:2 y backing store con `devicePixelRatio`; acotar tamaño mínimo; el tablero lógico sigue siendo 10×20. |
| Doble toggle de pausa si el motor también bindea `P` | El motor **no** bindea `P`; la pausa la dispara solo el componente (`P`/`Esc`/botón) vía `pause()`/`resume()`. |
| El toggle de tema se filtra al tema global del Vault | El toggle solo cambia la paleta que el motor dibuja en el tablero; clave `localStorage` propia; no añade clases al `body`. |
| Tests que dependen del canvas real (jsdom no implementa `2d`) | El motor se testea por lógica (`collide`/`rotate`/`clearLines`/puntos/`gameover`) sin `getContext`; `draw()` aislado; en el componente se stubbea RAF. |
| Fallo de red/RLS al guardar deja al jugador sin feedback | `save()` async devuelve `{ ok, error? }`; la UI muestra "GUARDANDO…", error y reintento; sin escritura silenciosa. |

---

## Lo que **no** entra en este spec

- Recolor neón de piezas/tablero.
- Convertir en reales los otros juegos simulados.
- Hold piece, 7-bag, SRS completo, T-spins, DAS/soft-drop afinado, sonido/música, dificultad configurable, logros.
- Aplicar el modo claro a todo el Vault o al chrome del reproductor.
- Derivar `best`/`plays` de `scores`, realtime, migraciones versionadas, auth ligada a `scores`.
- Internacionalización.

Cada uno, si llega, va en su propio spec.
