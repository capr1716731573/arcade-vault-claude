# SPEC 05 — Juego Asteroides (primer juego real)

> **Estado:** Implementado
> **Depende de:** SPEC 01 (modelo `Game`, rutas `juego/:id` y `jugar/:id`, `GameDetail`, `GamePlayer`, `Library`/`GameCard`, `GamesService`, `ScoresService`, `SessionService`, marco CRT en `styles.css`), SPEC 02 (tema neón base, `prefers-reduced-motion`)
> **Fecha:** 2026-10-16
> **Objetivo:** Portar el clon vanilla de Asteroids (`references/started-games/02-asteroids/game.js`) a un motor TypeScript agnóstico y un componente Angular dedicado, publicado como juego nuevo `asteroides` jugable en `jugar/asteroides`.

---

## Alcance

**Dentro:**

- **Juego nuevo `asteroides`** en el catálogo (`GAMES`), id en minúsculas-kebab coherente con el resto. Convive con el `rocas` existente (que sigue siendo placeholder simulado); no se modifica `rocas`.
- **Motor TS aislado** `asteroids-engine.ts`: port fiel de `game.js` (clases `Bullet`/`Asteroid`/`Ship`/`Particle`/`PowerUp`, bucle `requestAnimationFrame`, input de teclado, envolvimiento toroidal, colisiones círculo-círculo, split de asteroides, partículas, power-up de triple disparo). Agnóstico de framework: no importa nada de Angular. API pública: `start()`, `pause()`, `resume()`, `restart()`, `destroy()`, entrada táctil (`setInput(action, pressed)`) y callback `onState(snapshot)`.
- **Componente dedicado** `Asteroids` en la ruta **`jugar/asteroides`** (declarada **antes** de `jugar/:id`). Hospeda el `<canvas>`, instancia el motor solo en navegador, lo destruye en `ngOnDestroy`, y refleja el estado notificado por el motor en signals.
- **Dos HUD coexistiendo:** el HUD y el overlay `GAME OVER` **dibujados dentro del canvas se conservan** (incluido `ESPACIO` para reiniciar); además el motor **notifica** su estado a Angular, que lo refleja en el HUD DOM del marco (puntuación/vidas/nivel/3x) con estilo neón.
- **Canvas realmente responsive:** el motor toma `W`/`H` del tamaño real del canvas/contenedor y los recalcula al redimensionar (no resolución fija 800×600).
- **Pausa** (no existe en el original): tecla `P`/`Esc` y botón de la plataforma que congela el bucle y muestra overlay "EN PAUSA".
- **Controles táctiles** en pantalla (rotar izquierda/derecha, propulsar, disparar) además del teclado, para móvil.
- **Guardado en el Salón con botón aparte:** fuera del canvas, un botón "GUARDAR PUNTUACIÓN" (con iniciales, por defecto el usuario de `SessionService` o `INVITADO`) que, en `gameover`, envía la puntuación notificada a `ScoresService.save({ game: 'asteroides', score, name })`. El canvas sigue gestionando el `gameover` y el reinicio con `ESPACIO`; **no** hay modal Angular de fin.
- **Etiqueta "PRÓXIMAMENTE"** (solo visual, **no bloquea**) en los demás juegos: campo `playable` en el modelo `Game` (`asteroides: true`, resto `false`). Tarjeta de biblioteca y ficha de detalle muestran el badge en los no jugables; `asteroides` no lo lleva. Los otros 7 siguen abriendo el `GamePlayer` simulado sin cambios de comportamiento.
- Portada CSS-only `cover-asteroides` para la tarjeta/ficha del juego nuevo.
- Reglas CSS nuevas en `src/styles.css` (canvas responsive dentro del CRT, controles táctiles, overlay de pausa, zona del botón de guardado, badge "PRÓXIMAMENTE", `cover-asteroides`), coordinando `frontend-design` + `ui-ux-pro-max`.
- Smoke tests Vitest del componente `Asteroids` y tests unitarios del motor.

