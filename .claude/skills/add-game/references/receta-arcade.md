# Receta concreta — añadir un juego real a Arcade Vault

Esta es la receta reutilizable, destilada de **SPEC 05** (Asteroides) y **SPEC 06** (catálogo y
leaderboard en Supabase) y del código actual. La skill `/add-game` la consulta al redactar el
**Modelo de datos** y el **Plan de implementación** del spec, para que los pasos sean concretos y
fieles al patrón ya probado. El juego de referencia vive en `src/app/games/asteroids/`.

> Idea clave: la **capa de plataforma ya es genérica**. Añadir un juego real es, sobre todo, crear un
> motor + un componente + una fila en `games`. Los servicios y los consumidores del catálogo
> **no se tocan**: se verifican.

## Índice

1. Motor (`<id>-engine.ts`)
2. Componente (`<id>.ts` + `<id>.html`)
3. Rutas
4. Catálogo en Supabase (vía MCP)
5. Estilos (`src/styles.css`)
6. Consumidores genéricos (sólo verificar)
7. Tests
8. Archivos: crear / modificar / NO tocar
9. Mapeo id ↔ juego de referencia

---

## 1. Motor — `src/app/games/<id>/<id>-engine.ts`

Framework-agnóstico: **no importa nada de Angular**. Sólo toca `window`/`document`/canvas al
instanciarse. API pública espejo de `AsteroidsEngine`:

- `constructor(canvas: HTMLCanvasElement, opts: <Game>EngineOptions = {})` — toma
  `canvas.getContext('2d')`, llama a `resize()` e inicializa el juego. **No** adjunta listeners ni
  arranca el bucle todavía.
- `start()` — adjunta listeners de teclado, arranca `ResizeObserver`, resize, `running = true`, emite
  estado inicial (forzado) y lanza `requestAnimationFrame(this.loop)`.
- `pause()` — cancela el RAF, `running = false` (el último frame queda en pantalla).
- `resume()` — reanuda el RAF, limpia el latch de "recién pulsado".
- `restart()` — reinicia el juego + emite + reanuda (equivalente al `ESPACIO` del gameover).
- `setInput(action: TouchAction, pressed: boolean)` — mapea la acción táctil a las mismas banderas de
  tecla (p. ej. `left → ArrowLeft`), vía un `record` `TOUCH_CODE`.
- `destroy()` — `destroyed = true`, cancela RAF, quita listeners, desconecta `ResizeObserver`.
- `getState(): <Game>State` — snapshot (también para el valor inicial del HUD).
- `update(dt)` **público** y **sin tocar `ctx`** (testeable); `draw()` es el único que usa `ctx`.

Detalles que deben quedar en el spec/implementación:

- **Responsive:** `resize()` lee `canvas.clientWidth/clientHeight` (fallback a la resolución base),
  multiplica por `devicePixelRatio` para el backing store, fija `W`/`H` en px CSS y
  `ctx.setTransform(dpr,0,0,dpr,0,0)`. Un `ResizeObserver` sobre el canvas re-llama a `resize()`.
- **Teclado SSR-safe:** un `Set` de teclas de juego; en `keydown`, `preventDefault()` si la tecla es
  de juego. `attachListeners()`/`detachListeners()` guardan con `this.listening` y
  `typeof window === 'undefined'`. Listeners activos **sólo mientras el motor corre** (alta en
  `start()`, baja en `destroy()`).
- **`emitState(force=false)`:** construye una clave de deduplicado con los campos observables y sólo
  llama a `onState` cuando cambian (o forzado) — así la detección de cambios de Angular dispara sólo
  en cambios reales.
- **Bucle:** `loop(ts)` → `update(dt)` + `draw()`; `dt` capado (p. ej. 0.05 s).
- **Exporta** para tests los tipos (`<Game>State`/`<Game>Phase`/`TouchAction`/`<Game>EngineOptions`),
  las clases/entidades y las constantes (puntos, radios, etc.).

## 2. Componente — `src/app/games/<id>/<id>.ts` + `<id>.html`

- `@Component` standalone, `imports: [EsNumberPipe, RouterLink]`,
  `host: { class: 'av-player fade-in', style: 'display: block' }`, `implements OnDestroy`.
- Canvas: `viewChild.required<ElementRef<HTMLCanvasElement>>('canvas')`.
- Signals espejo de `onState` + UI: `paused`, `saved`, `saving`, `saveError`, y
  `name = signal(inject(SessionService).user()?.name ?? 'INVITADO')`.
