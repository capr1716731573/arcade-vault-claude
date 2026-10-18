# SPEC 09 — Juego Snake (nuevo juego real) + limpieza del catálogo

> **Estado:** Aprobado
> **Depende de:** SPEC 05 (motor TS agnóstico + componente dedicado + ruta `jugar/<id>` antes de `jugar/:id`, campo `playable`, marco CRT/overlay/táctil/guardado en `styles.css`), SPEC 06 (tablas `games`/`scores` con RLS, cliente tipado, `GamesService`/`ScoresService` async, Salón por `game_id`)
> **Fecha:** 2026-10-18
> **Objetivo:** Crear Snake como motor TS agnóstico + componente Angular dedicado, jugable en `jugar/snake` con leaderboard real en Supabase, y dejar el catálogo `games` solo con los juegos implementados (borrando los placeholders no implementados).

---

## Por qué existe este spec

La plataforma ya es genérica: SPEC 05 dejó el patrón "motor TS aislado + componente dedicado + ruta propia + guardado en el Salón" probado con Asteroides, y SPEC 06 movió catálogo y puntuaciones a Supabase. Este spec reutiliza esa fontanería para añadir el **cuarto juego real** (Snake) **sin tocar los servicios ni los consumidores del catálogo**, y de paso limpia el catálogo para que **solo contenga juegos implementados**.

El spec tiene cuatro particularidades que motivan sus decisiones:

1. **No hay `game.js` de referencia.** La carpeta `references/started-games/05-snake-assets/` solo trae **assets** (`fruits.png` + `sprites.js`, un atlas de 22 frutas). Snake se **construye desde cero** siguiendo el patrón procedural de Caída (SPEC 07), no se porta un original.
2. **Comida con sprites reales.** La comida se dibuja con los recortes de `fruits.png` (vía el atlas de `sprites.js`); la serpiente, en cambio, se dibuja con **vectores neón** (el atlas no trae sprites de serpiente).
3. **Catálogo nuevo, no activación.** A diferencia de SPEC 07/08 (que activaron una fila placeholder con `UPDATE playable=true`), aquí se **borra** la fila placeholder `serpentina` y se **inserta** una fila nueva `snake`. Esto inaugura la convención: **de ahora en adelante cada juego se crea en la BD al implementarlo**, no se siembra como placeholder.
4. **Limpieza del catálogo.** Se borran de la tabla `games` los 5 placeholders restantes no implementados; el catálogo queda con 4 filas, todas `playable: true`.

---

## Alcance

**Dentro:**

