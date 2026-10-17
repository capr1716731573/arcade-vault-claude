# Capa de juego sobre la plantilla base de `/spec`

Este archivo **no duplica** la plantilla genérica. La forma del documento (cabecera, secciones y su
orden) sale de `.claude/skills/spec/template.md`, que la skill lee como base. Aquí se concreta, sección
por sección, **qué contenido específico de un juego** va en cada una, modelado sobre
`specs/05-juego-asteroides.md` y `specs/06-leaderboard-y-catalogo-supabase.md`. No es texto a copiar
literal: es la forma a respetar. Los detalles de archivos y firmas están en
`references/receta-arcade.md`.

---

## Cabecera

```markdown
# SPEC NN — Juego <Título> (<nuevo juego real | port de references/started-games/<carpeta>>)

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** YYYY-MM-DD
> **Objetivo:** Portar/crear <juego> como motor TS agnóstico + componente Angular dedicado, jugable en `jugar/<id>`, con leaderboard real en Supabase.
```

El objetivo cabe en una frase. Si no cabe, el juego es demasiado grande para un solo spec.

---

## Alcance

**Dentro** (lista típica a adaptar):

- Juego nuevo `<id>` (kebab) en el catálogo `games`, `playable: true`.
- Motor TS aislado `src/app/games/<id>/<id>-engine.ts`: port fiel de la fuente, agnóstico de
  framework. API: `start/pause/resume/restart/destroy`, `setInput(action, pressed)`, `onState`.
- Componente dedicado `<Game>` en `jugar/<id>` (declarada **antes** de `jugar/:id`).
- HUD interno del canvas + overlay `GAME OVER` + `ESPACIO`-reinicia **conservados**; además el motor
  **notifica** su estado a Angular (HUD DOM neón que lo refleja).
- Canvas responsive (W/H del contenedor, recalculado en `resize`).
- Pausa (`P`/`Esc` + botón) con overlay "EN PAUSA".
- Controles táctiles en pantalla.
- Guardado en el Salón con botón aparte en `gameover` → `ScoresService.save({ game: '<id>', score, name })`.
- Badge "PRÓXIMAMENTE" se retira para `<id>` (porque `playable: true`).
- Portada CSS-only `cover-<id>` y reglas de estilo necesarias.
- Tests del motor (lógica pura) y smoke del componente.

**Fuera de alcance (para futuros specs):** recolor neón, sonido/OVNIs/dificultad configurable,
convertir otros juegos simulados, auth ligada a `scores`, i18n. Enumera aquí lo que salió en las
preguntas pero se difiere.

---

## Modelo de datos

No hay tablas nuevas. Reutiliza `games` y `scores` de SPEC 06. Introduce una **fila de catálogo** y
un **contrato de estado motor → componente**.

Fila nueva/actualizada en `public.games` (vía MCP; ver Plan):

```sql
-- si el juego ya existe como placeholder sembrado:
update public.games set playable = true where id = '<id>';
-- si es un juego totalmente nuevo:
insert into public.games (id, title, short, long, cat, cover, color, best, plays, playable, position)
values ('<id>', '<TÍTULO>', '<short>', '<long>', '<CAT>', 'cover-<id>', '<color>', 0, '—', true, <pos>);
```

Contrato que el motor notifica (ni el motor ni el contrato conocen Angular):

```ts
// src/app/games/<id>/<id>-engine.ts
export type <Game>Phase = 'playing' | 'dead' | 'gameover'; // ajusta a las fases reales del juego
export interface <Game>State { score: number; /* vidas/nivel/combo/… propios del juego */ phase: <Game>Phase; }
export type TouchAction = 'left' | 'right' | /* las acciones reales */ 'shoot';
export interface <Game>EngineOptions { onState?: (s: <Game>State) => void; }
```

`scores` no cambia (tabla única por `game_id`); el `ScoreRow` de la UI tampoco.

---

## Plan de implementación

Numerado, cada paso deja la app compilando y navegable. Patrón (adaptar a la mecánica del juego):

1. **Catálogo + ruta + cascarón.** Crear componente mínimo `<Game>`; declarar
   `{ path: 'jugar/<id>', component: <Game> }` **antes** de `jugar/:id`; añadir `cover-<id>` a
   `styles.css`. Alta/validación de la fila `games` puede ir aquí o en el paso 5. Prueba:
   `/jugar/<id>` renderiza el cascarón; `npm run build` compila.
