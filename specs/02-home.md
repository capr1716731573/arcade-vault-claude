# SPEC 02 — Pantalla Home (landing)

> **Estado:** Implementado
> **Depende de:** SPEC 01 (navbar, servicios, rutas, `GamesService` y tema neón ya existen)
> **Fecha:** 2026-10-14
> **Objetivo:** Portar a Angular la pantalla Home del prototipo `home.jsx` y publicarla en la ruta `/juego`, sin mover la Biblioteca (sigue en `/`).

---

## Alcance

**Dentro:**

- Componente `Home` en `/juego` (ruta exacta) con las secciones del prototipo: hero con siluetas flotantes, "¿Por qué Arcade Vault?" (4 tarjetas con icono pixel), "Juegos disponibles ahora" (6 mini-tarjetas + botón "Ver todos"), banda de estadísticas, "Actividad en vivo" (últimas puntuaciones + top jugadores de hoy), precios con FAQ y CTA final.
- Animación `reveal` al hacer scroll (IntersectionObserver) y `fade-in` de entrada.
- Navbar: añadir enlace "Inicio" → `/juego` (desktop y panel móvil), con estado activo solo en `/juego` exacto.
- Datos mock del Home en `src/app/data/` servidos por un servicio.
- Portar a `src/styles.css` solo las reglas CSS del Home de `home-about/styles.css`.
- Smoke tests Vitest.

**Fuera de alcance (para futuros specs):**

- Página "Acerca de" (`about.jsx`), su ruta y su enlace en la navbar.
- Mover la Biblioteca o cambiar la ruta `/` (sigue siendo la Biblioteca).
- Datos dinámicos reales (actividad o ranking derivados de `av_scores` o `seededScores`).
- Backend, autenticación real, contador real de partidas.
- Cambios al tema neón o a pantallas ya implementadas, salvo la navbar.
- Reemplazar `src/styles.css` por el del prototipo completo.

## Modelo de datos

Reutiliza `Game` de `src/app/data/games.data.ts`. Se añade:

```ts
// src/app/data/home.data.ts
export type NeonColor = 'cyan' | 'magenta' | 'yellow' | 'green';

export interface Feature { icon: 'GAMEPAD' | 'FREE' | 'TROPHY' | 'ROCKET'; title: string; desc: string; color: NeonColor }
export interface HomeStat { n: string; unit: string; sub: string }
export interface ActivityRow { player: string; game: string; score: number; ago: string; color: NeonColor }
export interface TopPlayer { rank: number; player: string; score: number }
export interface Faq { q: string; a: string }

export const FEATURES: Feature[];        // 4, copiadas de home.jsx
export const HOME_STATS: HomeStat[];     // 3
export const ACTIVITY: ActivityRow[];    // 7
export const TOP_TODAY: TopPlayer[];     // 5
export const PRICING_FEATURES: string[]; // 6
export const FAQS: Faq[];                // 3
```

```ts
// src/app/services/home.service.ts
// Fachada: features(), stats(), activity(), topToday(), pricingFeatures(), faqs()
// Los 6 juegos del Home salen de GamesService.all().slice(0, 6), no de data/.
```

Convenciones: textos tal cual el prototipo, en español; puntuaciones con `toLocaleString('es-ES')`; ningún componente importa `data/` directamente (igual que SPEC 01). Sin persistencia nueva.

Componentes (standalone, `templateUrl`, `@for`/`@if`):

- `src/app/home/home.ts|html` — pantalla; el reveal se aplica con una directiva.
- `src/app/home/reveal.ts` — directiva `[appReveal]` que añade la clase `in` al entrar en viewport (threshold 0.12) y desconecta el observer al destruirse.
- `src/app/home/floating-silhouettes/` — 8 SVG decorativos (`aria-hidden`).
- `src/app/home/feature-icon/` — `input()` con el tipo de icono.
- `src/app/home/mini-card/` — `input()` de `Game`, `output()` `selected`.

## Plan de implementación

1. Datos y servicio: crear `data/home.data.ts` y `HomeService` con su spec. Prueba: `npx ng test --watch=false`.
2. Ruta: en `app.routes.ts` declarar `{ path: 'juego', component: Home }` **antes** de `juego/:id` (con placeholder inicial). `''` sigue siendo `Library`; `**` sigue redirigiendo a `''`. Prueba: `npm start`, `/juego` carga y `/juego/<id>` sigue mostrando el detalle.
3. Navbar: añadir "Inicio" → `/juego` (activo solo con coincidencia exacta). "Biblioteca" mantiene `/` y su estado activo actual. El logo sigue apuntando a `/`. Actualizar `nav.spec.ts`.
4. Estilos: portar a `src/styles.css` las reglas del Home (hero, siluetas, feature-grid, mini-rail, stats, activity, pricing, final, `reveal`/`in`, animaciones y media queries correspondientes). Prueba: la build no cambia el aspecto de las pantallas existentes.
5. Componentes de apoyo: `FloatingSilhouettes`, `FeatureIcon`, `MiniCard` y la directiva `Reveal`.
6. `Home`: ensamblar las 6 secciones y el hero. Navegación: "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS" e "INSERTAR MONEDA" → `/`; "CREAR CUENTA" y "EMPEZAR GRATIS" → `/acceso`; "VER SALÓN →" → `/salon`; mini-tarjeta → `/juego/:id`.
7. Diseño: aplicar `frontend-design` + `ui-ux-pro-max` coordinadas (CLAUDE.md), respetando el tema neón; foco visible, `prefers-reduced-motion` desactiva siluetas/pulse/reveal, contraste legible, layout hasta 360 px.
8. Smoke tests de `Home`, `MiniCard`, `Reveal` y rutas. Ejecutar `npx ng test --watch=false` y `npm run build`. Actualizar "Port status" en CLAUDE.md.