- **Juego nuevo `snake`** (SNAKE, ARCADE) en el catálogo `games`, **`playable: true`**, creado vía **`INSERT`** (no UPDATE): `cover` = `cover-snake` (clase ya existente en `styles.css`), `color` = `green`, `position` = 3, `best` = 0, `plays` = `'—'` (juego real recién creado, sin estadísticas sembradas falsas). Se **borra** antes la fila placeholder `serpentina` (misma posición 3).
- **Motor TS aislado** `src/app/games/snake/snake-engine.ts`: lógica de Snake **procedural**, agnóstica de framework (no importa nada de Angular). API pública espejo de `AsteroidsEngine`/`CaidaEngine`: `start()`, `pause()`, `resume()`, `restart()`, `destroy()`, `setInput(action, pressed)`, `getState()`, callback `onState`. Implementa: grilla lógica fija cuadrada, serpiente como lista de segmentos, movimiento por **tick** (no por frame), giro con bloqueo de reversa 180°, **wrap toroidal** en los 4 bordes, aparición de comida en celda libre aleatoria, crecimiento y puntuación al comer, aceleración progresiva, y fin de partida por **auto-colisión**.
- **Atlas de frutas portado.** Las coordenadas de `sprites.js` (`window.SPRITE_ATLAS.fruits`, 22 frutas) se portan a una **constante TypeScript** `FRUIT_SPRITES` en el motor (o `games/snake/sprites.ts`); `window.SPRITE_ATLAS` **no** se carga como script global. El binario `fruits.png` se copia a `public/games/snake/fruits.png` y el motor lo carga **solo en navegador** (`new Image()`, `onload`) para dibujar la comida con `drawImage` recortando por atlas.
- **Comida aleatoria con puntos por fruta.** Cada comida elige una fruta aleatoria del atlas; el valor en puntos depende de la fruta (tabla `FRUIT_POINTS`, ver Modelo de datos). Comer **siempre** alarga la serpiente en 1 segmento, independientemente de los puntos.
- **Wrap toroidal:** la serpiente que sale por un borde reaparece por el opuesto (como el espacio toroidal de Asteroides). **Los muros no matan**; solo matan las colisiones con el propio cuerpo.
- **Una sola vida:** `SnakePhase` es `'playing' | 'gameover'` (sin fase intermedia). Al morderse a sí misma, `phase` pasa de `playing` a `gameover`.
- **Componente dedicado** `Snake` en la ruta **`jugar/snake`** (declarada **antes** de `jugar/:id`). Hospeda el `<canvas>`; instancia el motor solo en navegador y lo destruye en `ngOnDestroy`.
- **HUD DOM neón** (SCORE / LONGITUD / VELOCIDAD) en el marco del reproductor, **alimentado por `onState`** del motor.
- **Overlay en el canvas** dibujado por el motor para PAUSA ("EN PAUSA") y GAME OVER (marcador final). **Reinicio con `ESPACIO`** en `gameover` (estilo Asteroides/Caída).
- **Canvas responsive con grilla cuadrada:** la simulación corre en una grilla lógica fija (cuadrada); el motor escala el backing store al contenedor con `devicePixelRatio` en `resize`/`ResizeObserver` manteniendo el **aspecto 1:1** (celdas cuadradas, sin deformar).
- **Controles:** teclado **flechas** y **WASD** (giro, con bloqueo de reversa), **4 botones táctiles** en pantalla (←, →, ↑, ↓) vía `setInput`. **Pausa** (`P`/`Esc` + botón de la plataforma) que congela el bucle y muestra "EN PAUSA"; la pausa **la dispara el componente** (el motor no bindea `P`).
- **Guardado en el Salón con botón aparte:** en `gameover`, botón "GUARDAR PUNTUACIÓN" (iniciales por defecto `SessionService.user()?.name ?? 'INVITADO'`) → `ScoresService.save({ game: 'snake', score, name })` (async). Estados "GUARDANDO…"/confirmación/error+reintento, sin doble guardado.
- **Limpieza del catálogo (BD + app + tests):**
  - **Supabase (vía MCP):** `DELETE` de las filas `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`; `INSERT` de `snake`. Resultado: 4 filas (`asteroides` 0, `bloque-buster` 1, `caida` 2, `snake` 3), todas `playable: true`.
  - **Seed de referencia** `src/app/data/games.data.ts`: dejar solo las 4 entradas implementadas (sustituir la entrada `serpentina` por `snake` con `playable: true`; eliminar las 5 entradas de los juegos borrados; corregir `playable: true` en `bloque-buster` y `caida`, hoy desfasadas en ese artefacto).
  - **Fixtures de test** `src/app/testing/supabase-mock.ts`: reducir `GAMES_FIXTURE` a las 4 filas reales (y ajustar el conteo esperado en `games.service.spec.ts` si lo verifica).
- **Retiro del badge "PRÓXIMAMENTE"** para `snake` (consecuencia de `playable: true`): la tarjeta y la ficha no lo muestran. Los juegos borrados dejan de aparecer en biblioteca, home y Salón.
- **Estilos** nuevos en `src/styles.css`: canvas de aspecto **1:1** dentro del CRT (clonar el cuerpo de `.asteroids-canvas` como `.snake-canvas`), y el D-pad táctil de 4 botones. `cover-snake` ya existe; **no** se crea portada nueva.
- **Tests Vitest:** unitarios del motor (lógica pura) y smoke del componente.

**Fuera de alcance (para futuros specs):**

- Convertir en reales los juegos **borrados** (`gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`): cuando se implementen, se **crearán** (INSERT) con su propio spec. Mientras tanto no existen en el catálogo (ya no abren ni el `GamePlayer` simulado).
- **Sonido/música**, power-ups (comida especial, acelerones, invencibilidad), obstáculos o muros interiores, niveles, modo contra la pared (sin wrap), velocidad/dificultad configurable, logros.
- **Recolor neón de las frutas:** se dibujan con su arte original del atlas (como Asteroides/Caída conservaron el suyo).
- Dibujar la serpiente con sprites (el atlas no los trae): se usan vectores neón.
- Derivar `best`/`plays` de `scores`, realtime del Salón, migraciones SQL versionadas, auth ligada a `scores`.
- Internacionalización (la UI queda solo en español).

