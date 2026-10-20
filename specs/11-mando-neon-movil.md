# SPEC 11 — Mando neón MK-II en móvil (apariencia del gamepad de referencia)

> **Estado:** Aprobado
> **Depende de:** SPEC 10 (mando táctil unificado `.av-mobile-pad`/`.pad-dpad`/`.pad-actions` solo-móvil, canvas arriba + barra de pie + «JUGAR DE NUEVO»), SPEC 05 (Asteroides), SPEC 07 (Caída), SPEC 08 (Bloque Buster), SPEC 09 (Snake)
> **Fecha:** 2026-10-20
> **Objetivo:** Reestilizar **solo en móvil** el mando táctil ya existente para que la cruceta y los botones de acción se vean como el gamepad neón «MK-II» de `references/started-games/gamepad-assets` (teclas de cruceta con flechas SVG + hub con LED, botones de acción circulares biselados A/B), **sin gabinete exterior**, sin tocar jugabilidad, motores, servicios, BD ni el escritorio.

---

## Por qué existe este spec

SPEC 10 ya trajo el mando táctil unificado solo-móvil (`.av-mobile-pad` = cruceta `.pad-dpad` + acciones `.pad-actions`, reutilizando `.touch-btn`), pero su apariencia es **plana**: rectángulos neón con glifos Unicode (`▲ ▼ ◀ ▶`) para la cruceta y botones de texto para las acciones. El usuario entregó una **referencia de diseño** (`references/started-games/gamepad-assets/gamepad-neon.png` + `gamepad.html`): el mando **MK-II**, con una estética mucho más de "mando de consola":

- **Cruceta:** cuatro teclas rectangulares redondeadas con **flechas SVG** (no glifos), relieve 3D (sombra inferior `0 4px 0`, highlight interior), que al pulsarse se hunden y encienden en cian con glow; y un **hub central** con una **gema LED** en forma de diamante que late.
- **Botones de acción:** círculos **biselados** de ~74px con brillo especular, **A = magenta** y **B = cian**, letra en `Press Start 2P`, anillo punteado al hover/activo.

Este spec **solo cambia la apariencia** de ese mando para acercarlo al MK-II. Es transversal y de presentación (como SPEC 10): reutiliza el mismo marcado/cableado (`press()`), los mismos motores y servicios, y vive **íntegramente dentro de la media query móvil** de SPEC 10. En escritorio no se ve (el mando nace `display: none`).

Decisiones del usuario que acotan el alcance (bloque de preguntas de este spec):

1. **Sin carcasa.** Se reestilizan la cruceta y los botones al look MK-II, pero **no** se añade el gabinete exterior (`.gp`: panel con degradado, doble borde, trama de puntos, glow envolvente). Así el mando no roba alto vertical extra en el móvil.
2. **Botones A/B con letras.** Los botones de acción circulares muestran **«A»/«B»**; la función real (FUEGO/ROTAR/CAÍDA) va en `aria-label`/`title` para accesibilidad.
3. **Juegos sin acción → cruceta centrada.** Snake y Bloque Buster no usan botones de acción: la cruceta se centra (comportamiento `.av-mobile-pad.solo` de SPEC 10), sin botones muertos.
4. **Escalar con `clamp`.** Tamaños fluidos para que el mando **siempre quepa sin scroll vertical** junto al canvas en los 3 aspect-ratios (incluido Caída 1:2), conservando el criterio de SPEC 10.

---

## Alcance

**Dentro:**