2. **Motor** `<id>-engine.ts`: port de la fuente, bucle RAF con `dt` capado, W/H responsive,
   listeners SSR-safe con `preventDefault`, `setInput`, `onState` con dedupe, `pause/resume/restart/
   destroy`. Conservar HUD + overlay + `ESPACIO`.
3. **Componente** `<id>.ts|html`: `viewChild` del canvas; motor creado en `afterNextRender` +
   `runOutsideAngular`, `destroy()` en `ngOnDestroy`; signals espejo de `onState`; pausa; táctil;
   botón "GUARDAR PUNTUACIÓN" (gameover-only, sin doble guardado); enlace "VOLVER AL VAULT".
4. **Próximamente/estilos.** Verificar que el badge desaparece para `<id>` (porque `playable`); añadir
   a `styles.css` lo que falte (canvas responsive dentro del CRT, controles, overlay pausa, zona de
   guardado). **Coordinar `frontend-design` + `ui-ux-pro-max`**.
5. **Alta en `games` vía MCP.** `UPDATE`/`INSERT` de la fila (`playable: true`). `scores` no requiere
   nada.
6. **Tests.** Motor (lógica: puntos, colisiones/split/clear según el juego, `gameover`), sin
   `getContext`; smoke del componente (monta canvas, refleja `onState`, guardado sólo en `gameover`
   con `game: '<id>'`). Extender `GAMES_FIXTURE` + conteo si procede.
7. **Docs.** Actualizar `CLAUDE.md` ("Port status": `<id>` como juego real nuevo).

---

## Criterios de aceptación

Booleanos, estilo specs 05/06. Ejemplos a adaptar:

- [ ] `npm run build` y `npx ng test --watch=false` terminan sin errores.
- [ ] `<id>` existe en `games` con `playable: true`; aparece en la biblioteca y su ficha `/juego/<id>`.
- [ ] `/jugar/<id>` carga el componente dedicado; `/jugar/<otro>` sigue abriendo el player simulado.
- [ ] El juego es jugable con teclado y con controles táctiles.
- [ ] (reglas concretas de la mecánica, verificables: p. ej. "limpiar 4 líneas suma X").
- [ ] El HUD DOM neón refleja el estado notificado por el motor; coincide con el HUD del canvas.
- [ ] La pausa congela y reanuda sin reiniciar.
- [ ] En `gameover`, "GUARDAR PUNTUACIÓN" inserta en `scores` con `game_id: '<id>'`; sin doble
      guardado; en fallo avisa y permite reintentar; la marca aparece en la pestaña `<id>` del Salón.
- [ ] Al abandonar `/jugar/<id>` el motor se destruye (sin RAF ni listeners vivos).
- [ ] Renderiza bajo SSR sin tocar `window`/`document`/canvas en servidor.
- [ ] Ningún componente consulta Supabase directamente; el motor no importa nada de Angular.
- [ ] Sin errores en consola al jugar, pausar, morir, guardar y salir.

---

## Decisiones tomadas y descartadas

Captura el **sí/no** con razón, como en specs 05/06. Decisiones típicas:
motor aislado portado vs. reescritura Angular; componente dedicado vs. player genérico condicional;
conservar HUD del canvas + notificar a Angular ("usar los dos"); guardado con botón aparte vs. modal;
canvas responsive vs. resolución fija; alta vía MCP vs. SQL versionado; vectores vs. recolor neón.

---

## Riesgos

Tabla sólo si hay riesgos no obvios. Habituales en un juego:

| Riesgo | Mitigación |
| --- | --- |
| Fugas de RAF / listeners al cambiar de ruta | `destroy()` centraliza el ciclo de vida; `ngOnDestroy` lo llama; criterio de aceptación lo verifica. |
| El motor toca `window`/canvas en SSR | Se crea sólo en navegador (`afterNextRender`); rutas en `RenderMode.Client`. |
| Flechas/espacio hacen scroll de la página | `preventDefault` en teclas de juego, listeners activos sólo mientras corre. |
| Canvas responsive altera distancias/velocidades | Recalcular W/H en `resize`; acotar aspecto/tamaño mínimo. |

---

## Lo que **no** entra en este spec

Repite al final lo diferido (recolor neón, sonido, otros juegos, auth, i18n). Cada uno, si llega, va
en su propio spec.
