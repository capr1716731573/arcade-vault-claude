# SPEC 13 — Rendimiento de Frogger + clase base `GameEngine` reutilizable

> **Estado:** Aprobado
> **Depende de:** SPEC 12 (Frogger: motor `frogger-engine.ts` + componente `Frogger`, es lo que se optimiza), SPEC 05 (patrón «motor TS agnóstico + ciclo de vida RAF/resize/teclado/emitState» del que se destila la base)
> **Fecha:** 2026-10-24
> **Objetivo:** Optimizar el rendimiento del motor de Frogger y extraer una clase base abstracta `GameEngine` que elimine la duplicación del ciclo de vida, aplicándola **solo a Frogger**, sin tocar la jugabilidad, los otros juegos, los servicios ni la base de datos.

---

## Por qué existe este spec

Frogger presenta tirones de rendimiento (perceptibles sobre todo en móvil y con el skin `neon`). El análisis del motor actual (`src/app/games/frogger/frogger-engine.ts`) encuentra tres causas concretas, todas en el camino caliente (`loop` → `update` → `draw`, 60 veces por segundo):

1. **Fondo estático repintado cada frame.** `drawZones()` hace 14 `fillRect` de franjas + 5 líneas discontinuas de carril en **cada** frame, aunque el fondo no cambia nunca salvo al redimensionar o cambiar de skin.
2. **`shadowBlur` por entidad.** Con el skin `neon` (`glow: 10`) cada coche, camión, tortuga y la rana se dibujan con `shadowBlur`. Son ~100 rellenos con sombra por frame. `shadowBlur` es de las operaciones más caras del canvas 2D; es el cuello de botella principal.
3. **Asignaciones por frame (presión de GC).** Literales de array creados en el camino caliente: `[0, -CANVAS_W, CANVAS_W]` en el bucle de dibujo (una vez por entidad) y `[col, col - COLS, col + COLS]` en `spans()` (una vez por comprobación), más la *string key* que `emitState` construye cada frame para el dedupe. Además `laneForRow()` es un `this.lanes.find()` llamado varias veces por frame (en `update`, dos veces seguidas en la rama de río).

En paralelo, los **5 motores del repo** (asteroides, caída, bloque-buster, snake, frogger) **copian** la misma infraestructura de ciclo de vida: bucle RAF con cap de `dt`, `resize()`/DPR/`ResizeObserver`, listeners de teclado con `preventDefault`, `emitState` con dedupe, `pause`/`resume`/`restart`/`destroy` y los flags `running`/`destroyed`/`listening`. Son ~14 líneas idénticas repetidas 5 veces: la «mala práctica» que el usuario quiere corregir.

Decisiones del usuario que acotan el alcance (bloque de preguntas de este spec):

1. **Alcance acotado a Frogger.** Solo se optimiza Frogger y solo Frogger adopta la base. Los otros 4 motores **no se tocan** en este spec.
2. **Clase base abstracta.** La reutilización se hace con una clase base `GameEngine<State>` que Frogger **extiende**; no helpers sueltos.
3. **Se permite cambiar cómo se dibuja.** Se autoriza cachear el fondo, limitar `shadowBlur` y quitar asignaciones por frame aunque el neón cambie de forma casi imperceptible. La jugabilidad y los colores base no cambian.
4. **Verificación con objetivos concretos.** Los criterios de aceptación son umbrales booleanos (fps, asignaciones, nº de `shadowBlur`), no «se siente fluido».

---

## Alcance

**Dentro:**

- **Clase base abstracta `GameEngine<State>`** en `src/app/games/game-engine.ts`, agnóstica de framework (no importa nada de Angular). Concentra el **ciclo de vida común** que hoy está duplicado:
  - Campos y constructor: `canvas`, `ctx`, `onState?`, y los flags/handles del ciclo (`running`, `destroyed`, `listening`, `paused`, `rafId`, `lastTime`, `resizeObserver`, `lastStateKey`).
  - Métodos concretos: `start()`, `pause()`, `resume()`, `restart()`, `destroy()`, el `loop` (driver RAF con cap de `dt`), `emitState(force?)` con dedupe, y helpers `attachListeners()`/`detachListeners()`/`observeResize()`.
  - **Puntos de extensión abstractos** que implementa cada juego: `update(dt)`, `draw()`, `getState(): State`, `stateKey(s: State): string` (clave de dedupe sin asignar strings genéricas), `resetGame()` (lo que hoy es `initGame()`), y hooks de teclado/tamaño (`handleKey(e)`, `resize()`).
  - **API pública idéntica** a la actual de los motores (no cambia la firma que consume el componente).
