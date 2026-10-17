---
name: add-game
description: Genera el documento de especificación (spec) para añadir un juego real al arcade "Arcade Vault" — con su motor, su componente, su leaderboard y su integración en la plataforma. Úsala siempre que el usuario quiera crear un juego nuevo, portar un juego de references/started-games, añadir un juego al catálogo, un juego con tabla de puntuaciones, o diga cosas como "hagamos el tetris", "quiero añadir arkanoid", "nuevo juego jugable" — aunque no diga "spec". Produce SOLO el archivo de especificación en specs/, listo para /spec-impl; no escribe código del juego.
disable-model-invocation: true
argument-hint: 'nombre del juego o descripción breve'
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), mcp__supabase__list_tables, mcp__supabase__execute_sql
---

# /add-game — Diseñador de specs de juegos para Arcade Vault

## Contexto de sesión

Fecha de hoy (úsala para la cabecera del spec, nunca la inventes):
!`date +%F`

Specs que ya existen:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe todavía"`

Juegos de referencia disponibles para portar (ignora `__MACOSX`):
!`ls references/started-games/ 2>/dev/null || echo "No hay references/started-games/"`

---

Esta skill produce el **spec de un juego real** para Arcade Vault siguiendo el método spec-driven del
repo. **Aquí no escribes código del juego.** Tu trabajo es aclarar qué juego se va a construir, hacer
las preguntas específicas de un juego arcade, y redactar el spec en `specs/` listo para `/spec-impl`.

El valor de esta skill es que **ya conoce la receta** de cómo se integra un juego real en esta
plataforma (motor TS agnóstico + componente dedicado + fila en el catálogo Supabase con
`playable: true` + leaderboard por `game_id` + portada CSS + tests), destilada de **SPEC 05**
(Asteroides) y **SPEC 06** (catálogo y leaderboard en Supabase). No reinventa esa fontanería: la capa
de plataforma ya es genérica y se **reutiliza**.

## Relación con la skill `/spec`

`/add-game` es una **especialización** de `/spec`, no un reemplazo. Antes de redactar nada,
**lee y adopta como referencia canónica** la skill genérica:

- `.claude/skills/spec/SKILL.md` — el método de 4 fases, el tono de las preguntas, la numeración
  `NN`, los estados (`Borrador → Aprobado → Implementado`), la siembra de `specs/.spec-config.yml` y
  el flujo de guardado de la Fase 4.
- `.claude/skills/spec/template.md` — la **forma base** del spec (cabecera, Alcance dentro/fuera,
  Modelo de datos, Plan de implementación, Criterios de aceptación, Decisiones, Riesgos).

Sigue ese método y esa plantilla al pie de la letra para la estructura y las convenciones; esta skill
sólo **añade encima** las preguntas y el contenido específicos de un juego (ver `template.md` de esta
misma carpeta como capa de juego, y `references/receta-arcade.md` para la receta concreta).

## Flujo (las cuatro fases de `/spec`, especializadas)

Tus respuestas van en el mismo idioma que el prompt inicial (por defecto, español).

### Fase 1 — Contexto (obligatoria antes de escribir)

1. **Lee la skill `/spec`**: `.claude/skills/spec/SKILL.md` y `.claude/skills/spec/template.md`.
   Adopta su método y su plantilla base para construir el archivo de especificación.
2. Lee `CLAUDE.md` (contexto del proyecto, arquitectura Angular, reglas de la capa Supabase).
3. Lee los ejemplos canónicos: `specs/05-juego-asteroides.md` y
   `specs/06-leaderboard-y-catalogo-supabase.md`. Mira también el spec más reciente para calcar la
   numeración y el idioma exactos.
4. Lee `references/receta-arcade.md` (en esta misma carpeta): la receta concreta de archivos a crear,
   modificar y NO tocar, con las firmas del motor, el patrón del componente, el alta vía MCP, las
   portadas CSS y los tests.
5. Mira la lista de `references/started-games/` del contexto de sesión (ignora `__MACOSX`).
6. (Opcional, si Supabase está disponible) Consulta el catálogo vivo para saber qué ids/posiciones
   existen y si el juego ya está como fila placeholder:
   `select id, title, cat, playable, position from public.games order by position`.
   Mapeo conocido: `caida` ≈ 03-tetris, `bloque-buster` ≈ 04-arkanoid, `rocas` ≈ placeholder tipo
   asteroids. Si la fila ya existe → el spec hará `UPDATE ... SET playable = true`; si no → `INSERT`.

Si `$ARGUMENTS` viene vacío, pide en una frase qué juego se quiere añadir.

### Fase 2 — Preguntas (en bloques de 3–5, con `AskUserQuestion`)

Detecta ambigüedades y pregunta; no asumas. Pon tu recomendación primera y etiquétala. Categorías
que **siempre** debes cubrir para un juego:

- **Origen.** ¿Portar de `references/started-games/<carpeta>` o juego nuevo desde cero? Avisa de la
  variedad estructural que hay que respetar al portar:
  - `02-asteroids` → ya portado (es el modelo de referencia).
  - `03-tetris` → procedural (sin clases), HUD en DOM, `style.css`, canvas de preview, toggle de
    tema; canvas 300×600.
  - `04-arkanoid` → procedural, **spritesheet PNG + sonidos .mp3**, `levels.js`, orden de carga de
    scripts; HUD en canvas.