Cada paso deja la app compilando y navegable.

## Criterios de aceptación

- [ ] `npm run build` y `npx ng test --watch=false` terminan sin errores.
- [ ] `/juego` muestra el Home; `/` sigue mostrando la Biblioteca y `/juego/<id>` el detalle.
- [ ] El hero muestra "EL ARCADE / CLÁSICO ESTÁ / DE VUELTA", 2 CTAs y 8 siluetas decorativas con `aria-hidden="true"`.
- [ ] Se renderizan 4 tarjetas de características, 6 mini-tarjetas de juego, 3 estadísticas, 7 filas de actividad, 5 de top jugadores, 6 beneficios del plan y 3 FAQ.
- [ ] Las 6 mini-tarjetas coinciden con los 6 primeros de `GamesService.all()`; al hacer clic navegan a `/juego/<id>`.
- [ ] Los 3 primeros del top llevan las clases `top1`, `top2`, `top3`.
- [ ] "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS" e "INSERTAR MONEDA" navegan a `/`; "CREAR CUENTA" y "EMPEZAR GRATIS" a `/acceso`; "VER SALÓN →" a `/salon`.
- [ ] Las secciones con `reveal` reciben la clase `in` al entrar en pantalla y el observer se desconecta al salir del Home.
- [ ] La navbar muestra "Inicio" activo solo en `/juego` (no en `/juego/:id`); "Biblioteca" sigue activo en `/`, `/juego/:id` y `/jugar/:id`.
- [ ] Una ruta desconocida o un id de juego inválido sigue redirigiendo a `/`.
- [ ] Ningún componente importa `src/app/data/` directamente.
- [ ] Con `prefers-reduced-motion: reduce` no hay animaciones de siluetas, pulso ni reveal (el contenido es visible).
- [ ] Sin scroll horizontal a 360 px de ancho.
- [ ] No hay errores en la consola del navegador al recorrer Home, Biblioteca, Detalle, Salón y Acceso.

## Decisiones tomadas y descartadas

- **Sí:** Home en `/juego` (decisión explícita del usuario, reafirmada tras proponer `/`). La Biblioteca no se mueve: `/` sigue siendo la Biblioteca.
- **No:** Home en `/` con Biblioteca en `/biblioteca`; propuesto en la primera versión de esta spec y descartado por el usuario. Evita además tocar los destinos "VOLVER AL VAULT", redirecciones y login, que siguen en `/`.
- **Sí:** `juego` se declara antes de `juego/:id`; Angular compara por segmentos, así que `/juego` no colisiona con el detalle.
- **Sí:** navbar con solo "Inicio" añadido. "Acerca de" espera a su propio spec para no dejar un enlace roto.
- **Sí:** el logo sigue apuntando a `/` (Biblioteca) para no alterar la navegación existente; ajustable si se quiere que apunte a `/juego`.
- **Sí:** portar solo las reglas CSS del Home al `styles.css` global. Reemplazar el archivo completo arriesga alterar pantallas ya implementadas.
- **Sí:** datos de actividad, top, stats y FAQ como mock en `data/` servidos por `HomeService`, y los juegos desde `GamesService`. Mantiene la convención de SPEC 01.
- **No:** derivar actividad/top de `seededScores` o `av_scores`; amplía el alcance y se difiere hasta haber backend.
- **Sí:** reveal como directiva reutilizable, para reutilizarlo en "Acerca de".

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| `/juego` y `/juego/:id` colisionan o el Home activa "Inicio" en el detalle | Ruta `juego` exacta declarada antes de `juego/:id`; el enlace "Inicio" usa coincidencia exacta (`routerLinkActive` con `exact`); se cubre en `nav.spec.ts`. |
| CSS del Home choca con clases existentes (`.btn`, `.pixel`, `.neon-*`) | Se portan solo reglas nuevas; si hay duplicado, prima el `styles.css` actual y se revisa visualmente. |
| `IntersectionObserver` no existe en jsdom (tests) | Los tests lo simulan con un stub; la directiva debe degradar y mostrar el contenido si el API no está disponible. |
| Animaciones decorativas dañan accesibilidad o rendimiento móvil | `prefers-reduced-motion`, `aria-hidden` en siluetas y SVG ligeros sin imágenes. |
| `GamesService.all()` devuelve menos de 6 juegos | `slice(0, 6)` tolera menos elementos; hoy hay 8. |