- **Migración de `FroggerEngine`** para que **extienda `GameEngine<FroggerState>`**: se borran del motor de Frogger las ~14 líneas de ciclo de vida duplicadas (ahora en la base) y se implementan los puntos de extensión. La API pública (`start`/`pause`/`resume`/`restart`/`destroy`/`setInput`/`setSkin`/`getState`/`onState`) **no cambia**.
- **Optimización de dibujo de Frogger:**
  - **Fondo cacheado**: las zonas (14 franjas) y las líneas discontinuas de carril se pintan **una vez** en un buffer offscreen (canvas desacoplado al tamaño del plano lógico 640×560), y cada frame se vuelca con un único `drawImage`. El buffer se reconstruye solo en `resize()` y en `setSkin()`.
  - **`shadowBlur` acotado**: el glow (`shadowBlur > 0`) se aplica **como máximo a la rana** (y, si procede, al overlay), **nunca por entidad**. Coches, camiones, troncos y tortugas se dibujan con rellenos neón planos (sin sombra). El resto del look (colores saturados, fondo, glow de la rana) conserva la identidad neón.
  - **Cero asignaciones por frame** en el camino caliente: subir `WRAP_OFFSETS = [0, -CANVAS_W, CANVAS_W]` a constante de módulo; reescribir `spans()` sin literal de array; sustituir la *string key* de `emitState` por comparación campo a campo (o `stateKey` que no cree strings salvo cuando cambie el estado).
  - **Dedupe de `laneForRow()`**: construir un índice `lanesByRow` (mapa fila→carril) en `buildLanes()` para lookup O(1), y en `update` calcular el carril de la rana una sola vez y reutilizarlo.
  - **Saltar pasadas de wrap innecesarias**: dibujar las copias desplazadas (`-CANVAS_W`/`+CANVAS_W`) de una entidad solo cuando está cerca de un borde; la copia central siempre.
- **Tests** (`frogger-engine.spec.ts` existente): siguen pasando sin cambiar lo que verifican (lógica pura: salto/colisión/soporte/bocas/timer/vidas/puntuación). Se ajustan solo si alguna firma interna cambió. Se puede añadir algún test de la base (`game-engine.spec.ts`) para el dedupe de `emitState` y el cap de `dt` con un motor de juguete.
- **Verificación de rendimiento** con objetivos concretos (ver Criterios).

**Fuera de alcance (para futuros specs):**

- **Migrar los otros 4 motores** (asteroides, caída, bloque-buster, snake) a `GameEngine`: quedan intactos con su infraestructura actual. La base se diseña para que la adopten después.
- **Optimizar** asteroides/caída/bloque-buster/snake (su `shadowBlur`, su dibujo): no se tocan.
- **Cambiar la jugabilidad, las reglas, la dificultad o los colores base** de Frogger: la mecánica y la paleta de cada skin se conservan (solo se cambia *cómo* y *cuándo* se dibuja).
- **Cambios en el componente** `Frogger` (`frogger.ts`/`.html`), salvo que la migración obligue a un retoque mínimo de tipos; no se cambia su comportamiento ni su marcado.
- **Servicios, BD (`games`/`scores`), rutas, catálogo**: intactos.
- **Un componente `GamePad` compartido**, sonido, Web Workers / `OffscreenCanvas` en hilo aparte, dirty-rectangles parciales más finos: no.
- **Internacionalización** (la UI queda en español).

---

## Modelo de datos

**Este spec no introduce estructuras de datos de negocio ni cambios en la base de datos.** No toca `games`, `scores`, `SupabaseService`, `GamesService` ni `ScoresService`. El `FroggerState` (`score`/`lives`/`level`/`timeLeft`/`phase`) y las constantes de Frogger **no cambian**.