---

## Modelo de datos

No introduce tablas nuevas: reutiliza `games` y `scores` de SPEC 06. `scores` **no cambia** (tabla única por `game_id`; el leaderboard ya consulta `game_id = 'snake'`). La tabla `scores` está **vacía** hoy, así que borrar filas de `games` no viola la FK `scores_game_id_fkey` (no hay huérfanos). Este spec introduce el **alta de una fila de catálogo**, el **borrado de 6 filas**, y un **contrato de estado motor → componente**.

Cambios en `public.games` (vía MCP; ver Plan):

```sql
-- 1) Borrar la fila placeholder de Snake y los 5 placeholders no implementados.
delete from public.games
where id in ('serpentina', 'gloton', 'invasores', 'rocas', 'ranaria', 'duelo-pixel');

-- 2) Crear la fila real de Snake (INSERT, no UPDATE).
insert into public.games (id, title, short, long, cat, cover, color, best, plays, playable, position)
values (
  'snake', 'SNAKE',
  'Crece comiendo fruta sin morderte la cola.',
  'Una serpiente de luz recorre una grilla toroidal devorando fruta. Cada bocado la alarga y la acelera; atraviesa los bordes y reaparece en el lado opuesto. El único peligro es ella misma.',
  'ARCADE', 'cover-snake', 'green', 0, '—', true, 3
);
```

Resultado esperado del catálogo (4 filas, todas jugables): `asteroides` (0), `bloque-buster` (1), `caida` (2), `snake` (3).

Contrato que el motor notifica al componente (ni el motor ni el contrato conocen Angular):

```ts
// src/app/games/snake/snake-engine.ts
export type SnakePhase = 'playing' | 'gameover'; // una sola vida: no hay fase intermedia

export interface SnakeState {
  score: number;
  length: number;   // nº de segmentos de la serpiente
  speed: number;    // nivel de velocidad (1..N), sube al comer
  phase: SnakePhase;
}

export type TouchAction = 'up' | 'down' | 'left' | 'right'; // D-pad; mismo efecto que las flechas

export interface SnakeEngineOptions {
  onState?: (s: SnakeState) => void; // invocado solo cuando cambia el estado observable (dedupe)
}

export class SnakeEngine {
  constructor(canvas: HTMLCanvasElement, opts?: SnakeEngineOptions);
  start(): void;
  pause(): void;                                     // cancela RAF y pinta "EN PAUSA" en el canvas
  resume(): void;
  restart(): void;                                   // reinicia la partida (equivalente a ESPACIO en gameover)
  setInput(a: TouchAction, pressed: boolean): void;  // táctil → mismo giro que el teclado (ignora reversa 180°)
  getState(): SnakeState;
  destroy(): void;                                   // cancela RAF, quita listeners de teclado/resize, ResizeObserver
}
```

Constantes y convenciones (exportadas para tests):

- **Grilla:** `GRID` (21 → tablero 21×21). Origen arriba-izquierda; celdas cuadradas. La serpiente arranca con `length` 3 en el centro, dirección `right`.
- **Movimiento por tick:** `update(dt)` acumula tiempo y avanza **un paso de celda** cuando el acumulador alcanza `stepInterval`. `BASE_MS` (140) es el intervalo inicial; aceleración `stepInterval = max(MIN_MS, BASE_MS − SPEED_STEP · fruitsEaten)` con `SPEED_STEP` (4) y `MIN_MS` (60). `speed` (nivel mostrado) = `floor(fruitsEaten / 5) + 1`. (Valores de balance iniciales, ajustables.)
- **Wrap toroidal:** la nueva cabeza se calcula módulo `GRID` en x e y (sale por un borde, entra por el opuesto).
- **Comer:** si la cabeza cae en la celda de la comida, `score += FRUIT_POINTS[fruta]`, la serpiente **no** elimina su cola ese tick (crece 1), `fruitsEaten++`, y se genera comida nueva en una celda libre aleatoria.
- **Fin de partida:** si la nueva cabeza coincide con una celda ocupada por el cuerpo → `phase = 'gameover'`. (Con wrap, los bordes nunca matan.)
- **Atlas de frutas** `FRUIT_SPRITES` (port de `sprites.js`): `Record<FruitName, { x; y; w; h }>` con las 22 frutas de `fruits.png` (hoja 3790×442; fila `y=136`, alto 160). `FruitName` = las 22 claves (`apple`, `banana`, `cherry`, `grape`, …).
- **Puntos por fruta** `FRUIT_POINTS: Record<FruitName, number>` en 3 tramos (balance inicial): **10** (frutas grandes/comunes: `apple`, `banana`, `orange`, `watermelon`, `melon`, `pineapple`, `pepper`, `tomato`); **20** (`grape`, `grapes2`, `strawberry`, `peach`, `lemon`, `kiwi`, `carrot`, `eggplant`); **30** (frutas pequeñas/raras: `cherry`, `berries`, `mushroom`, `broccoli`, `garlic`, `peanut`).
- El estado observable para `onState` es `score`/`length`/`speed`/`phase`. El `name` se normaliza a mayúsculas y se acota a ≤ 12 caracteres.