- **Cambios solo-móvil**, dentro de la media query ya existente de SPEC 10 `@media (hover: none) and (pointer: coarse), (max-width: 760px)`. En escritorio **nada cambia** (el mando sigue `display: none` fuera de la media query). Sin detección JS ni user-agent (seguro para SSR).
- **Reestilizado de la cruceta `.pad-dpad`** al look MK-II: teclas con relieve 3D (sombra inferior, highlight y sombra interior), **flecha SVG** por tecla (`aria-hidden`, `fill: currentColor`) en lugar del glifo Unicode, estado pulsado hundido + encendido cian con glow, y un **hub central** `.pad-hub` con una **gema LED diamante** `.pad-hub-gem` (decorativa, `aria-hidden`). La cruceta mantiene su grid en cruz y **solo renderiza las direcciones que cada juego usa** (igual que SPEC 10).
- **Reestilizado de los botones de acción `.pad-actions`** al look MK-II: botones **circulares** biselados con brillo especular, **A = magenta / B = cian** (identidad del PNG), letra «A»/«B» en `Press Start 2P`, anillo `:focus-visible`/activo. La **función** de cada botón va en `aria-label`/`title` (FUEGO/ROTAR/CAÍDA). Mapeo primario→A, secundario→B (ver Modelo de datos).
- **Escalado fluido con `clamp()`** de teclas, hub, separaciones y botones, calculado para que **cruceta + acciones + canvas + barra de pie** quepan **sin scroll vertical** en 360×640 y en los 3 aspect-ratios (4:3 Asteroides/Bloque Buster, 1:2 Caída, 1:1 Snake). Si hace falta, se recorta algo del `max-height` del canvas (ya acotado en `dvh` por SPEC 10), nunca se provoca scroll para jugar.
- **Actualización del marcado del mando en los 4 componentes** (`asteroids.html`, `caida.html`, `bloque-buster.html`, `snake.html`): sustituir los glifos de las teclas por el `<svg>` de flecha, añadir el `.pad-hub` a la cruceta, y convertir los botones de acción al patrón circular A/B (letra visible + `aria-label`/`title` con la función). **Se reutiliza el cableado `press(action, pressed, $event)` existente**; no se añade vocabulario de `setInput` ni se toca ningún `.ts` de lógica de juego.
- **Accesibilidad / motion:** objetivos táctiles ≥44px (se conserva el suelo de SPEC 10), **foco visible** en teclas y botones, SVG/gema **decorativos `aria-hidden`**, y `@media (prefers-reduced-motion: reduce)` detiene la animación del LED y las transiciones del mando (nunca atenúa la jugabilidad). Coordinar `frontend-design` + `ui-ux-pro-max`.
- **Verificación:** `npm run build` limpio; validación en **dispositivo real** (LAN) + criterios objetivos a 360px.

**Fuera de alcance (para futuros specs):**

- **El gabinete/carcasa exterior MK-II** (`.gp`: panel con degradado, doble borde, trama de puntos, glow envolvente). Decisión explícita del usuario: «solo controles, sin panel».
- **Cualquier cambio de escritorio** (la vista de escritorio queda idéntica; el mando sigue oculto fuera de la media query) y cualquier cambio de **layout, orden o altura** definidos en SPEC 10 (canvas arriba → mando → barra de pie → «JUGAR DE NUEVO» se conservan tal cual).
- **Jugabilidad, reglas, dificultad, motores, servicios y BD** (`games`/`scores`): intactos. No se toca ningún `*-engine.ts` ni `setInput`.
- **Botones A/B decorativos inertes** en los juegos que no usan acción (Snake, Bloque Buster): se descartó; esos juegos centran la cruceta sin botones.
- **Refactor a un componente `GamePad` compartido** de Angular (sigue siendo CSS + marcado consistente, como en SPEC 10).
- **Soporte de teclado/temas por skin del mando**, háptica, Gamepad API, landscape dedicado. Internacionalización (la UI queda en español).

---

## Modelo de datos

**Este spec no introduce estructuras de datos nuevas ni cambios en la base de datos.** No toca `games`, `scores`, `SupabaseService`, `GamesService` ni `ScoresService`, no modifica la API pública ni la lógica de ningún motor, y no añade vocabulario de `setInput`. Reutiliza los `press(action, pressed, $event)` ya presentes en cada componente.

El único "contrato" es el **mapeo de cada juego sobre el mando MK-II** (idéntico al de SPEC 10 en cuanto a qué acciones existen; aquí solo se fija además la **identidad de color A/B** del PNG):