El único «contrato» nuevo es la **forma de la clase base** (TS, firmas, sin cuerpos — el código se escribe en la implementación):

```ts
// src/app/games/game-engine.ts
export interface GameEngineOptions<State> {
  onState?: (s: State) => void; // invocado solo cuando cambia el estado observable (dedupe)
}

/** Ciclo de vida común de los motores de juego (agnóstico de framework). */
export abstract class GameEngine<State> {
  protected readonly ctx: CanvasRenderingContext2D | null;
  protected readonly onState?: (s: State) => void;
  protected running = false;
  protected destroyed = false;
  protected paused = false;
  constructor(protected readonly canvas: HTMLCanvasElement, opts?: GameEngineOptions<State>);
  // Concretos (iguales para todos los juegos):
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
  protected emitState(force?: boolean): void; // dedupe por stateKey()
  // Puntos de extensión (cada juego los implementa):
  abstract update(dt: number): void;          // no toca ctx (testeable)
  protected abstract draw(): void;             // único que usa ctx
  abstract getState(): State;
  protected abstract stateKey(s: State): string;
  protected abstract resetGame(): void;        // lo que hoy es initGame()
  protected abstract resize(): void;           // plano fijo o responsivo según el juego
  protected abstract handleKey(e: KeyboardEvent): void; // teclado específico del juego
}
```

Tras la migración, `FroggerEngine extends GameEngine<FroggerState>` conserva su API pública y añade solo lo específico de Frogger (zonas, carriles, salto, soporte, bocas, dibujo, skins). Convenciones de dibujo nuevas (recomendadas; `spec-impl` puede afinar nombres):

- `WRAP_OFFSETS: readonly number[]` — constante de módulo `[0, -CANVAS_W, CANVAS_W]`.
- `bgCanvas: HTMLCanvasElement | null` — buffer del fondo (zonas + dashes), tamaño lógico 640×560, repintado en `resize()`/`setSkin()`.
- `lanesByRow: Map<number, Lane>` (o array indexado por fila) — índice O(1) construido en `buildLanes()`.
- Regla de glow: `shadowBlur > 0` se usa **solo** al pintar la rana (y opcionalmente el overlay); las entidades se pintan sin sombra.

---

## Plan de implementación

Numerado; cada paso deja la app **compilando y jugable** (Frogger funciona igual al terminar cada paso).