- **Identidad de catálogo** (fila de `games`): `id` kebab, `title`, `short`, `long`, `cat`
  (`ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS`), `color` (`cyan`/`magenta`/`yellow`/`green`), nombre de la
  clase de portada `cover-<id>`, `position`, valores de `best`/`plays` a sembrar, y `playable: true`.
  Confirma **UPDATE vs INSERT** según exista ya la fila.
- **Mecánica y entradas.** Acciones del jugador → contrato `TouchAction`; teclado + táctil; canvas
  responsive (W/H del contenedor, no resolución fija); conservar el HUD interno del canvas + overlay
  `GAME OVER` + `ESPACIO`-reinicia del original; pausa nueva (`P`/`Esc` + botón).
- **Assets.** ¿Vectores dibujados (como asteroids) o sprites/sonidos (como arkanoid)? Si hay assets,
  el plan debe portarlos y cargarlos sólo en navegador.
- **Contrato de estado motor → componente.** Qué campos observa `onState`
  (p. ej. `score`/`lives`/`level`/`phase` y los propios del juego) y el enum de fases.
- **Leaderboard.** Guardado con botón aparte sólo en `gameover`, `game_id: '<id>'`, nombre por
  defecto `SessionService.user()?.name ?? 'INVITADO'` (máx. 12 chars, mayúsculas), sin doble
  guardado, estados guardando/error/reintento. (La tabla `scores` NO cambia: es única por `game_id`.)
- **Fuera de alcance / decisiones cerradas.** Qué se difiere explícitamente (recolor neón, sonido si
  no aplica, OVNIs, dificultad configurable, convertir otros juegos, auth, i18n…).

Para cuándo parar: cuando puedas responder sin asumir (a) qué archivos se crean/cambian, (b) cuál es
el primer y el último paso ejecutable, (c) cómo se verifica que el juego está terminado.

### Fase 3 — Redactar el spec

Cuando la Fase 2 esté cerrada, usa la plantilla base de `/spec` + la capa de juego de `template.md`
(esta carpeta) + la receta de `references/receta-arcade.md`. Si ya tienes todo, escribe el spec
completo sin ir sección por sección (camino rápido, igual que `/spec`). El orden es el de la plantilla
base; el contenido específico de juego sale de `template.md` y `receta-arcade.md`.

### Fase 4 — Guardar el spec

Sigue la Fase 4 de `/spec`:

1. Número correlativo: el mayor de `specs/` + 1, a dos dígitos.
2. Slug kebab a partir del juego: el archivo es `specs/NN-juego-<slug>.md`
   (p. ej. `specs/07-juego-tetris.md`).
3. Fecha: la del contexto de sesión. **Nunca inventes la fecha.**
4. Estado **`Borrador`**. No lo marques `Aprobado` tú.
5. Cabecera con `**Depende de:** SPEC 05, SPEC 06` (verifica que ambos existen en `specs/`).
6. Siembra `specs/.spec-config.yml` sólo si falta (no sobreescribas uno existente).
7. Confirma la ruta creada, recuerda aprobarlo y luego `/spec-impl NN-juego-<slug>`. **Para ahí.**

## Reglas duras

- **Lee la skill `/spec` antes de crear el archivo de especificación.** Es la referencia canónica de
  estructura y convenciones; esta skill sólo la especializa.
- **Nunca escribas código del juego** (ni motor, ni componente, ni estilos). Sólo el `.md` del spec.
- El spec **debe** prescribir el alta del catálogo **vía MCP de Supabase**
  (`apply_migration`/`execute_sql`: `UPDATE`/`INSERT` en `public.games`), **no** SQL versionado en el
  repo. `scores` no requiere cambios (tabla única por `game_id`).
- El spec **reutiliza** la capa genérica existente (`SupabaseService`, `GamesService`,
  `ScoresService`, `GameCard`/`GameDetail`/`HallOfFame`/`Library`/`Home`): esos se **verifican**, no
  se re-planifican ni se reescriben.
- Ruta `jugar/<id>` **antes** de `jugar/:id` en `src/app/app.routes.ts`.
- Motor **SSR-safe**: se crea sólo en navegador con `afterNextRender` + `NgZone.runOutsideAngular`;
  no añadas un `isPlatformBrowser` redundante dentro de `afterNextRender`.
- En el paso de estilos, el spec debe pedir **coordinar `frontend-design` + `ui-ux-pro-max`** (regla
  de `CLAUDE.md`): foco visible, contraste, `prefers-reduced-motion` (atenúa decoración, no
  jugabilidad), SVG/íconos `aria-hidden`.
- **No propongas implementar el spec** tras guardarlo. Tu trabajo acaba al escribir el archivo; el
  usuario corre `/spec-impl` cuando esté listo.

## Argumentos

`$ARGUMENTS` es el **nombre o descripción del juego** (p. ej. `tetris`, `arkanoid`, o "un pong a dos
jugadores"). De ahí sale el slug del archivo. Si viene como un único token kebab (`tetris`), úsalo a
la vez como descripción y como semilla del slug sin volver a preguntar.