**Fuera de alcance (para futuros specs):**

- Convertir `rocas` ni ningún otro de los 7 juegos restantes en juego real: siguen con el `GamePlayer` simulado. "PRÓXIMAMENTE" es solo visual y no deshabilita nada.
- Retirar o refactorizar el `GamePlayer` simulado y su data falsa.
- **Recolor neón** del juego: se conserva el look de vectores blancos sobre negro del original (el power-up 3x ya es cian).
- Guardar puntuaciones en **Supabase** (tabla `scores`, RLS): se sigue usando `ScoresService` + `localStorage` (`av_scores`) de SPEC 01. La migración a BD es su propio spec.
- Enemigos nuevos (OVNIs), sonido/música, dificultad configurable, marcador online, logros.
- Internacionalización (la UI queda solo en español).

## Modelo de datos

No introduce datos persistentes nuevos: el guardado reutiliza `ScoresService.save` → `localStorage` (`av_scores`) de SPEC 01. Introduce **una entrada de catálogo**, **un campo en el modelo `Game`** y **un contrato de estado motor → componente**.

Modelo `Game` (en `src/app/data/games.data.ts`) — nuevo campo:

```ts
export interface Game {
  // …campos existentes…
  playable?: boolean; // true solo en 'asteroides'; ausente/false ⇒ badge "PRÓXIMAMENTE" (no bloquea)
}
```

Nueva entrada en `GAMES` (valores de portada/texto afinables en diseño):

```ts
{
  id: 'asteroides',
  title: 'ASTEROIDES',
  short: 'Rota, propulsa y pulveriza la lluvia de rocas.',
  long: '…',
  cat: 'SHOOTER',
  cover: 'cover-asteroides',
  color: 'cyan',
  best: 0,
  plays: '—',
  playable: true,
}
```

Contrato de estado que el motor notifica al componente (ni el motor ni el contrato conocen Angular):

```ts
// src/app/games/asteroids/asteroids-engine.ts
export type AsteroidsPhase = 'playing' | 'dead' | 'gameover';

export interface AsteroidsState {
  score: number;
  lives: number;
  level: number;
  tripleShot: number; // segundos restantes del power-up 3x (0 si inactivo)
  phase: AsteroidsPhase;
}

export type TouchAction = 'left' | 'right' | 'thrust' | 'shoot';

export interface AsteroidsEngineOptions {
  onState: (s: AsteroidsState) => void; // invocado cuando cambia el estado observable
}

export class AsteroidsEngine {
  constructor(canvas: HTMLCanvasElement, opts: AsteroidsEngineOptions);
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;           // reinicia la partida (equivalente a ESPACIO en gameover)
  setInput(a: TouchAction, pressed: boolean): void; // controles táctiles
  destroy(): void;           // cancela RAF, quita listeners de teclado/resize
}
```

Convenciones: el motor vive en `process`-libre y solo-navegador (nada de `window`/`document`/`canvas` fuera del navegador); el componente lo instancia tras el render del navegador y lo destruye en `ngOnDestroy`; ningún componente importa `src/app/data/` directamente (usa `GamesService`/`ScoresService`); textos en español; se conserva el sistema de puntos del original (grande 20 / mediano 50 / pequeño 100, vía `POINTS` indexado por tamaño).

## Plan de implementación