- **Creación del motor sólo en navegador** (en el constructor):
  ```ts
  afterNextRender(() => {
    this.zone.runOutsideAngular(() => {
      const engine = new <Game>Engine(canvas, {
        onState: (s) => this.zone.run(() => this.applyState(s)),
      });
      engine.start();
      this.engine = engine;
    });
  });
  ```
  El bucle RAF vive **fuera** de la zona de Angular; `onState` re-entra con `zone.run` sólo al
  cambiar. **No** añadas `isPlatformBrowser` dentro de `afterNextRender` (ya es sólo-navegador).
- Handler aparte de `keydown` para `P`/`Escape` → alterna pausa (con `preventDefault`), guardado en un
  campo para quitarlo en `ngOnDestroy`.
- `ngOnDestroy()`: `this.engine?.destroy()`, anularlo y quitar el handler de pausa.
- `applyState(s)` copia estado a signals y, si detecta un reinicio en el canvas
  (`phase === 'playing'` tras `saved`/`saveError`), rehabilita el guardado.
- Táctil: `press(action, pressed, e)` → `e.preventDefault()` + `engine.setInput(action, pressed)`.
- **Guardado** (sólo en `gameover`, sin doble guardado):
  ```ts
  if (this.phase() !== 'gameover' || this.saved() || this.saving()) return;
  this.saving.set(true); this.saveError.set(null);
  const res = await this.scores.save({ game: '<id>', score: this.score(), name: this.name() });
  this.saving.set(false);
  res.ok ? this.saved.set(true) : this.saveError.set(res.error ?? 'No se pudo guardar la puntuación.');
  ```
  `setName(v)` pasa a mayúsculas y corta a 10–12 chars.
- **Esqueleto HTML reutilizable:** `.player-hud` (stats + `.hud-actions` con PAUSA/REANUDAR y SALIR);
  `.crt > .crt-screen` con `<canvas #canvas>` y `@if (paused())` `.game-overlay` "EN PAUSA";
  `.touch-controls` con `.touch-cluster`/`.touch-btn` (pointerdown/up/leave/cancel → `press`);
  `.crt-bottom`; `@if (phase() === 'gameover')` `.av-save` con marcador final, input de iniciales,
  botón cuyo label es `saving() ? 'GUARDANDO…' : saveError() ? 'REINTENTAR' : 'GUARDAR PUNTUACIÓN'`,
  línea de error opcional y "VOLVER AL VAULT".

## 3. Rutas — `src/app/app.routes.ts`

Añadir `{ path: 'jugar/<id>', component: <Game> }` y su import, **antes** de
`{ path: 'jugar/:id', component: GamePlayer }`. (El orden importa: la ruta literal gana a la
paramétrica.) SSR: `app.routes.server.ts` ya usa `RenderMode.Client`.

## 4. Catálogo en Supabase — vía MCP (como SPEC 06)

- Si el juego ya existe como fila sembrada (placeholder): `update public.games set playable = true
  where id = '<id>';`
- Si es nuevo: `insert into public.games (...) values (...)` con `playable = true`, `cover = 'cover-<id>'`
  y un `position` coherente.
- Usar `mcp__supabase__apply_migration` (o `execute_sql`). **No** versionar SQL en el repo (decisión
  de SPEC 06).
- `scores` **no necesita nada**: es una tabla única con `game_id`; el leaderboard ya consulta por
  `game_id = '<id>'`.
- Opcional: mantener en sincronía la entrada de `src/app/data/games.data.ts` (hoy es artefacto de
  referencia/siembra; runtime lee de la BD).
- Si cambiaras el esquema, regenerar `src/app/database.types.ts` con
  `mcp__supabase__generate_typescript_types` (normalmente no hace falta).

## 5. Estilos — `src/styles.css` (hoja global única, sin CSS por componente)

- Añadir `.cover-<id>` en el bloque de "Cover art generators (pure CSS)" — portada CSS-only usada por
  la tarjeta y la ficha (patrón: gradientes + `::before`/`::after`).
- Canvas: reutilizar el cuerpo de `.asteroids-canvas` (absolute, inset 0, 100%/100%,
  `touch-action: none`) o clonarlo como `.<id>-canvas` si difiere.