| Juego | Cruceta (flechas SVG; solo las que usa) | Botón **A** (magenta) | Botón **B** (cian) | Arrastre sobre canvas |
| --- | --- | --- | --- | --- |
| **Asteroides** | ← → = `left`/`right` (girar), ↑ = `thrust` | `shoot` → **A** (`aria-label="FUEGO"`) | — (no usa) | — |
| **Caída** | ← → = `left`/`right`, ↓ = `soft` | `rotate` → **A** (`aria-label="ROTAR"`) | `hard` → **B** (`aria-label="CAÍDA"`) | — |
| **Bloque Buster** | ← → = `left`/`right` (`.solo`, cruceta centrada) | — | — | **se conserva** (mueve la paleta) |
| **Snake** | ↑ ↓ ← → = `up`/`down`/`left`/`right` (`.solo`, cruceta centrada) | — | — | — |

Convenciones (se construyen **sobre** las clases de SPEC 10; los nombres nuevos son recomendados, `spec-impl` puede ajustarlos):

- **Cruceta `.pad-dpad`:** sigue siendo el grid en cruz de SPEC 10. Cada tecla conserva su `.touch-btn.up/.down/.left/.right` (tamaño táctil, `:active`, `:focus-visible`, reduced-motion ya definidos) y recibe **encima** el look MK-II (relieve, flecha SVG, encendido). Las direcciones no usadas **no se renderizan**.
- **Hub `.pad-hub` + `.pad-hub-gem`:** elemento decorativo central (diamante LED cian con `@keyframes` de latido), `aria-hidden`, sin interacción. Se detiene bajo `prefers-reduced-motion`.
- **Acciones `.pad-actions`:** 0, 1 o 2 botones `.pad-ab` circulares. **Color por identidad del PNG, no por orden**: `.pad-ab.a` = magenta (acción **primaria** del juego), `.pad-ab.b` = cian (secundaria). Esto **reemplaza** el detalle de SPEC 10 "el botón B usa el acento `.fire` magenta": ahora A=magenta, B=cian, fiel a la referencia. La **letra** («A»/«B») es visible; la **función** va en `aria-label`/`title`.
- Todos los controles disparan los `press(...)` **ya presentes**; no se añade lógica.
- **Escalado:** teclas, hub, gaps y botones usan `clamp()` para caber siempre; el botón circular respeta el mínimo táctil de 44px en su cota inferior.

---

## Plan de implementación

Numerado; cada paso deja la app compilando y navegable, **no** altera el escritorio ni la jugabilidad.

