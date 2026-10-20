# SPEC 10 — Jugabilidad móvil táctil (canvas arriba + mando unificado) + auditoría responsive

> **Estado:** Aprobado
> **Depende de:** SPEC 05 (Asteroides: patrón motor TS + componente + marco CRT/táctil/guardado en `styles.css`), SPEC 07 (Caída), SPEC 08 (Bloque Buster), SPEC 09 (Snake)
> **Fecha:** 2026-10-20
> **Objetivo:** Rehacer **solo en móvil** la pantalla de juego de los 4 juegos (canvas arriba, mando táctil unificado abajo, barra de pie con pausa/salir y botón «JUGAR DE NUEVO» para reiniciar sin teclado) y auditar el resto de la app a 360px, sin tocar la jugabilidad de los motores ni el escritorio.

---

## Por qué existe este spec

Los 4 juegos reales (Asteroides, Caída, Bloque Buster, Snake) ya traen controles táctiles y la shell ya es responsive (navbar hamburguesa a ≤840px). Pero al abrirlos en un teléfono real hay huecos de jugabilidad que impiden jugar de verdad:

1. **El reinicio depende del teclado.** En game over/victoria el texto dice «O PULSA ESPACIO EN LA PANTALLA PARA JUGAR DE NUEVO»; en un móvil sin teclado es **imposible reiniciar** sin salir y volver a entrar. Cada motor ya expone `restart()` público, pero nada táctil lo invoca.
2. **El layout no está pensado para una mano.** El HUD de arriba acumula stats + selector de SKIN + botones PAUSA/FIN/SALIR, el canvas queda a media pantalla y los controles táctiles son **distintos en cada juego** (Asteroides: girar/empuje/fuego; Caída: 5 botones; Bloque Buster: ←/→ + arrastre; Snake: cruceta). No hay un patrón de mando común.

La dirección del usuario (con imagen de referencia) es clara: en móvil, **canvas arriba** y, debajo, **un mando simulado** con cruceta direccional + un par de botones de acción (máx. 2), con el **mismo estilo en todos los juegos** (cada uno muestra solo lo que usa), conservando el HUD propio del juego y **bajando la pausa al pie**. **Estas modificaciones son únicamente para móvil**: el escritorio no cambia.

Este spec es transversal (no añade juego ni toca la BD): reorganiza la capa de presentación táctil reutilizando los motores, servicios y el marco CRT ya existentes.

---

## Alcance

**Dentro:**