---

## Plan de implementación

Numerado; cada paso deja la app compilando y navegable.

1. **Ruta + cascarón.** Crear un componente `Snake` mínimo en `src/app/games/snake/snake.ts|html`; declarar `{ path: 'jugar/snake', component: Snake }` en `src/app/app.routes.ts` **antes** de `{ path: 'jugar/:id', component: GamePlayer }` (import incluido). Prueba: `/jugar/snake` renderiza el cascarón; `/jugar/<otro>` sigue abriendo el `GamePlayer` simulado; `npm run build` compila. (El catálogo y los estilos van en pasos 5–6.)
2. **Assets de frutas.** Copiar `references/started-games/05-snake-assets/fruits.png` a `public/games/snake/fruits.png` (Angular sirve `public/` en la raíz web; se referencia como `/games/snake/fruits.png`). Portar las coordenadas de `sprites.js` a una constante TS `FRUIT_SPRITES` (en el motor o en `games/snake/sprites.ts`). Prueba: el archivo existe y el build lo incluye en `dist`.
3. **Motor.** Crear `src/app/games/snake/snake-engine.ts`: grilla lógica `GRID`, serpiente como array de celdas, `dir`/`nextDir` con bloqueo de reversa, `step()` (nueva cabeza con wrap módulo `GRID`, comer/crecer/puntuar, auto-colisión → `gameover`), `spawnFruit()` en celda libre aleatoria, `update(dt)` por acumulador de tick con `stepInterval` acelerado por `fruitsEaten`. Infra espejo de los otros motores: `W`/`H` del canvas recalculados en `resize` + `ResizeObserver` (backing store con `devicePixelRatio`, aspecto 1:1); listeners de teclado propios con `preventDefault` en flechas/espacio, **activos solo mientras el motor corre** (flechas/WASD giran; `Espacio` reinicia en `gameover`); `setInput` para los 4 botones táctiles (mismo giro); `emitState` con dedupe que invoca `onState` al cambiar `score`/`length`/`speed`/`phase`; `pause`/`resume`/`restart`/`destroy`; carga de `fruits.png` solo en navegador y `drawFruit()` con `drawImage` por atlas; el motor dibuja "EN PAUSA"/"GAME OVER" en el canvas. `update(dt)` público y **sin tocar `ctx`** (testeable); `draw()` aislado; `dt` capado. **La pausa por `P`/`Esc` la dispara el componente** (el motor no bindea `P`). Prueba: tests del paso 7 + humo manual.
4. **Componente.** `src/app/games/snake/snake.ts|html` (standalone, signals, `imports: [EsNumberPipe, RouterLink]`, `host: { class: 'av-player fade-in' }`, `implements OnDestroy`). `viewChild.required` del `<canvas #canvas>`. Instanciar el motor **solo en navegador** con `afterNextRender` + `NgZone.runOutsideAngular` (sin `isPlatformBrowser` redundante), pasando `onState: s => zone.run(() => this.applyState(s))`; `engine.start()`; `destroy()` en `ngOnDestroy`. Signals espejo `score`/`length`/`speed`/`phase` + UI `paused`/`saved`/`saving`/`saveError`/`name`. Handler aparte de `keydown` para `P`/`Escape` → pausa (con `preventDefault`), guardado en campo y retirado en `ngOnDestroy`. `applyState(s)` copia a signals y, si detecta reinicio (`phase === 'playing'` tras `saved`/`saveError`), rehabilita el guardado. Táctil `press(action, pressed, e)` → `preventDefault` + `engine.setInput`. Prueba: jugar, pausar, morir, salir sin dejar RAF/listeners vivos.
5. **HUD + guardado (HTML).** Marco CRT reutilizado: `.player-hud` con SCORE/LONGITUD/VELOCIDAD (via `onState`) y `.hud-actions` (PAUSA/REANUDAR, SALIR). `.crt > .crt-screen` con `<canvas #canvas>`; `.touch-controls` con el **D-pad de 4 botones** (↑/↓/←/→; pointerdown/up/leave/cancel → `press`). `@if (phase() === 'gameover')` bloque `.av-save` con marcador final, input de iniciales, botón cuyo label es `saving() ? 'GUARDANDO…' : saveError() ? 'REINTENTAR' : 'GUARDAR PUNTUACIÓN'`, línea de error opcional y "VOLVER AL VAULT" (`RouterLink` a `''`). El guardado llama `ScoresService.save({ game: 'snake', score: this.score(), name: this.name() })` solo en `gameover`, sin doble guardado. Prueba: en `gameover` el botón guarda una vez y refleja estado; el HUD DOM coincide con la partida.
6. **Catálogo + estilos.** Vía MCP (paso 7 lo detalla) borrar los 6 placeholders e insertar `snake`; sincronizar `src/app/data/games.data.ts` (4 entradas, `snake` con `playable: true`) y `GAMES_FIXTURE` (4 filas) + el conteo en `games.service.spec.ts`. Verificar que `snake` aparece sin "PRÓXIMAMENTE", que `/juego/snake` funciona y que los juegos borrados **ya no** aparecen en biblioteca/home/Salón. Añadir a `src/styles.css`: canvas **cuadrado 1:1** dentro del CRT (clonar `.asteroids-canvas` como `.snake-canvas`) y el D-pad táctil. Reutilizar lo existente (`.soon-badge.lg`, marco CRT, `.game-overlay`, `.touch-controls`/`.touch-cluster`/`.touch-btn`, `.av-save`, `@media prefers-reduced-motion`). `cover-snake` ya existe. Coordinar `frontend-design` + `ui-ux-pro-max` (foco visible, contraste, `prefers-reduced-motion` atenúa decoración no jugabilidad, SVG/íconos `aria-hidden`).
7. **Catálogo en `games` vía MCP.** Con `mcp__supabase__apply_migration` (o `execute_sql`): el `DELETE` de las 6 filas y el `INSERT` de `snake` del Modelo de datos. `scores` no requiere nada. Pruebas (MCP): `select id, playable, position from games order by position` → exactamente 4 filas jugables (`asteroides`,`bloque-buster`,`caida`,`snake`); `select playable from games where id='snake'` → `true`; los 6 ids borrados no existen.
8. **Tests.** `snake-engine.spec.ts` (lógica pura, `new SnakeEngine(document.createElement('canvas'))`, conduciendo la simulación con la serpiente/comida y `update(dt)`; **sin** `getContext`/`draw`): el giro bloquea la reversa 180°; un paso avanza la cabeza en la dirección; el **wrap** reaparece por el borde opuesto (cabeza en el borde → siguiente celda módulo `GRID`); comer suma `FRUIT_POINTS[fruta]`, alarga en 1 y genera comida nueva; la **auto-colisión** pone `phase: 'gameover'` (una vida); la aceleración reduce `stepInterval` al comer. `snake.spec.ts` (`TestBed` + `provideRouter([{ path: '', component: Snake }])`; en `beforeEach` stub de RAF: `vi.stubGlobal('requestAnimationFrame', () => 0)` y `cancelAnimationFrame`): monta y refleja `onState` en el HUD DOM; `vi.spyOn(ScoresService,'save').mockResolvedValue({ ok: true })` para verificar que guarda solo en `gameover`, envía `{ game: 'snake', score, name }`, sin doble guardado, y que el error fija `saveError`. Ajustar `GAMES_FIXTURE` (4 filas) en `src/app/testing/supabase-mock.ts` y el conteo en `games.service.spec.ts`. Comando: `npx ng test --watch=false`.
9. **Docs.** Actualizar `CLAUDE.md` ("Port status" y el bullet de `games/`): `snake` como **cuarto juego real** (motor TS en `games/snake/`, comida con `fruits.png`, wrap toroidal, una vida), creado vía `INSERT`; registrar la **limpieza del catálogo** (borrados los 5 placeholders) y la **nueva convención** (cada juego se crea en la BD al implementarlo, ya no se siembran placeholders).