1. **Base — esqueleto.** Crear `src/app/games/game-engine.ts` con `GameEngine<State>` (campos, constructor, flags) y los **métodos concretos** del ciclo de vida (`start`/`pause`/`resume`/`restart`/`destroy`, `loop` con cap de `dt`, `emitState` con dedupe por `stateKey`, `attachListeners`/`detachListeners`/`observeResize`) y las **firmas abstractas** (`update`/`draw`/`getState`/`stateKey`/`resetGame`/`resize`/`handleKey`). Nadie la usa aún. Prueba: `npm run build` compila.
2. **Frogger extiende la base.** Reescribir `frogger-engine.ts` para `extends GameEngine<FroggerState>`: eliminar las líneas de ciclo de vida ya cubiertas por la base; implementar `update`/`draw`/`getState`/`stateKey`/`resetGame`(=`initGame`)/`resize`/`handleKey`. **Sin cambiar aún el dibujo** (misma salida visual). La API pública se mantiene idéntica. Prueba: `/jugar/frogger` se ve y se juega exactamente igual; `npm run build` compila; `frogger-engine.spec.ts` verde.
3. **Fondo cacheado.** Añadir el buffer offscreen del fondo (zonas + líneas de carril) pintado en `resize()`/`setSkin()`; en `draw()` volcarlo con un único `drawImage` en lugar de `drawZones()` por frame. Prueba: el fondo se ve igual; `drawZones` completo no corre por frame (revisión + manual).
4. **`shadowBlur` acotado.** Quitar el `shadowBlur` de coches/camiones/troncos/tortugas (rellenos planos); conservar el glow solo en la rana (y overlay). Prueba: la escena sigue leyéndose neón; `shadowBlur > 0` se configura ≤2 veces por frame (revisión de código).
5. **Cero asignaciones por frame.** Subir `WRAP_OFFSETS` a constante de módulo; reescribir `spans()` sin literal de array; sustituir la *string key* de `emitState`/`stateKey` por comparación sin asignar en estado estable; construir `lanesByRow` en `buildLanes()` y usarlo en `update`/`getSupport`/`checkRoadCollision` (carril de la rana calculado una vez). Saltar las copias de wrap lejos de los bordes. Prueba: revisión del camino caliente sin literales/strings nuevos por frame; juego idéntico.
6. **Verificación de rendimiento.** Medir con el panel Performance / contador de FPS de Chrome, con el skin `neon`, en desktop y en el móvil de referencia (LAN, el mismo de SPEC 10/11). Comprobar los umbrales de los Criterios. Prueba: objetivos cumplidos; sin regresión de jugabilidad.
7. **Tests + docs.** `frogger-engine.spec.ts` verde (ajustes solo si cambió una firma, sin cambiar lo verificado); opcional `game-engine.spec.ts` (dedupe + cap de `dt` con un motor de juguete). Comando: `npx ng test --include=src/app/games/frogger/frogger-engine.spec.ts --watch=false` (la suite completa no, por riesgo OOM). Actualizar `CLAUDE.md`: nota en el bullet de `games/frogger/` (ahora extiende `GameEngine`, fondo cacheado, glow solo en la rana) y mención de la base `games/game-engine.ts` como punto de reutilización que los demás motores adoptarán en specs futuros.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores y `npx ng test --include=src/app/games/frogger/frogger-engine.spec.ts --watch=false` pasa. (La suite completa no se corre por riesgo OOM.)
- [ ] Existe `src/app/games/game-engine.ts` con la clase abstracta `GameEngine<State>`; **no importa nada de Angular**.
- [ ] `FroggerEngine extends GameEngine<FroggerState>` y **no** contiene su propio bucle RAF, `ResizeObserver`, `attach/detachListeners`, `emitState` ni los flags de ciclo de vida: todo eso vive en la base.
- [ ] La **API pública** del motor de Frogger (`start`/`pause`/`resume`/`restart`/`destroy`/`setInput`/`setSkin`/`getState`/`onState`) es idéntica; el componente `Frogger` no requiere cambios de comportamiento.
- [ ] **Jugabilidad sin cambios**: salto de 1 celda/120 ms, carretera/río/tortugas/bocas/timer/3 vidas/puntuación se comportan exactamente igual (los tests de lógica lo confirman).
- [ ] **Aspecto sin cambios perceptibles**: mismas zonas, mismos colores base de cada skin (clásico/neón/retro), misma rana; la única diferencia admitida es que las entidades no tienen glow propio.
- [ ] El **fondo estático** (zonas + líneas de carril) se pinta en un buffer cacheado; `drawZones` completo se ejecuta solo al crear el motor, en `resize()` y en `setSkin()`, **no** cada frame.
- [ ] `shadowBlur > 0` se configura **≤2 veces por frame** (rana + overlay), nunca por entidad (verificable por revisión de código).
- [ ] **Cero asignaciones por frame** en el camino caliente (`loop`/`update`/`draw`) mientras el estado observable no cambia: sin literales de array/objeto nuevos ni *strings* nuevas por frame (revisión de código; opcional: panel Memory sin sierra de GC jugando 30 s).
- [ ] Con el skin `neon`, el juego mantiene **60 fps estables en desktop** (contador de FPS / panel Performance de Chrome) jugando una ronda completa.
- [ ] En el **móvil de referencia** (LAN), el juego corre **sin caídas de frames visibles** con el skin `neon` (antes había tirones).
- [ ] `laneForRow` ya no se resuelve con `.find()` en el camino caliente: hay un índice fila→carril y el carril de la rana se calcula una sola vez por frame.
- [ ] La app sigue renderizando bajo SSR sin tocar `window`/`document`/canvas en servidor (motor creado solo en navegador).
- [ ] Sin errores en consola al jugar, pausar, morir, reiniciar, cambiar de skin y salir; sin `requestAnimationFrame` ni listeners vivos tras abandonar la ruta.

---

## Decisiones tomadas y descartadas