- **Cambios solo-móvil** mediante media query CSS `@media (hover: none) and (pointer: coarse), (max-width: 760px)` (el mismo criterio que ya muestra los controles táctiles). En escritorio **nada cambia**. Sin detección JS ni dependencia de user-agent (seguro para SSR).
- **Layout de juego en móvil** para los 4 componentes (`Asteroids`, `Caida`, `BloqueBuster`, `Snake`): la vista del reproductor se apila en columna → **[HUD compacto]** → **[CRT/canvas]** → **[mando unificado]** → **[barra de pie]**. La altura del CRT se acota con unidades de viewport dinámico (`dvh`) para que el mando y la barra de pie **siempre quepan sin scroll** en los 3 aspect-ratios (Asteroides/Bloque Buster 4:3, Caída 1:2, Snake 1:1).
- **Mando táctil unificado** `.av-mobile-pad`: una **cruceta** (↑/↓/←/→) y un grupo de **hasta 2 botones de acción** (A/B), con el mismo estilo/tamaño/posición en los 4 juegos, pero **mostrando solo lo que cada juego usa** (ver mapeo en Modelo de datos). Reutiliza el patrón del D-pad de Snake y las clases `.touch-btn`. Tamaños táctiles ≥56px (mínimo 44px), foco visible, `touch-action: none`, respeta `prefers-reduced-motion`.
- **HUD propio del juego conservado, en versión compacta** sobre el canvas (puntos/vidas/nivel/líneas/velocidad, según el juego): se mantiene el «hub propio del juego», solo se adelgaza para móvil.
- **Barra de pie** `.av-mobile-bar` (solo-móvil): recoge las acciones secundarias que hoy viven en `.hud-actions` del HUD superior: **PAUSA/REANUDAR**, **SALIR** y los toggles propios de cada juego (**SKIN** en los 4; **SONIDO** en Bloque Buster). En móvil se **ocultan** esos botones del HUD de arriba (se mueven al pie).
- **Reinicio táctil:** botón **«JUGAR DE NUEVO»** en el panel `.av-save` (game over, y también `win` en Bloque Buster) cableado a `engine.restart()` vía un método de componente `restartGame()` que además rehabilita el guardado. En móvil se **oculta** el texto «PULSA ESPACIO».
- **Viewport y safe-area:** `src/index.html` añade `viewport-fit=cover` al meta viewport (conservando el zoom del usuario — no se desactiva el pinch-zoom). El layout móvil respeta `env(safe-area-inset-*)` (notch / barra inferior).
- **Auditoría responsive del resto de la app** a 360px de ancho (home, biblioteca, acerca+contacto, salón, navbar): sin scroll horizontal, objetivos táctiles ≥44px, el panel de navegación móvil abre/cierra, el formulario de contacto es usable, el salón (podio/tabla) apila bien. Se **corrige** lo que falle en `src/styles.css` (ajustes puntuales, no rediseño).
- **Coordinar `frontend-design` + `ui-ux-pro-max`:** foco visible, contraste suficiente, SVG/íconos decorativos `aria-hidden`, `prefers-reduced-motion` atenúa solo la decoración (nunca la jugabilidad).
- **Verificación en dispositivo real** (el usuario prueba en su teléfono vía `ng serve --host` sobre la LAN) + criterios objetivos a 360px.

**Fuera de alcance (para futuros specs):**

- **Cualquier cambio de escritorio** (la vista de escritorio queda idéntica) y cualquier cambio de **jugabilidad, dificultad o reglas** de los motores.
- **Refactor a un componente `GamePad` compartido** de Angular: la unificación se hace vía CSS + marcado consistente reutilizando los `press()` existentes. Extraer un componente común se deja para después.
- **Layout dedicado de landscape**, pista de «gira el dispositivo» y **bloqueo de orientación** (Screen Orientation API, soporte irregular en iOS). En horizontal el juego simplemente funciona.
- **PWA / instalable**, vibración háptica, Gamepad API (mando físico), gestos avanzados (swipe para girar, etc.).
- Cambios en la BD (`games`/`scores`), servicios o en el leaderboard; derivar `best`/`plays` de `scores`.
- Internacionalización (la UI queda solo en español).

---

## Modelo de datos

**Este spec no introduce estructuras de datos nuevas ni cambios en la base de datos.** No toca `games`, `scores`, `SupabaseService`, `GamesService` ni `ScoresService`, y no modifica la API pública ni la lógica de ningún motor. Reutiliza métodos ya existentes: `engine.restart()`, `engine.pause()/resume()`, `engine.setInput(action, pressed)` (vía los `press()` de cada componente) y `ScoresService.save(...)`.

El único "contrato" relevante es el **mapeo de cada juego sobre el mando unificado** (cruceta + hasta 2 botones), usando el vocabulario de `setInput` que **ya** emite cada `press()`:

| Juego | Cruceta (←/→/↑/↓) | Botón A | Botón B | Arrastre sobre canvas |
| --- | --- | --- | --- | --- |
| **Asteroides** | ← → = `left`/`right` (girar), ↑ = `thrust` (empuje) | `shoot` (FUEGO) | — (no usa) | — |
| **Caída** | ← → = `left`/`right` (mover), ↓ = `soft` (bajar) | `rotate` (ROTAR) | `hard` (CAÍDA) | — |
| **Bloque Buster** | ← → = `left`/`right` (mover paleta) | — (no usa) | — (no usa) | **se conserva** (mueve la paleta) |
| **Snake** | ↑ ↓ ← → = `up`/`down`/`left`/`right` | — (no usa) | — (no usa) | — |

