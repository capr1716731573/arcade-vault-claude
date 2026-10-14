# SPEC 01 — MVP visual de Arcade Vault (pantallas restantes)

> **Estado:** Aprobado
> **Depende de:** ninguna (la pantalla Biblioteca ya está portada en el commit `3916933`)
> **Fecha:** 2026-10-13
> **Objetivo:** Portar a Angular las pantallas pendientes del prototipo React (navbar, footer, detalle, reproductor simulado, acceso y salón de la fama), con datos ficticios en `src/app/data/` servidos por servicios.

---

## Alcance

**Dentro:**

- Navbar con enlaces, contador de créditos, botón de sesión y panel móvil (hamburguesa) + footer, ambos en `app.html`.
- Pantalla Detalle del juego (`/juego/:id`) con portada, tags, estadísticas, botón jugar y ranking top 10.
- Pantalla Reproductor (`/jugar/:id`): HUD, arena CRT decorativa, puntuación simulada con timer, pausa, FIN, modal de fin de juego con guardado de puntuación.
- Pantalla Acceso (`/acceso`): pestañas iniciar sesión / crear cuenta, invitado, botones sociales (solo visuales).
- Pantalla Salón de la Fama (`/salon`): pestañas por juego, podio, tabla de 12 filas, fila "tu mejor marca" si hay sesión.
- Carpeta `src/app/data/` con los datos ficticios (juegos, categorías, jugadores, generador de puntuaciones).
- Servicios fachada que leen de `data/` y gestionan sesión y puntuaciones guardadas.
- Rutas en `src/app/app.routes.ts` y conexión de `Library.onSelect` con la ruta de detalle.
- Smoke tests Vitest por componente y servicio.

**Fuera de alcance (para futuros specs):**

- Cualquier juego real (lógica, canvas, controles de teclado/táctil).
- Backend, base de datos o autenticación real.
- OAuth real con Google/GitHub (los botones no hacen nada).
- Mezclar las puntuaciones guardadas en `av_scores` con las ficticias en detalle/salón.
- Validación de formularios más allá de lo que hace el prototipo.
- Internacionalización (la UI queda solo en español).

## Modelo de datos

Mueve `src/app/games/games.data.ts` a `src/app/data/games.data.ts` (misma forma de `Game`, `CATS`, `GAMES`) y añade:

```ts
// src/app/data/players.data.ts
export const PLAYERS: string[]; // 18 alias, copiados de data.jsx

// src/app/data/scores.data.ts
export interface ScoreRow { rank: number; name: string; score: number; date: string } // date: 'dd/mm/2026'
export function seededScores(seed: number, count = 12): ScoreRow[]; // mismo algoritmo que el prototipo

// src/app/services/session.service.ts
export interface User { name: string } // en mayúsculas, máx. 10 caracteres
// signal<User | null>, persistido en localStorage['av_user']

// src/app/services/scores.service.ts
export interface SavedScore { game: string; score: number; name: string; at: number }
// persistido en localStorage['av_scores'] (array); solo escritura en este spec
```

Convenciones:

- Semillas del prototipo: detalle `id.length * 17 + 3` con 10 filas; salón `tab.length * 23 + 7` con 12 filas.
- Números con `toLocaleString('es-ES')`.
- Todo el acceso a `localStorage` va en `try/catch`.
- `GamesService` expone `all()`, `byId(id)` y `categories`; `ScoresService` expone `top(gameId, count)` (usa `seededScores`) y `save(entry)`. Ningún componente importa `data/` directamente.

## Plan de implementación

1. Crear `src/app/data/`: mover `games.data.ts`, añadir `players.data.ts` y `scores.data.ts`; actualizar imports de `Library` y `GameCard`. Prueba: `npm start`, la biblioteca se ve igual.
2. Crear `GamesService` y `ScoresService` (solo lectura: `top`); hacer que `Library` use `GamesService`. Prueba: biblioteca filtra igual que antes.
3. Crear `SessionService` (signal `user`, `login`, `logout`, persistencia `av_user`) y `ScoresService.save` (`av_scores`).
4. Crear componentes `Nav` (con panel móvil) y `Footer`; montarlos en `app.html`. Prueba: enlaces visibles, hamburguesa abre/cierra el panel, estado activo según ruta.
5. Declarar las 4 rutas nuevas en `app.routes.ts` con componentes vacíos y la ruta `**` que redirige a `''`. Prueba: navegar a cada URL no da error.
6. Implementar `GameDetail` (`/juego/:id`); conectar `Library.onSelect` con `router.navigate(['/juego', id])`. Id inexistente redirige a `''`.
7. Implementar `Auth` (`/acceso`): pestañas, formulario, invitado, botones sociales sin acción. Al entrar guarda sesión y va a `''`.
8. Implementar `HallOfFame` (`/salon`): pestañas, podio, tabla y fila "tu mejor marca" condicionada a la sesión.
9. Implementar `GamePlayer` (`/jugar/:id`): HUD, arena CRT, timer de puntuación (cada 220 ms), subida de nivel, pausa, FIN, modal con guardado, "jugar de nuevo".
10. Añadir smoke tests `.spec.ts` por componente y servicio. Ejecutar `npx ng test --watch=false` y `npm run build`.