---

## Criterios de aceptación

- [ ] `npm run build` y `npx ng test --watch=false` terminan sin errores.
- [ ] La tabla `games` tiene **exactamente 4 filas** (`asteroides`,`bloque-buster`,`caida`,`snake`), todas `playable: true`; los ids `serpentina`,`gloton`,`invasores`,`rocas`,`ranaria`,`duelo-pixel` ya no existen.
- [ ] `snake` existe en `games` con `playable: true`, `cover-snake`, `green`, `position` 3, `best` 0, `plays` '—'; aparece sin badge "PRÓXIMAMENTE" en la biblioteca y su ficha `/juego/snake` funciona.
- [ ] La biblioteca, el home y el Salón **ya no** muestran ninguno de los 5 juegos borrados.
- [ ] `/jugar/snake` carga el componente dedicado `Snake`; `/jugar/<otro-id>` sigue abriendo el `GamePlayer` simulado.
- [ ] El juego es jugable con teclado (flechas y WASD giran, con bloqueo de reversa 180°) y con los **4 botones táctiles** (↑/↓/←/→).
- [ ] La comida se dibuja con sprites reales de `fruits.png` (fruta aleatoria por aparición); comer alarga la serpiente en 1 segmento y suma los puntos de esa fruta según `FRUIT_POINTS`.
- [ ] La serpiente **atraviesa los bordes** (wrap toroidal): sale por un lado y reaparece por el opuesto; los muros no matan.
- [ ] Morderse a sí misma termina la partida (una sola vida): el motor pinta "GAME OVER" con el marcador en el canvas y `ESPACIO` reinicia.
- [ ] La velocidad **aumenta** al comer (el `stepInterval` baja; el HUD muestra la subida de VELOCIDAD).
- [ ] El HUD DOM neón (SCORE/LONGITUD/VELOCIDAD) refleja el estado notificado por el motor.
- [ ] La pausa (`P`/`Esc` o botón) congela el bucle y muestra "EN PAUSA" en el canvas; reanudar continúa sin reiniciar.
- [ ] En `gameover`, "GUARDAR PUNTUACIÓN" inserta en `scores` con `game_id: 'snake'`, el score final y las iniciales; muestra "GUARDANDO…", luego confirmación; sin doble guardado; en fallo avisa y permite reintentar; la marca aparece en la pestaña `snake` del Salón ordenada por puntuación.
- [ ] El canvas escala al contenedor preservando su aspecto **1:1** (celdas cuadradas); sin scroll horizontal a 360 px; la resolución interna se recalcula al redimensionar.
- [ ] Al abandonar `/jugar/snake` el motor se destruye: sin `requestAnimationFrame` activos ni listeners de teclado/`resize`; las flechas/espacio no hacen scroll de la página durante el juego.
- [ ] La app renderiza bajo SSR sin tocar `window`/`document`/canvas/`Image` en servidor (el motor solo se crea en navegador).
- [ ] Ningún componente consulta Supabase directamente; el motor no importa nada de Angular.
- [ ] `src/app/data/games.data.ts` y `GAMES_FIXTURE` reflejan las 4 filas reales (sin los juegos borrados).
- [ ] Sin errores en la consola al jugar, pausar, morir, guardar y salir.