1. **Cruceta MK-II (CSS).** En `src/styles.css`, bajo el bloque del mando de SPEC 10, dar a las teclas de `.pad-dpad .touch-btn` el relieve MK-II (gradiente, `box-shadow` inferior `0 4px 0` + inset, radio ~10px) y el estado pulsado hundido/encendido en cian con glow; estilar la **flecha SVG** interna (`fill: currentColor`, glow al activar). Añadir `.pad-hub` + `.pad-hub-gem` (gema diamante con `@keyframes` de latido) y su parada en `prefers-reduced-motion`. Todo **dentro de la media query móvil** (o con base oculta en escritorio, como SPEC 10). Prueba: `npm run build` compila; en escritorio no hay cambios; aún con glifos en el marcado.
2. **Botones de acción circulares A/B (CSS).** Añadir `.pad-ab` (círculo biselado, brillo especular, `box-shadow` inferior + glow, letra en `--pixel`), variantes `.pad-ab.a` (magenta) y `.pad-ab.b` (cian), anillo `:focus-visible`/activo, y tamaño con `clamp()` (mín. 44px). Reduced-motion sin transición. Prueba: clases disponibles; aún no cableadas en los juegos.
3. **Escalado fluido (CSS).** Convertir tamaños de teclas, hub, gaps de `.pad-dpad`/`.pad-actions` y de `.pad-ab` a `clamp()` para que cruceta + acciones + canvas + barra de pie quepan sin scroll en 360×640 y en 4:3/1:2/1:1; si hace falta, afinar el `max-height` en `dvh` del canvas (ya introducido en SPEC 10). Prueba: a 360px (y a la altura de Caída 1:2) todo cabe sin scroll vertical.
4. **Marcado de la cruceta por juego (HTML).** En `asteroids.html`, `caida.html`, `bloque-buster.html`, `snake.html`: sustituir el glifo Unicode de cada `.touch-btn` de cruceta por el `<svg class="pad-arrow" aria-hidden="true">` de flecha correspondiente (triángulo, `fill: currentColor`), **conservando** `aria-label` y el cableado `press(...)`; añadir el `.pad-hub` dentro de `.pad-dpad`. Snake y Bloque Buster mantienen `.av-mobile-pad.solo` (cruceta centrada). Prueba por juego: en móvil la cruceta se ve MK-II y sigue moviendo/girando igual.
5. **Botones de acción por juego (HTML).** En Asteroides y Caída, convertir los botones de acción de `.pad-actions` al patrón `.pad-ab`: Asteroides → una `.pad-ab.a` con letra «A» y `aria-label="FUEGO"`/`title`; Caída → `.pad-ab.a` «A» `aria-label="ROTAR"` + `.pad-ab.b` «B» `aria-label="CAÍDA"`. Reutilizar los `press('shoot'|'rotate'|'hard', ...)` existentes. Prueba por juego: disparar/rotar/caída siguen funcionando con toque; A=magenta, B=cian.
6. **Accesibilidad y pulido.** Verificar foco visible en teclas y botones, `aria-hidden` en SVG/gema, contraste suficiente, y que `prefers-reduced-motion` detiene LED y transiciones (no la jugabilidad). Ajustar los `*.spec.ts` solo si algún selector cambió al reorganizar el marcado (sin cambiar lo que verifican). Prueba: `npm run build` limpio; recorrido táctil completo.
7. **Validación en dispositivo y docs.** `npm run build` sin errores; validación manual en teléfono real vía `ng serve --host 0.0.0.0` (LAN) en los 4 juegos. Actualizar `CLAUDE.md` (nota breve en los bullets de `games/*` o en la nota de "jugabilidad móvil" de SPEC 10): el mando móvil ahora usa la apariencia neón MK-II (cruceta con flechas SVG + hub LED, botones circulares A/B), solo-móvil, sin cambios de jugabilidad ni de escritorio.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores (y `npx ng test --watch=false` si se tocan specs de componente).
- [ ] En móvil (puntero grueso o ancho ≤760px), los 4 juegos muestran la **cruceta MK-II**: teclas con relieve 3D y **flecha SVG** (no glifos), que al pulsar se hunden y encienden en cian; con **hub central** y gema LED decorativa.
- [ ] En **escritorio** el mando **sigue oculto** y la vista de cada juego se ve **igual que antes** (sin regresión; el mando vive dentro de la media query móvil).
- [ ] Los botones de acción son **círculos biselados A/B**: **A = magenta** (acción primaria), **B = cian**; la **letra** es visible y la **función** (FUEGO/ROTAR/CAÍDA) está en `aria-label`/`title`.
- [ ] El mapeo se respeta: Asteroides muestra 1 acción (**A = FUEGO**); Caída 2 (**A = ROTAR**, **B = CAÍDA**); Snake y Bloque Buster **sin botones de acción** y con la **cruceta centrada** (`.solo`).
- [ ] Cada juego sigue siendo **jugable íntegramente con toque** (mover/girar/accionar), reusando los `press()` existentes; Bloque Buster conserva el **arrastre sobre el canvas**.
- [ ] A **360px** y en los 3 aspect-ratios (4:3, 1:2 de Caída, 1:1 de Snake), **cruceta + acciones + canvas + barra de pie caben sin scroll vertical** y **sin scroll horizontal** (tamaños con `clamp`).
- [ ] Objetivos táctiles **≥44px**; **foco visible** en teclas y botones; SVG y gema **`aria-hidden`**; `prefers-reduced-motion` **detiene** el latido del LED y las transiciones del mando (no la jugabilidad).
- [ ] **No se modifica** ningún motor, la jugabilidad, los servicios ni la BD; **no** se añade vocabulario de `setInput`; ningún motor importa Angular; la app sigue renderizando bajo SSR sin tocar `window`/`document`/canvas en servidor.
- [ ] Sin errores en consola al jugar, accionar, pausar, morir/ganar, reiniciar y salir en móvil.

---

## Decisiones tomadas y descartadas