- **Ya existen y no hay que recrear:** `.soon-badge`(`.lg`), el marco CRT (`.av-player`, `.player-hud`,
  `.crt`, `.crt-screen`, `.crt-bottom`), `.game-overlay`, `.touch-controls`/`.touch-cluster`/
  `.touch-btn`, `.av-save` y sus hijos, y el `@media prefers-reduced-motion` (sólo calma decoración).
- Coordinar **`frontend-design` + `ui-ux-pro-max`** (regla de `CLAUDE.md`).

## 6. Consumidores genéricos — sólo VERIFICAR (no editar)

`GameCard` (badge "PRÓXIMAMENTE" sólo si `!playable`), `GameDetail` (ficha + leaderboard por `top`),
`HallOfFame` (pestañas por juego, "sin puntuaciones aún" vacío), `Library` y `Home` ya renderizan
cualquier fila del catálogo y el Salón ya indexa por `game_id`. Verificar que el juego nuevo aparece
y que el badge desaparece al poner `playable: true`.

## 7. Tests (Vitest + jsdom)

- `src/app/games/<id>/<id>-engine.spec.ts` — lógica pura, `new <Game>Engine(document.createElement('canvas'))`,
  conduce la simulación poniendo arrays públicos y llamando `e.update(dt)`. **Sin** `getContext`/`draw`.
  Cubrir las reglas de la mecánica (puntos por tamaño/línea, colisiones/split/clear, power-ups,
  `gameover` al agotar vidas, etc.).
- `src/app/games/<id>/<id>.spec.ts` — `TestBed` + `provideRouter([{ path: '', component: <Game> }])`;
  en `beforeEach` **stub de RAF** para que el bucle sea inerte en jsdom:
  ```ts
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  ```
  Montar y comprobar el HUD DOM; `vi.spyOn(ScoresService, 'save').mockResolvedValue({ ok: true })`
  para probar que guarda sólo en `gameover`, envía `{ game: '<id>', score, name }`, sin doble
  guardado, y que el error fija `saveError`.
- Si añades fila al catálogo, extender `GAMES_FIXTURE` en `src/app/testing/supabase-mock.ts` y el
  conteo en `games.service.spec.ts`. El mock expone `provideSupabaseMock(data)` con un `client.from`
  encadenable y thenable (`select/eq/order/limit/insert`) y `settle()` (await `whenStable`).
- Comandos: `npx ng test --watch=false` (una pasada); un archivo:
  `npx ng test --include=src/app/games/<id>/<id>.spec.ts`.

## 8. Archivos: crear / modificar / NO tocar

**Crear (5):** `src/app/games/<id>/<id>-engine.ts`, `<id>.ts`, `<id>.html`, `<id>-engine.spec.ts`,
`<id>.spec.ts`.

**Modificar (3–4):** `src/app/app.routes.ts`, `src/styles.css`, `CLAUDE.md` (Port status) y,
opcionalmente, `src/app/data/games.data.ts` y `src/app/testing/supabase-mock.ts`.

**Supabase:** un `UPDATE`/`INSERT` en `games` (`playable = true`); `scores` nada.

**NO tocar:** `supabase.service.ts`, `games.service.ts`, `scores.service.ts`, `scores.data.ts`,
`database.types.ts` (regenerar sólo si cambia el esquema), y todos los componentes consumidores del
catálogo. El `GamePlayer` simulado queda intacto para los juegos no portados.

## 9. Mapeo id ↔ juego de referencia

- `references/started-games/02-asteroids` → `asteroides` (ya portado; es el modelo).
- `references/started-games/03-tetris` → placeholder `caida` (PUZZLE). Procedural, HUD en DOM,
  `style.css`, canvas de preview (`#next-canvas`), toggle de tema; canvas 300×600. Entradas: flechas,
  X rotar, Espacio hard-drop, P pausa.
- `references/started-games/04-arkanoid` → placeholder `bloque-buster` (ARCADE). Procedural,
  **spritesheet PNG + sonidos .mp3**, `levels.js`, orden de carga de scripts; HUD en canvas; ratón
  mueve la pala. Requiere portar assets y cargarlos sólo en navegador.
- `rocas` ≈ placeholder tipo asteroids (NO es el asteroides real; sigue simulado).

> Nota de port: la fuente puede ser procedural (tetris/arkanoid) en vez de orientada a clases
> (asteroids). El motor TS portado puede ser procedural internamente mientras **exponga la misma API
> pública** (`start/pause/resume/restart/destroy/setInput/getState/onState`) y mantenga `update(dt)`
> sin tocar `ctx`.