Convenciones del mando (mismas en los 4 juegos; cada uno oculta las teclas/botones que no usa):

- **Cruceta** `.pad-dpad`: grid en cruz (como el D-pad de Snake de SPEC 09). Las direcciones que un juego no usa **no se renderizan** (p. ej. Asteroides sin ↓; Caída sin ↑; Bloque Buster solo ← →).
- **Acciones** `.pad-actions`: 0, 1 o 2 botones `.pad-btn` según el juego. El botón A reutiliza el estilo neutro; el B el acento `.fire` (magenta) ya existente.
- Todos disparan los `press(action, pressed, $event)` **ya presentes** en cada componente; no se añade vocabulario nuevo de `setInput`.
- El **botón «JUGAR DE NUEVO»** del panel de fin llama a un método nuevo `restartGame()` del componente → `engine.restart()` + rehabilita el guardado (equivalente táctil de ESPACIO).

---

## Plan de implementación

Numerado; cada paso deja la app compilando y navegable, y **no** altera el escritorio.

1. **Viewport + base móvil.** `src/index.html`: añadir `viewport-fit=cover` al `<meta name="viewport">` (sin desactivar el zoom). `src/styles.css`: fijar el breakpoint móvil de juego `@media (hover: none) and (pointer: coarse), (max-width: 760px)` como contenedor de todo lo nuevo, y utilidades base (variables de altura con `dvh`, `padding` con `env(safe-area-inset-*)`). Prueba: `npm run build` compila; en escritorio no hay cambios.
2. **Mando unificado (CSS).** Añadir a `styles.css` el bloque `.av-mobile-pad` → `.pad-dpad` (cruceta en grid de cruz, clonando el `.touch-dpad` de Snake) + `.pad-actions` con `.pad-btn` (y variante `.fire`). Tamaños ≥56px, `touch-action: none`, `user-select: none`, `:focus-visible` visible, `@media (prefers-reduced-motion: reduce)` sin transición. Prueba: clases disponibles; aún no cableadas en los juegos.
3. **Layout de juego en móvil (CSS).** Bajo el breakpoint móvil: apilar la vista `.av-player` en columna [HUD compacto] → [`.crt`/canvas] → [`.av-mobile-pad`] → [`.av-mobile-bar`]; acotar la altura del CRT con `max-height` en `dvh` para que mando + barra siempre quepan en 4:3, 1:2 y 1:1 (el motor ya centra con celdas cuadradas); ocultar en móvil `.player-hud .hud-actions` y compactar `.player-hud`. Escritorio intacto. Prueba: a 360px el canvas queda arriba y el espacio inferior reservado; sin scroll horizontal.
4. **Barra de pie + «JUGAR DE NUEVO» (HTML/TS, por juego).** En cada componente: añadir el método `restartGame()` (llama `engine.restart()` y rehabilita el guardado) y, en el HTML, (a) una `.av-mobile-bar` solo-móvil con PAUSA/REANUDAR (`togglePause()`), SALIR (`RouterLink`) y los toggles propios (SKIN vía `selectSkin()`; SONIDO en Bloque Buster), y (b) en `.av-save` un botón «JUGAR DE NUEVO» (`restartGame()`) y ocultar en móvil el `.save-hint` de «PULSA ESPACIO». Reutiliza handlers existentes. Prueba por juego: en móvil se pausa, se sale, se cambia SKIN y se reinicia solo con toque.
5. **Mando por juego (HTML).** Sustituir el marcado `.touch-controls` de cada juego por `.av-mobile-pad`, mostrando solo lo que usa según la tabla del Modelo de datos (Asteroides ←→↑ + A=FUEGO; Caída ←→↓ + A=ROTAR + B=CAÍDA; Bloque Buster ←→, conservando el arrastre sobre el canvas; Snake ←→↑↓). Reusar los `press(action, pressed, $event)` ya existentes; **no** se toca ningún motor. Prueba por juego: jugable íntegramente con toque en móvil (mover/girar/accionar).
6. **Auditoría responsive del resto de la app.** A 360px revisar home, biblioteca, acerca+contacto, salón y navbar: sin scroll horizontal, objetivos táctiles ≥44px, el panel móvil de navegación abre/cierra, el formulario de contacto es usable (teclado no tapa el envío), el salón (podio/tabla) apila bien. Corregir lo que falle en `styles.css` (ajustes puntuales, sin rediseño). Prueba: recorrido completo en móvil sin desbordes.
7. **Tests, validación en dispositivo y docs.** `npm run build` y `npx ng test --watch=false` sin errores; ajustar los specs de componente cuyos selectores cambien al reorganizar el marcado (sin cambiar lo que verifican). Validación manual en teléfono real vía `ng serve --host 0.0.0.0` (LAN). Actualizar `CLAUDE.md` (bullets de `games/*` + una nota de "jugabilidad móvil"): layout móvil (canvas arriba + mando unificado + barra de pie + «JUGAR DE NUEVO»), solo-móvil, sin cambios de jugabilidad ni de escritorio.

