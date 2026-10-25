---
name: spec-impl-game
description: Implementa un spec aprobado de un JUEGO igual que /spec-impl (lee y sigue sus 4 fases en runtime) y, al completar la implementación, dispara EN SECUENCIA (nunca en paralelo) primero el agente @skin-designer y luego @mobile-porter sobre ese juego. Confirma una vez antes de lanzarlos. Pensado para specs de juego (specs/NN-juego-<slug>.md); no hace commits.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Task, Agent, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Implementa un spec de juego y aplica skins + responsive

## Contexto de sesión

Estado actual del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

Config de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, sin archivo)"`

---

Este comando es una **especialización de `/spec-impl` para juegos**. La implementación del spec es
**idéntica a `/spec-impl`**; al terminar, añade una fase que dispara dos agentes de presentación en
secuencia. Responde siempre en **español**.

## Fases 1–4 — Idénticas a `/spec-impl` (reutilización en runtime)

1. **Lee `.claude/skills/spec-impl/SKILL.md`** y **ejecuta sus cuatro fases EXACTAMENTE** como están
   escritas, tratando `$ARGUMENTS` como el identificador del spec:
   - Fase 1: identificar el spec en `specs/`.
   - Fase 2: validar que el estado **significa «Aprobado»**; si no, **para** con su mensaje de error.
   - Fase 3: comprobar árbol limpio, crear/cambiar a la rama `spec-NN-slug` (según `AutoCreateBranch`)
     y mostrar objetivo/alcance/plan/criterios.
   - Fase 4: implementar **paso a paso con pausas**, esperando confirmación entre pasos. **Nunca
     hagas commit.**
2. Usa los valores del **Contexto de sesión** de arriba (git/specs/config) como equivalente del
   bloque `!` propio de `/spec-impl`. Respeta todas sus condiciones de parada.

**No continúes a la Fase 5** si la implementación no terminó (estado no Aprobado, el usuario detuvo
el flujo, o quedan pasos del plan). La Fase 5 solo ocurre cuando el **último paso** del plan está
completo.

## Fase 5 — Disparar agentes en secuencia (NUEVO)

Solo tras completar el último paso de la implementación:

1. **Determina el `id` del juego** (kebab): de la identidad de catálogo del spec (fila de `games` /
   Modelo de datos), de la carpeta `src/app/games/<id>/` creada durante la implementación y de la
   ruta `jugar/<id>`.
   - Si **no** puedes determinar un `id` de juego (el spec no es de un juego / no se creó un juego),
     **dilo y omite la Fase 5** — los agentes de este comando solo operan sobre un juego. Recuerda
     entonces verificar criterios de aceptación como cierra `/spec-impl`.
2. **Confirma UNA vez** antes de lanzar:
   ```
   ✅ Implementación completada.
   Voy a lanzar, UNO TRAS OTRO (nunca en paralelo):
     1) @skin-designer <id>
     2) @mobile-porter <id>
   ¿Continúo?
   ```
   Espera un «sí» explícito. Si dice que no, para sin lanzar nada.
3. **Lanza los agentes ESTRICTAMENTE EN SECUENCIA** (regla dura):
   a. Lanza el agente `skin-designer` (herramienta de subagentes, `subagent_type: skin-designer`)
      pasándole el `id` del juego como objetivo (equivale a `@skin-designer <id>`).
   b. **ESPERA a que `skin-designer` TERMINE** (su notificación de finalización). No lances nada más
      mientras tanto ni predigas su resultado.
   c. **Solo cuando `skin-designer` haya terminado**, lanza el agente `mobile-porter`
      (`subagent_type: mobile-porter`) con el **mismo** `id` (equivale a `@mobile-porter <id>`).
   d. Espera a que `mobile-porter` termine.
   - **REGLA INVIOLABLE:** nunca emitas las dos llamadas de agente en el mismo mensaje; nunca en
     paralelo. Uno acaba, luego empieza el siguiente, en ese orden (skin-designer → mobile-porter).
4. **Informe final** (los informes de los agentes NO los ve el usuario: relata lo que importe):
   - Qué implementó el spec (resumen).
   - Resultado de `@skin-designer` (skins aplicados, `npm run build`).
   - Resultado de `@mobile-porter` (pantallas conformadas, `npm run build`).
   - Recuerda que **nada se ha commiteado** (ni `/spec-impl`, ni los agentes): el commit lo hace el
     usuario, y conviene verificar los criterios de aceptación del spec.

## Reglas duras

- **Reutiliza `/spec-impl` tal cual** para las Fases 1–4: **léelo**, no lo dupliques.
- **Solo juegos:** si no hay `id` de juego, omite la Fase 5 con una nota.
- **Agentes estrictamente secuenciales:** `skin-designer` **antes** de `mobile-porter`, nunca en
  paralelo, nunca ambos en un mismo mensaje.
- **Una sola confirmación** antes de lanzar los agentes.
- **Nunca hagas commit** (lo dejan al usuario `/spec-impl`, `@skin-designer` y `@mobile-porter`).
- **Responde en español.**