- **Sí:** **clase base abstracta `GameEngine<State>`** que Frogger extiende. **No:** helpers sueltos sin herencia — el usuario eligió la base; concentra el ciclo de vida en un punto y da el molde que adoptarán los demás motores.
- **Sí:** **crear la base aunque hoy solo la use Frogger**, documentando que los otros 4 la adoptarán en specs futuros. **No:** diferir la base hasta migrar varios motores — el repo añade juegos con regularidad (`/add-game`), así que la base tiene reutilización clara y evita seguir copiando el ciclo de vida.
- **Sí:** **acotar el alcance a Frogger** (los otros 4 motores intactos). **No:** migrar/optimizar los 5 ahora — más riesgo de regresión del que el usuario quiere asumir en un solo spec.
- **Sí:** **cachear el fondo** en un buffer offscreen. **No:** redibujar zonas + dashes cada frame — es trabajo constante inútil.
- **Sí:** **glow solo en la rana** (y overlay), entidades planas. **No:** `shadowBlur` por entidad — es el mayor coste por frame; el usuario autorizó el cambio visual casi imperceptible.
- **Sí:** **eliminar asignaciones por frame** (constantes de módulo, `stateKey` sin strings en estado estable, índice `lanesByRow`). **No:** dejar la presión de GC «porque es poco» — se acumula a 60 fps y causa tirones.
- **Sí:** **conservar la API pública** del motor y **no tocar el componente**. **No:** rediseñar el contrato `onState`/`setInput` — rompería al consumidor sin necesidad.
- **Sí:** **verificar con umbrales concretos** (60 fps desktop, sin caídas en móvil de referencia, 0 asignaciones/frame, ≤2 `shadowBlur`/frame). **No:** criterios cualitativos («se siente fluido») — no son booleanos.
- **Sí:** mantener `update(dt)` **sin tocar `ctx`** (testeable) y `draw()` aislado. **No:** mezclar simulación y dibujo al refactorizar.

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| La migración a la base cambia sin querer la jugabilidad o el aspecto | API pública y `FroggerState` intactos; tests de lógica verdes; comparación visual manual por skin; criterios de «sin cambios» explícitos. |
| Base abstracta usada por un solo consumidor = abstracción prematura (otra «mala práctica») | Se documenta como molde para los otros 4 motores y los juegos futuros (`/add-game`); el ciclo de vida que concentra ya está probado y duplicado 5 veces. |
| El buffer de fondo cacheado se ve borroso o mal escalado con DPR/`setTransform` | El buffer se dibuja al tamaño del plano lógico (640×560) y se vuelca respetando la transformación del canvas; verificación visual en resize y en móvil. |
| El fondo cacheado no se refresca al cambiar de skin | `setSkin()` invalida y repinta el buffer; criterio de aceptación lo cubre. |
| Quitar el glow de las entidades degrada demasiado el look neón | El fondo, los colores saturados y el glow de la rana conservan la identidad; decisión explícita del usuario; reversible si no convence al revisar. |
| Las medidas de fps dependen de la máquina y no son reproducibles | Se fija el skin (`neon`), el móvil de referencia (LAN, SPEC 10/11) y la herramienta (Performance/FPS de Chrome); los demás criterios (asignaciones, nº de `shadowBlur`, fondo cacheado) son verificables por código, no por hardware. |
| Fugas de RAF/listeners si la base gestiona mal `destroy()` | La base centraliza `destroy()` (cancela RAF, quita teclado, desconecta `ResizeObserver`); criterio de «sin RAF/listeners vivos» al salir. |
| `game-engine.ts` toca `window`/`ResizeObserver` en SSR | La base solo instala listeners/observer dentro de `start()`/`observeResize()` con guardas `typeof window`/`ResizeObserver` (como hoy); el motor se crea solo en navegador. |

---

## Lo que **no** entra en este spec

- **Migrar u optimizar los otros 4 motores** (asteroides, caída, bloque-buster, snake): intactos; adoptarán `GameEngine` en specs futuros.
- **Cambiar la jugabilidad, reglas, dificultad o colores base** de Frogger; cambiar el **componente**, los **servicios**, las **rutas** o la **BD**.
- **Componente `GamePad` compartido**, sonido, `OffscreenCanvas` en Worker, dirty-rectangles parciales más finos.
- **Internacionalización.**

Cada uno, si llega, va en su propio spec.