---

## Criterios de aceptación

- [ ] `npm run build` y `npx ng test --watch=false` terminan sin errores.
- [ ] En móvil (puntero grueso o ancho ≤760px), cada uno de los 4 juegos muestra en este orden: **HUD compacto** arriba, **canvas** debajo, **mando unificado** y **barra de pie**; en **escritorio** la vista de cada juego se ve **igual que antes** (sin regresión).
- [ ] El mando tiene el **mismo estilo** en los 4 juegos y muestra **solo lo que cada juego usa**: Asteroides (←→↑ + FUEGO), Caída (←→↓ + ROTAR + CAÍDA), Bloque Buster (←→ + arrastre sobre el canvas), Snake (←→↑↓).
- [ ] Cada juego es **jugable íntegramente con toque, sin teclado**: moverse/girar/accionar, **pausar** (barra de pie), **salir** y **reiniciar**.
- [ ] En game over (y en `win` de Bloque Buster), el botón **«JUGAR DE NUEVO»** reinicia la partida (`engine.restart()`) y rehabilita el guardado; el texto **«PULSA ESPACIO» no se muestra en móvil**.
- [ ] La **pausa** vive en la **barra de pie** en móvil; REANUDAR continúa sin reiniciar.
- [ ] Las acciones secundarias (SKIN en los 4; SONIDO en Bloque Buster) siguen accesibles desde la barra de pie en móvil.
- [ ] A **360px de ancho no hay scroll horizontal** en ninguna pantalla: los 4 juegos, home, biblioteca, acerca+contacto y salón.
- [ ] En los 3 aspect-ratios (4:3, 1:2 de Caída, 1:1 de Snake) el **canvas y el mando caben juntos** sin scroll vertical para jugar.
- [ ] Objetivos táctiles ≥44px; **foco visible** en los controles; se respeta `prefers-reduced-motion` (no se atenúa la jugabilidad).
- [ ] **No se modifica la lógica de ningún motor ni la jugabilidad**; ningún motor importa Angular; la app sigue renderizando bajo SSR sin tocar `window`/`document`/canvas en servidor.
- [ ] **No hay cambios en la base de datos** (`games`/`scores`) ni en los servicios; ningún componente consulta Supabase directamente.
- [ ] El panel de navegación móvil (hamburguesa) abre y cierra; el formulario de contacto se envía en móvil.
- [ ] Sin errores en la consola al jugar, pausar, morir/ganar, reiniciar, guardar y salir en móvil.

---

## Decisiones tomadas y descartadas