1. **Catálogo + ruta.** Añadir el campo `playable?: boolean` a `Game`; añadir la entrada `asteroides` (`playable: true`) a `GAMES` y marcar los otros 7 con `playable: false`. Añadir la portada CSS-only `cover-asteroides` a `styles.css`. En `app.routes.ts`, declarar `{ path: 'jugar/asteroides', component: Asteroids }` **antes** de `{ path: 'jugar/:id', component: GamePlayer }`, con un componente `Asteroids` mínimo (cascarón). Prueba: `/jugar/asteroides` renderiza el cascarón; `/jugar/<otro>` sigue abriendo el `GamePlayer` simulado; `npm run build` compila.
2. **Motor.** Crear `src/app/games/asteroids/asteroids-engine.ts` portando `game.js`: clases `Bullet`/`Asteroid`/`Ship`/`Particle`/`PowerUp`, estado interno, `update(dt)`/`draw()`, bucle `requestAnimationFrame` con `dt` capado a 50 ms, envolvimiento `wrap`, colisiones `dist`, split, partículas y power-up 3x. Cambios respecto al original: `W`/`H` tomados del canvas (responsive, recalculados en `resize`); listeners de teclado propios con `preventDefault` en flechas/espacio y **activos solo mientras el motor corre**; `setInput` para táctil (alimenta los mismos flags que el teclado); `onState` se invoca al cambiar `score`/`lives`/`level`/`tripleShot`/`phase`; `pause`/`resume`/`restart`/`destroy`. Conservar el HUD y el overlay `GAME OVER` dibujados en canvas y el reinicio con `ESPACIO`. Prueba: tests unitarios (ver paso 6) y humo manual en `/jugar/asteroides`.
3. **Componente.** `src/app/games/asteroids/asteroids.ts|html` (standalone, signals). `viewChild` del `<canvas>`; instanciar el motor **solo en navegador** (`afterNextRender`/`isPlatformBrowser`) y `destroy()` en `ngOnDestroy`. Signals `score`/`lives`/`level`/`tripleShot`/`phase` actualizadas desde `onState`. Marco CRT reutilizado; HUD DOM neón que **refleja** el estado (coexiste con el HUD del canvas); botón/tecla de **pausa** (`P`/`Esc`) → `pause()`/`resume()` + overlay "EN PAUSA"; **controles táctiles** (pointer down/up → `setInput`); botón **"GUARDAR PUNTUACIÓN"** con input de iniciales (por defecto `SessionService.user()?.name ?? 'INVITADO'`) habilitado en `phase === 'gameover'` → `ScoresService.save({ game: 'asteroides', score, name })`, luego "▸ PUNTUACIÓN GUARDADA" (sin permitir doble guardado); enlace "VOLVER AL VAULT". Prueba: jugar, morir, guardar, ver la entrada reflejada; salir de la ruta no deja RAF ni listeners vivos.
4. **Próximamente.** En `game-card.html` mostrar un badge "PRÓXIMAMENTE" sobre la portada cuando `!game().playable`; en `game-detail.html` añadir la marca equivalente. No deshabilita "JUGAR"/"JUGAR AHORA" (sigue abriendo el player simulado). Prueba: la tarjeta/ficha de `asteroides` no lleva badge; las de los otros 7 sí.
5. **Estilos.** Añadir a `src/styles.css` las reglas del canvas responsive dentro del CRT (preservando aspecto y sin desbordar a 360 px), controles táctiles, overlay de pausa, zona del botón de guardado, badge "PRÓXIMAMENTE" y `cover-asteroides`. Coordinar `frontend-design` + `ui-ux-pro-max`: foco visible, contraste legible, `prefers-reduced-motion` atenúa animaciones decorativas (no la jugabilidad), SVG/íconos `aria-hidden`.
6. **Tests y cierre.** Unitarios del motor: `split()` reduce el tamaño y `size 1` no se parte; `POINTS` por tamaño; `wrap` toroidal; recoger power-up activa `tripleShot`; `gameover` tras agotar vidas. Smoke del componente `Asteroids`: monta el canvas, refleja `onState` en las signals, el botón de guardado llama a `ScoresService` con `game: 'asteroides'` (servicio mockeado) y solo en `gameover`, y el badge "PRÓXIMAMENTE" aparece según `playable`. Ejecutar `npx ng test --watch=false` y `npm run build`. Actualizar CLAUDE.md ("Port status": `asteroides` como primer juego real; motor TS en `games/asteroids/`; campo `playable`; `rocas` y los demás siguen simulados).