---

## Decisiones tomadas y descartadas

- **Sí:** **borrar** la fila placeholder `serpentina` e **`INSERT`** de una fila nueva `snake` (`best` 0, `plays` '—'). **No:** reusar `serpentina` con `UPDATE playable=true` (convención de SPEC 07/08) — el usuario prefiere `id` `snake` y estrenar la convención "crear al implementar". Se reutiliza la clase `cover-snake` existente (coincide con `cover-<id>`).
- **Sí:** **construir Snake desde cero** (no hay `game.js`), motor **procedural** con la **misma API pública** que `AsteroidsEngine`/`CaidaEngine`. **No:** portar un original inexistente ni escribir la lógica como servicios Angular.
- **Sí:** **comida con sprites reales** de `fruits.png` (fruta aleatoria) + **serpiente con vectores neón**. **No:** recolorear las frutas a neón (se conserva su arte) ni buscar sprites de serpiente (el atlas no los trae).
- **Sí:** **puntos por fruta** (`FRUIT_POINTS` en 3 tramos) con crecimiento fijo de +1 segmento. **No:** puntuación plana +10 — el usuario quiere variedad por fruta.
- **Sí:** **wrap toroidal** (los bordes no matan; solo la auto-colisión). **No:** muerte al chocar con el muro — el usuario eligió atravesar.
- **Sí:** **una sola vida** — `phase` va de `playing` a `gameover` directo. **No:** vidas ni fase intermedia.
- **Sí:** **movimiento por tick** con aceleración por comida; `update(dt)` sin tocar `ctx` (testeable). **No:** movimiento continuo por frame — complica la grilla y los tests.
- **Sí:** **HUD DOM neón** (SCORE/LONGITUD/VELOCIDAD) alimentado por `onState` + **overlay de PAUSA/GAME OVER en el canvas** con reinicio por `ESPACIO`. **No:** overlay/botón Angular de fin — competiría con el reinicio del canvas.
- **Sí:** **canvas cuadrado 1:1** responsive (backing store con `devicePixelRatio`). **No:** resolución fija por atributo escalada por CSS.
- **Sí:** **limpiar el catálogo** borrando los 5 placeholders no implementados en BD + seed + fixtures, y **crear cada juego al implementarlo** de ahora en adelante. **No:** mantener placeholders no jugables ni limpiar solo la BD (dejaría seed/fixtures desfasados).
- **Sí:** alta/limpieza de catálogo **vía MCP** (`DELETE`/`INSERT`). **No:** versionar SQL en el repo (decisión heredada de SPEC 06).

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Borrar filas de `games` con `scores` dependientes (FK `scores_game_id_fkey`) | `scores` está **vacía** hoy; los juegos borrados nunca tuvieron puntuaciones. Si hubiera filas, habría que borrarlas antes. Un criterio verifica el catálogo final. |
| Fugas de `requestAnimationFrame` y listeners de teclado/`resize` al cambiar de ruta | `destroy()` centraliza el ciclo de vida y lo llama `ngOnDestroy`; un criterio de aceptación lo verifica. |
| El motor toca `window`/`document`/canvas/`Image` en SSR | Se instancia solo en navegador (`afterNextRender`); rutas en `RenderMode.Client`; la imagen se carga solo en navegador. |
| `ESPACIO`/flechas hacen scroll de la página mientras se juega | `preventDefault` en teclas de juego; listeners activos solo mientras corre; `ESPACIO` solo reinicia (en `gameover`). |
| Giro de 180° en un solo tick (la serpiente se auto-mata al revés) | `nextDir` ignora la dirección opuesta a `dir`; el giro se aplica al iniciar el `step`, no acumulado; un test lo cubre. |
| Comida que aparece sobre el cuerpo (celda ocupada) | `spawnFruit()` elige entre las celdas **libres**; si no quedan libres (serpiente llena la grilla), se considera victoria/fin controlado. |
| `fruits.png` no carga o tarda (dibujo de comida antes del `onload`) | Flag `imgReady`; mientras no esté lista se dibuja un marcador vectorial de reserva; la lógica (comer/puntuar) no depende de la imagen. |
| Canvas responsive deforma celdas (deben ser cuadradas) | Aspecto 1:1 forzado; backing store con `devicePixelRatio`; la grilla lógica sigue siendo `GRID×GRID`; acotar tamaño mínimo. |
| Doble toggle de pausa si el motor también bindea `P` | El motor **no** bindea `P`; la pausa la dispara solo el componente (`P`/`Esc`/botón) vía `pause()`/`resume()`. |
| Tests que dependen del canvas real (jsdom no implementa `2d`) | El motor se testea por lógica (giro/wrap/comer/auto-colisión/aceleración) sin `getContext`; `draw()` aislado; en el componente se stubbea RAF. |
| Fallo de red/RLS al guardar deja al jugador sin feedback | `save()` async devuelve `{ ok, error? }`; la UI muestra "GUARDANDO…", error y reintento; sin escritura silenciosa. |

---

## Lo que **no** entra en este spec

- Convertir en reales los juegos borrados (`gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`): cada uno, al implementarse, se **crea** en la BD con su propio spec.
- Sonido/música, power-ups, obstáculos, niveles, modo sin wrap, dificultad configurable, logros.
- Recolor neón de las frutas; sprites para la serpiente.
- Derivar `best`/`plays` de `scores`, realtime, migraciones versionadas, auth ligada a `scores`.
- Internacionalización.

Cada uno, si llega, va en su propio spec.