- **Sí:** reestilizar **solo los controles** (cruceta + A/B) al look MK-II. **No:** añadir el **gabinete/carcasa exterior** (`.gp`: degradado, doble borde, trama de puntos, glow envolvente) — decisión del usuario «solo controles, sin panel»; evita robar alto vertical en el móvil.
- **Sí:** botones circulares con **letra «A»/«B»** y la **función en `aria-label`/`title`**. **No:** poner la palabra de la función (FUEGO/ROTAR/CAÍDA) dentro del círculo (texto largo aprieta un círculo de ~64px), **ni** letra + leyenda bajo el botón — el usuario eligió fidelidad al PNG con la función accesible.
- **Sí:** en Snake y Bloque Buster (sin acción) **centrar la cruceta** (`.av-mobile-pad.solo`). **No:** dibujar **A/B inertes/decorativos** — botones muertos que confunden.
- **Sí:** **escalar con `clamp()`** para que el mando **siempre quepa sin scroll** (criterio de SPEC 10). **No:** tamaños fijos del PNG aunque a veces haya scroll — romper "jugable sin scroll" pesa más que la fidelidad milimétrica.
- **Sí:** identidad de color **A = magenta / B = cian** como el PNG, mapeando **primario→A**. **No:** mantener el detalle de SPEC 10 "B = acento `.fire` magenta" — este spec lo **reemplaza** para ser fiel a la referencia.
- **Sí:** **reutilizar** el marcado/cableado de SPEC 10 (`press()`, clases `.touch-btn`, media query, layout canvas-arriba + barra de pie). **No:** tocar motores, `setInput`, layout/orden de SPEC 10, ni extraer un componente `GamePad` compartido (se deja para otro spec).
- **Sí:** cambios **solo-móvil** vía la media query existente; escritorio idéntico. **No:** detección JS/user-agent (frágil, riesgo SSR).

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| El mando MK-II (teclas + hub + botones) es más alto que el plano de SPEC 10 y no cabe con Caída 1:2 en 360×640 | Tamaños con `clamp()` y, si hace falta, recortar el `max-height` en `dvh` del canvas (ya acotado en SPEC 10); criterio explícito de "cabe sin scroll". |
| El relieve 3D (sombra inferior `0 4px 0`) desplaza el layout o solapa la barra de pie | El relieve va por `box-shadow` (no ocupa caja); separar con los gaps del grid; verificar en dispositivo real. |
| La flecha SVG dentro de `.touch-btn` cambia selectores que algún `*.spec.ts` asume | Ajustar selectores en los specs sin cambiar lo que verifican; el `aria-label` de cada tecla se conserva como ancla estable. |
| La gema LED que late molesta o consume batería | Es decoración `aria-hidden`; se detiene bajo `prefers-reduced-motion`; animación barata (opacity/scale). |
| Recolorear A=magenta/B=cian contradice el detalle de SPEC 10 (B `.fire` magenta) y confunde | Se documenta el reemplazo aquí (Modelo de datos + Decisiones); solo afecta al mando móvil, no a otros usos de `.fire`. |
| Regresión visual en escritorio al tocar `styles.css` | Todo lo nuevo vive bajo la media query móvil (o con base `display:none`); criterio explícito de "escritorio igual que antes" + `git diff`. |
| El botón circular baja del mínimo táctil al escalar en pantallas muy pequeñas | La cota inferior del `clamp()` respeta ≥44px; se conserva el suelo táctil de SPEC 10. |

---

## Lo que **no** entra en este spec

- El **gabinete/carcasa exterior** MK-II (`.gp`: panel, doble borde, trama de puntos, glow envolvente).
- Cualquier cambio de **escritorio**, de **layout/orden** de SPEC 10, o de **jugabilidad/reglas/dificultad** de los motores.
- **A/B inertes** en juegos sin acción; **teclado/skins del mando**; **háptica**, **Gamepad API**, **landscape dedicado**.
- Cambios en la **BD** (`games`/`scores`), servicios o leaderboard; refactor a un **componente `GamePad`** compartido.
- Internacionalización.

Cada uno, si llega, va en su propio spec.