Cada paso deja la app compilando y navegable.

## Criterios de aceptación

- [ ] `npm run build` y `npx ng test --watch=false` terminan sin errores.
- [ ] Existe el juego `asteroides` en `GAMES` con `playable: true`; aparece en la biblioteca y su ficha `/juego/asteroides` funciona; `rocas` y los otros siguen intactos.
- [ ] `/jugar/asteroides` carga el componente dedicado `Asteroids` (no el `GamePlayer` simulado); `/jugar/<otro-id>` sigue cargando el `GamePlayer` simulado.
- [ ] El canvas es jugable con teclado: `←`/`→` rotan, `↑` propulsa, `Espacio` dispara; la nave y las balas envuelven los bordes.
- [ ] Al disparar a un asteroide grande se parte en medianos y estos en pequeños; los pequeños no se parten; la puntuación suma 20/50/100 según tamaño.
- [ ] Aparece el power-up de triple disparo y, al recogerlo, la nave dispara 3 balas durante su duración; el HUD muestra "3x" con el tiempo restante.
- [ ] El canvas conserva su HUD interno (SCORE/NIVEL/vidas/3x) y su overlay `GAME OVER` con `ESPACIO` para reiniciar.
- [ ] El marco de la plataforma muestra un HUD DOM neón que **refleja** puntuación/vidas/nivel/3x notificados por el motor (los dos HUD coinciden).
- [ ] La pausa (tecla `P`/`Esc` o botón) congela el bucle y muestra "EN PAUSA"; reanudar continúa la partida sin reiniciarla.
- [ ] Hay controles táctiles en pantalla (rotar izq/der, propulsar, disparar) que mueven y disparan igual que el teclado.
- [ ] En `gameover`, el botón "GUARDAR PUNTUACIÓN" (fuera del canvas) guarda en `ScoresService` con `game: 'asteroides'`, la puntuación final y las iniciales; tras guardar muestra confirmación y no permite doble guardado. Fuera de `gameover` el botón no guarda.
- [ ] El canvas escala al contenedor preservando su aspecto; sin scroll horizontal a 360 px de ancho; la resolución interna se recalcula al redimensionar.
- [ ] Las tarjetas/fichas de los 7 juegos no jugables muestran "PRÓXIMAMENTE"; la de `asteroides` no; "JUGAR"/"JUGAR AHORA" sigue funcionando en todos (no se bloquea).
- [ ] Al abandonar `/jugar/asteroides` el motor se destruye: no quedan `requestAnimationFrame` activos ni listeners de teclado/`resize`; las flechas/espacio no hacen scroll de la página durante el juego.
- [ ] La app renderiza bajo SSR sin tocar `window`/`document`/canvas en servidor (el motor solo se crea en navegador).
- [ ] Ningún componente importa `src/app/data/` directamente; el motor no importa nada de Angular.
- [ ] No hay errores en la consola del navegador al jugar, pausar, morir, guardar y salir.

## Decisiones tomadas y descartadas