Cada paso deja la app compilando y navegable. Los componentes son standalone con `templateUrl`, usan `input()`/`computed()`/signals y `@for`/`@if`, y reutilizan las clases de `src/styles.css` (se mantiene `av-`). El diseño sigue la regla de CLAUDE.md: `frontend-design` + `ui-ux-pro-max` coordinadas, sin salirse del tema neón existente.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores ni warnings de compilación.
- [ ] `npx ng test --watch=false` pasa, con al menos un `.spec.ts` por cada componente y servicio nuevo.
- [ ] `src/app/games/` ya no existe; `GAMES` y `CATS` se importan solo desde `src/app/data/` dentro de los servicios.
- [ ] Ningún componente importa directamente archivos de `src/app/data/`.
- [ ] Hacer clic en una tarjeta de la biblioteca navega a `/juego/<id>` y ya no hay `console.log` en `Library.onSelect`.
- [ ] `/juego/<id-inválido>`, `/jugar/<id-inválido>` y cualquier ruta desconocida redirigen a `/`.
- [ ] El detalle muestra título, descripción larga, tags, tres estadísticas y 10 filas de ranking; los 3 primeros llevan las clases `top1`, `top2`, `top3`.
- [ ] "JUGAR AHORA" navega a `/jugar/<id>` y "VOLVER AL VAULT" a `/`.
- [ ] En el reproductor la puntuación aumenta sola; PAUSA la detiene y muestra "EN PAUSA"; REANUDAR la continúa.
- [ ] FIN abre el modal con la puntuación final; "GUARDAR PUNTUACIÓN" añade una entrada con `at` a `localStorage['av_scores']` y muestra "PUNTUACIÓN GUARDADA".
- [ ] "JUGAR DE NUEVO" reinicia puntuación a 0, vidas a 3 y nivel a 1; SALIR vuelve al detalle.
- [ ] Entrar con cualquier usuario guarda `av_user` en mayúsculas (máx. 10 caracteres); recargar mantiene la sesión.
- [ ] Con usuario vacío, "ENTRAR AL VAULT" usa el nombre `PLAYER1`.
- [ ] "JUGAR COMO INVITADO" deja `av_user` vacío y navega a `/`; el nombre por defecto en el reproductor es `INVITADO`.
- [ ] Con sesión, la navbar muestra el nombre del usuario y al pulsarlo cierra sesión; sin sesión muestra "Iniciar Sesión".
- [ ] La pestaña "Crear cuenta" muestra el campo de correo; "Iniciar sesión" lo oculta.
- [ ] El salón tiene una pestaña por cada juego (8); cambiar de pestaña cambia podio y tabla; solo se ve "tu mejor marca" con sesión.
- [ ] Con ancho ≤ 768 px aparece la hamburguesa y el panel lateral abre y cierra con el backdrop.
- [ ] El enlace activo de la navbar es "Biblioteca" en `/`, `/juego/:id` y `/jugar/:id`, y "Salón de la Fama" en `/salon`.
- [ ] No hay errores en la consola del navegador al recorrer las 5 pantallas.

## Decisiones tomadas y descartadas

- **Sí:** un solo spec. Es una sola área (UI), los prototipos ya definen el comportamiento y el plan se parte por pantalla.
- **Sí:** reproductor con la simulación del prototipo (timer aleatorio, pausa, game over). Da una pantalla completa sin implementar juego.
- **No:** reproductor estático o con "PRÓXIMAMENTE"; pierde el flujo de guardado de puntuación que el prototipo ya define.
- **Sí:** `src/app/data/` para datos ficticios y servicios fachada. Cuando exista base de datos solo cambian los servicios, no los componentes.
- **No:** import directo de `data/` en componentes; acopla la UI a la fuente de datos.
- **Sí:** sesión y puntuaciones guardadas en localStorage (`av_user`, `av_scores`) como en el prototipo. Es la única persistencia hasta que haya backend.
- **No:** mezclar `av_scores` con los datos ficticios en detalle y salón. Se difiere hasta que haya backend real.
- **Sí:** rutas en español (`juego/:id`, `jugar/:id`, `acceso`, `salon`), coherentes con el idioma de la UI.
- **No:** replicar el hash JSON del prototipo (`#%7B"name"...`); el router de Angular lo reemplaza.
- **Sí:** smoke tests Vitest por componente y servicio para proteger la lógica de signals (login, pausa, game over, tabs).

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| `localStorage` deshabilitado o con JSON corrupto | `try/catch` en lectura y escritura; el servicio cae a estado en memoria y la app sigue funcionando. |
| El timer del reproductor sigue corriendo al salir de la pantalla | Limpiar el intervalo con `DestroyRef`/`effect` al destruir el componente. |
| Mover `games.data.ts` rompe imports existentes | El paso 1 actualiza `Library` y `GameCard`; `npm run build` lo verifica antes de seguir. |
| `seededScores` con `toLocaleString('es-ES')` varía por entorno de tests | Los tests comparan estructura y orden, no cadenas formateadas. |
| Conflicto de estilo entre `frontend-design` y `ui-ux-pro-max` | Prima el tema neón de `src/styles.css`; solo se añaden estilos que falten para las pantallas nuevas. |

## Lo que **no** entra en este spec

- Ningún juego jugable.
- Backend, base de datos o autenticación real.
- OAuth con Google/GitHub.
- Mezcla de puntuaciones guardadas con las ficticias.
- Cambios de diseño sobre el tema neón existente.