- **Sí:** cambios **solo-móvil** vía media query CSS (`(hover: none) and (pointer: coarse)` o ≤760px). **No:** detección JS/user-agent ni tocar el escritorio — más frágil y con riesgo en SSR; el usuario pidió explícitamente "solo para móviles".
- **Sí:** **mando unificado** (cruceta + hasta 2 botones), mismo estilo en todos, **mostrando solo lo que usa cada juego**. **No:** 2 botones siempre visibles aunque estén inertes, ni mandos distintos por juego — el usuario eligió "mismo mando pero solo con lo que usa cada juego".
- **Sí:** **canvas arriba + mando abajo + barra de pie** con la pausa; se **conserva el HUD propio del juego** en versión compacta. **No:** mantener el HUD de arriba cargado (el que el usuario tachó en la imagen de referencia).
- **Sí:** botón **«JUGAR DE NUEVO»** en el panel de fin → `engine.restart()`, ocultando «PULSA ESPACIO» en móvil. **No:** reiniciar tocando el canvas (menos descubrible) ni dejar el reinicio solo por teclado (roto en móvil).
- **Sí:** **reutilizar** `press()`/`setInput()`/`restart()`/`togglePause()`/`selectSkin()` ya existentes; **sin** cambios de motor ni de jugabilidad. **No:** extraer un componente `GamePad` compartido de Angular ahora — aporta valor pero es un refactor transversal con más riesgo; se deja para otro spec. La uniformidad se logra con CSS + marcado consistente.
- **Sí:** garantizar **portrait a 360px** con `dvh` + `env(safe-area-inset-*)`; landscape simplemente funciona. **No:** layout dedicado de landscape ni bloqueo de orientación (soporte irregular en iOS Safari).
- **Sí:** **verificación en dispositivo real** (LAN) + criterios objetivos a 360px. **No:** depender solo de emulación — el usuario validará en su teléfono.
- **Sí:** **auditoría ligera** del resto de la app (corregir desbordes/targets a 360px). **No:** rediseñar home/biblioteca/salón/acerca.
- **Sí:** mantener el **zoom del usuario** activo y añadir `viewport-fit=cover`. **No:** `user-scalable=no` (perjudica accesibilidad); el `touch-action: none` ya evita el zoom accidental sobre el canvas y el mando.

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Caída (tablero 1:2, alto) + mando + barra no caben en 360×640 | Acotar la altura del CRT con `max-height` en `dvh`; el motor ya centra el tablero con celdas cuadradas si se estrecha, así que la jugabilidad se mantiene. |
| `100vh` real en navegadores móviles (barra de direcciones aparece/desaparece) corta el layout | Usar `dvh`/`svh` en vez de `vh` y `env(safe-area-inset-*)` para el pie; probar en dispositivo real. |
| Reorganizar el marcado táctil rompe los specs de componente (selectores) | Ajustar los selectores en los `*.spec.ts` sin cambiar lo que verifican; `npx ng test --watch=false` como puerta. |
| Ocultar `.hud-actions` en móvil deja sin acceso a SKIN/PAUSA/SALIR | Se re-exponen en la `.av-mobile-bar` del pie; un criterio de aceptación lo verifica. |
| Regresión visual en escritorio al tocar `styles.css` | Todo lo nuevo vive bajo la media query móvil; criterio explícito de "escritorio igual que antes". |
| El arrastre de Bloque Buster sobre el canvas compite con el scroll de la página | El canvas ya tiene `touch-action: none`; el arrastre se conserva y no provoca scroll. |
| El botón «JUGAR DE NUEVO» permite doble guardado al reiniciar | `restartGame()` reutiliza la rehabilitación de guardado ya probada (el motor vuelve a `phase: 'playing'`), sin escritura silenciosa. |
| Añadir `viewport-fit=cover` desplaza contenido bajo el notch | El layout móvil usa `env(safe-area-inset-*)` en el pie/HUD; sin cambios en escritorio. |

---

## Lo que **no** entra en este spec

- Cualquier cambio de **escritorio** o de **jugabilidad/reglas/dificultad** de los motores.
- Refactor a un **componente `GamePad` compartido** (la unificación es por CSS + marcado consistente).
- **Landscape dedicado**, pista de rotación y **bloqueo de orientación**.
- **PWA/instalable**, vibración háptica, Gamepad API (mando físico), gestos avanzados.
- Cambios en la **BD** (`games`/`scores`), servicios o leaderboard.
- Internacionalización.

Cada uno, si llega, va en su propio spec.