- **Sí:** juego **nuevo** con id `asteroides` (minúsculas-kebab, como el resto). **No:** enganchar Asteroids al `rocas` existente — el usuario lo quiere como juego aparte aunque el catálogo ya tenga uno parecido.
- **Sí:** **componente dedicado** en ruta propia `jugar/asteroides` (antes de `jugar/:id`). **No:** que el `GamePlayer` genérico renderice el juego condicionalmente — se prefirió un componente con su propio chrome aun a costa de duplicar parte del marco.
- **Sí:** **motor TS aislado** portado de `game.js`, agnóstico de framework, con `onState` y `destroy`. **No:** reescribir la lógica como clases/servicios Angular — más riesgo de desviarse del comportamiento ya probado.
- **Sí:** **conservar el HUD y los controles internos del canvas** y, además, **notificar** a Angular para reflejar el estado fuera y guardar en el Salón ("usar los dos"). **No:** borrar el HUD del canvas y dejar solo el HUD DOM.
- **Sí:** guardado con **botón aparte** fuera del canvas; el canvas mantiene `gameover` + `ESPACIO`-reinicia del original. **No:** modal Angular de fin de partida (competía con el overlay y el reinicio del canvas).
- **Sí:** **canvas realmente responsive** (W/H del contenedor, recalculado en `resize`). **No:** resolución fija 800×600 escalada por CSS — el usuario prefirió adaptar el viewport aun sabiendo que cambia ligeramente distancias/jugabilidad.
- **Sí:** **controles táctiles** en este spec, además del teclado. **No:** diferir el táctil a un spec futuro.
- **Sí:** **pausa** nueva (`P`/`Esc` + botón), coherente con la plataforma. **No:** mantenerse 100 % fiel al original sin pausa.
- **Sí:** **vectores clásicos** blancos sobre negro (power-up 3x cian). **No:** recolor neón — se difiere; el marco CRT y el HUD neón dan ya el ambiente.
- **Sí:** campo **`playable`** en `Game` como marca visual "PRÓXIMAMENTE", **no bloqueante**; los otros 7 siguen abriendo el player simulado. **No:** deshabilitar el juego de los no jugables ni retirar el `GamePlayer` simulado (su refactor es otro spec).
- **Sí:** seguir guardando en `ScoresService` + `localStorage` (SPEC 01). **No:** guardar en Supabase todavía — es su propio spec.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Fugas de `requestAnimationFrame` y listeners de teclado/`resize` al cambiar de ruta | El motor centraliza el ciclo de vida; `destroy()` cancela el RAF y quita todos los listeners; el componente llama `destroy()` en `ngOnDestroy`; criterio de aceptación lo verifica. |
| El motor toca `window`/`document`/canvas durante SSR y rompe el render | Se instancia solo en navegador (`afterNextRender`/`isPlatformBrowser`); las rutas ya usan `RenderMode.Client`; el motor no se importa para ejecutarse en servidor. |
| Flechas/espacio hacen scroll de la página mientras se juega | `preventDefault` en las teclas de juego y listeners activos solo mientras el motor corre. |
| Canvas responsive altera distancias/velocidades y la jugabilidad a tamaños extremos | Recalcular `W`/`H` en `resize`; acotar un tamaño mínimo/aspecto razonable del contenedor; las constantes de radios/velocidades se revisan si el área cambia mucho. |
| Dos rutas de reinicio (`ESPACIO` del canvas y controles DOM) se pisan | El reinicio DOM (si lo hay) delega en `restart()` del motor; el guardado usa un botón aparte sin modal, de modo que `ESPACIO` y el botón no compiten por el foco. |
| "PRÓXIMAMENTE" sin bloquear confunde (el juego simulado sigue abriéndose) | Es una decisión explícita del usuario; el badge es solo informativo y se documenta; bloquear se difiere a otro spec. |
| El HUD del canvas y el HUD DOM se desincronizan | El HUD DOM se alimenta **solo** de `onState` del motor (fuente única); no recalcula estado por su cuenta. |
| Tests que dependen del canvas real (jsdom no implementa `2d`) | El motor se diseña testeando la lógica (split/puntos/wrap/power-up/gameover) sin depender de `getContext`; el `draw()` se aísla y en el componente el canvas se mockea. |

## Lo que **no** entra en este spec

- Convertir `rocas` u otros juegos en reales — siguen simulados.
- Retirar/refactorizar el `GamePlayer` simulado y su data falsa.
- Recolor neón del juego, sonido, OVNIs, dificultad configurable, logros.
- Guardar puntuaciones en Supabase (tabla `scores`, RLS) — su propio spec.
- Internacionalización.

Cada uno, si llega, va en su propio spec.
