# SPEC 03 — Página Acerca de + envío de correo (Resend)

> **Estado:** Implementado
> **Depende de:** SPEC 01 (navbar, rutas, servicios fachada), SPEC 02 (directiva `[appReveal]`, estilos base del tema neón)
> **Fecha:** 2026-10-14
> **Objetivo:** Portar a Angular la pantalla `about.jsx` del prototipo en la ruta `/acerca` y hacer que su formulario de contacto envíe un correo real al equipo mediante Resend desde un endpoint de servidor Angular SSR.

---

## Alcance

**Dentro:**

- Componente `About` en `/acerca` (ruta exacta) con el contenido del prototipo `about.jsx`: hero "ACERCA DE ARCADE VAULT" + misión, fila de 3 highlights con icono pixel (HEART / BROWSER / PLANT), divider animado y sección de contacto con el formulario.
- Animación `reveal` al hacer scroll reutilizando la directiva `[appReveal]` de SPEC 02 y `fade-in` de entrada.
- Formulario de contacto (nombre, correo, mensaje) con **envío real** vía Resend:
  - Estados de UI: `idle` → `sending` (botón deshabilitado, "TRANSMITIENDO…") → `ok` (terminal de éxito del prototipo) / `error` (variante de terminal con `[ERROR]` y botón "REINTENTAR").
  - Validación antes de enviar: los tres campos no vacíos (animación `shake` si falta alguno) **y** formato de correo válido.
- Introducir servidor Angular SSR (`@angular/ssr`) con un endpoint `POST /api/contacto` que llama a Resend. La API key vive solo en el servidor (archivo `.env-template`, variable `API_KEY_RESEND`; nunca en el bundle del cliente).
- Servicio fachada `ContactService` (cliente) que hace el `POST /api/contacto` con `HttpClient`; registrar `provideHttpClient` en `app.config.ts`.
- Navbar: añadir enlace "Acerca de" → `/acerca` (desktop + panel móvil), activo solo en `/acerca`.
- Portar a `src/styles.css` solo las reglas CSS del About de `home-about/styles.css` (más una pequeña variante para el estado de error, que el prototipo no tiene).
- Smoke tests Vitest de `About`, `ContactService`, el handler del endpoint y la navbar.

**Fuera de alcance (para futuros specs):**

- Autorespuesta/confirmación al visitante (solo se envía la notificación al equipo).
- Dominio propio verificado en Resend; se usa el sandbox `onboarding@resend.dev`.
- Persistencia de los mensajes enviados (no se guardan en `localStorage` ni en BD).
- Protección antispam (honeypot, captcha, rate limiting).
- Cambios al tema neón o a pantallas ya implementadas, salvo la navbar y `app.config.ts`.
- Reemplazar `src/styles.css` por el del prototipo completo.
- Internacionalización (la UI queda solo en español).

## Modelo de datos

No introduce datos persistentes (ni `localStorage` ni BD). Introduce **un contrato de request/response** y variables de entorno de servidor.

```ts
// Contrato del endpoint  POST /api/contacto
interface ContactRequest { name: string; email: string; msg: string }
type ContactResponse =
  | { ok: true }                 // HTTP 200: correo aceptado por Resend
  | { ok: false; error: string } // HTTP 400 (validación) / 500 (fallo Resend)
```

```ts
// src/app/services/contact.service.ts  (cliente, fachada sobre HttpClient)
// send(payload: ContactRequest): Observable<ContactResponse>
//   POST relativo a '/api/contacto'
```

Envío en el servidor (Resend SDK `resend`):

```
from:    'Arcade Vault <onboarding@resend.dev>'   // sandbox, sin dominio verificado
to:      process.env.CONTACT_TO  ?? 'capr.developer@gmail.com'
replyTo: <email del visitante>                     // responder va directo al visitante
subject: 'Nuevo mensaje de <name> — Arcade Vault'
html/text: nombre, correo y mensaje del visitante
```

Variables de entorno. La API key de Resend **ya está provista** en el archivo `.env-template` (raíz del repo), bajo la variable `API_KEY_RESEND`:

```
# .env-template (raíz del proyecto)
API_KEY_RESEND=re_xxx        # requerida; sin ella el endpoint responde 500
CONTACT_TO=capr.developer@gmail.com   # opcional; en sandbox Resend solo entrega al email de la cuenta
```

> El servidor lee `process.env.API_KEY_RESEND`. En dev se carga `.env-template` con `process.loadEnvFile('.env-template')`; en producción el host inyecta la env.
>
> ⚠️ **Seguridad:** `.env-template` contiene una API key real y hoy **no está en `.gitignore` ni trackeado**. Este spec lo añade a `.gitignore` antes de cualquier commit para no filtrar la clave. (`CONTACT_TO` se añade al archivo si se quiere sobreescribir el destinatario por defecto.)

> Nota sandbox: con `onboarding@resend.dev` Resend solo entrega al correo dueño de la cuenta Resend; por eso `CONTACT_TO` por defecto es el correo del usuario.

Componentes (standalone, `templateUrl`, `@for`/`@if`, signals):

- `src/app/about/about.ts|html` — pantalla; signals `name`/`email`/`msg`, `status` (`'idle'|'sending'|'ok'|'error'`), `shake`, y el nombre enviado para la terminal; usa `[appReveal]`.
- `src/app/about/highlight-icon/` — `input()` con `kind: 'HEART'|'BROWSER'|'PLANT'`, SVG pixel `aria-hidden` (port de `HighlightIcon`).

Convenciones: textos tal cual el prototipo, en español; ningún componente importa `src/app/data/` directamente; todo acceso a `process.env` y la clave van solo en el servidor; `HttpClient` para las llamadas (idiomático Angular), no `fetch` directo en el componente.

## Plan de implementación

1. **SSR + dependencias.** `ng add @angular/ssr` (genera `src/server.ts`, actualiza `angular.json` y añade el script `serve:ssr:05-arcade`); `npm i resend`. Prueba: `npm run build` y `npm start` siguen sirviendo la app sin cambios visibles.
2. **Endpoint.** En `src/server.ts`: cargar `.env-template` en dev con `process.loadEnvFile?.('.env-template')` (guardado en try/catch; el host de deploy inyecta las env en producción), `express.json()`, y `app.post('/api/contacto', …)` **antes** del handler SSR catch-all. Extraer la lógica a una función pura `sendContactEmail(payload, deps)` que valida y llama a Resend, para poder testearla. Validación servidor: campos no vacíos + formato email → 400; sin `API_KEY_RESEND` o fallo de Resend → 500; éxito → `{ ok: true }`. Prueba: `curl -X POST localhost:4200/api/contacto` en dev y contra el server construido devuelve la respuesta esperada.
3. **Secreto.** Añadir `.env-template` a `.gitignore` (hoy no está) para no filtrar la API key real; verificar que no queda trackeado.
4. **HttpClient + servicio.** Añadir `provideHttpClient()` en `app.config.ts`; crear `ContactService.send()` con su `.spec.ts` (usa `HttpTestingController`: verifica POST a `/api/contacto`, cuerpo correcto, ramas ok/error).
5. **Estilos.** Portar a `src/styles.css` solo las reglas del About (`about-hero`, `about-title`, `about-mission`, `highlight-row`/`highlight`/`hl-icon`/`hl-text`, `about-divider`/`div-bar`/`div-pixels`, `about-contact`/`contact-grid`/`contact-intro`/`contact-sub`/`contact-tips`/`tip`/`tip-led`, `contact-form`/`field`, `terminal-success`/`term-bar`/`dot`/`term-title`/`term-body`/`line`/`prompt`/`caret`, `shake` + keyframes y sus media queries) y añadir una variante mínima para el estado de error (`[ERROR]`). `.reveal`/`.in`/`.fade-in` ya existen; no duplicarlos.
6. **Componentes.** `HighlightIcon` (SVG pixel por `kind`) y `About` ensamblando hero, highlights, divider y formulario. Submit: validar → `status='sending'` → `ContactService.send()` → `ok`/`error`; "ENVIAR OTRO MENSAJE" y "REINTENTAR" vuelven a `idle` reseteando lo apropiado.
7. **Ruta + navbar.** En `app.routes.ts` declarar `{ path: 'acerca', component: About }` antes de `**`. En `nav.html` añadir "Acerca de" → `/acerca` (desktop + móvil, orden: Inicio · Biblioteca · Salón de la Fama · Acerca de); en `nav.ts` añadir `inAbout = computed(() => url() === '/acerca')`. Actualizar `nav.spec.ts`.
8. **Diseño.** Coordinar `frontend-design` + `ui-ux-pro-max` (CLAUDE.md) respetando el tema neón: foco visible, contraste legible, `prefers-reduced-motion` desactiva el pulso de los pixels del divider y el reveal, layout hasta 360 px, SVG de highlights `aria-hidden`.
9. **Tests y cierre.** Smoke tests de `About` (validación/shake, transición de estados con `ContactService` mockeado, ramas ok/error), `ContactService`, `sendContactEmail` (Resend fake) y navbar. Ejecutar `npx ng test --watch=false` y `npm run build`. Actualizar "Port status" en CLAUDE.md (About done; `about.jsx` ya no pendiente).

Cada paso deja la app compilando y navegable.

## Criterios de aceptación

- [ ] `npm run build` y `npx ng test --watch=false` terminan sin errores.
- [ ] `/acerca` muestra el About; el resto de rutas siguen funcionando igual.
- [ ] El hero muestra el kicker "▸ ACERCA DE", el título "ACERCA DE ARCADE VAULT" y el párrafo de misión tal cual el prototipo.
- [ ] Se renderizan los 3 highlights (HEART / BROWSER / PLANT) con su icono pixel `aria-hidden="true"`, el divider con sus 24 pixels y la sección de contacto con los 3 "tips".
- [ ] El formulario tiene los campos NOMBRE, CORREO ELECTRÓNICO y MENSAJE con los placeholders del prototipo.
- [ ] Enviar con algún campo vacío **o** con correo de formato inválido no llama al endpoint y dispara la animación `shake`.
- [ ] Con datos válidos, al enviar el botón pasa a estado deshabilitado/"TRANSMITIENDO…", se hace `POST /api/contacto` con `{ name, email, msg }` y el cuerpo se envía sin errores.
- [ ] Si el endpoint responde `{ ok: true }`, se muestra la terminal de éxito con "> MENSAJE RECIBIDO…" y el nombre en mayúsculas, y "ENVIAR OTRO MENSAJE" vuelve al formulario vacío.
- [ ] Si el endpoint falla, se muestra la variante de error con "[ERROR]" y "REINTENTAR" vuelve al formulario conservando los datos.
- [ ] `POST /api/contacto` con cuerpo válido llama a Resend con `from` sandbox, `to` = `CONTACT_TO`/fallback, `replyTo` = correo del visitante y asunto con el nombre; responde 200 `{ ok: true }` (verificado con el envío de Resend mockeado).
- [ ] `POST /api/contacto` con cuerpo inválido responde 400 y sin `API_KEY_RESEND` responde 500; en ningún caso lanza un 500 sin manejar.
- [ ] La API key no aparece en el bundle del cliente (`dist/`): solo se lee de `process.env.API_KEY_RESEND` en el servidor; `.env-template` está en `.gitignore` y no queda trackeado.
- [ ] La navbar muestra "Acerca de" activo solo en `/acerca` (no en otras rutas); los demás enlaces conservan su estado activo.
- [ ] Ningún componente importa `src/app/data/` directamente; el componente usa `ContactService`, no `fetch` ni `HttpClient` directo.
- [ ] Con `prefers-reduced-motion: reduce` no hay animación de los pixels del divider ni reveal (el contenido es visible).
- [ ] Sin scroll horizontal a 360 px de ancho.
- [ ] No hay errores en la consola del navegador al recorrer Acerca de y el resto de pantallas.

## Decisiones tomadas y descartadas

- **Sí:** Resend desde un endpoint de **Angular SSR** (`src/server.ts`, `POST /api/contacto`). Un solo proyecto y un solo deploy; la API key queda en el servidor. Descartado: función serverless (requiere host específico y separa el endpoint) y servidor Node/Express aparte (dos procesos que mantener).
- **No:** llamar a Resend desde el navegador. Expone la API key en el cliente y Resend bloquea las llamadas desde el browser (CORS); se descarta por seguridad.
- **Sí:** estados `idle`/`sending`/`ok`/`error` manteniendo el estilo "terminal" del prototipo. El prototipo solo tenía éxito simulado; con envío real hacen falta carga y error.
- **Sí:** validación de campos no vacíos (con `shake`) **y** formato de correo, en cliente y servidor. El servidor revalida porque el endpoint es público.
- **Sí:** ruta `/acerca` (coherente con `/juego`, `/jugar`, `/acceso`, `/salon`). Descartado `/about` por romper la convención de rutas en español.
- **Sí:** sandbox `onboarding@resend.dev` como `from` (sin dominio verificado) y `CONTACT_TO` por defecto al correo del usuario, porque en sandbox Resend solo entrega al dueño de la cuenta. Dominio propio verificado se difiere.
- **Sí:** un único correo de notificación al equipo con `replyTo` = visitante. Autorespuesta al visitante descartada (duplica lógica y en sandbox fallaría).
- **Sí:** `ContactService` fachada sobre `HttpClient`, coherente con los servicios de SPEC 01 y testeable con `HttpTestingController`.
- **Sí:** la API key vive en `.env-template` (var `API_KEY_RESEND`), ya provista por el usuario; se carga en dev con `process.loadEnvFile('.env-template')` (Node ≥ 20.12, que Angular 22 ya exige) en lugar de añadir `dotenv`. Fallback: `dotenv` si el entorno no lo soporta.
- **Sí:** portar solo las reglas CSS del About al `styles.css` global, igual que SPEC 02; reemplazar el archivo completo arriesga pantallas ya implementadas.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Los endpoints custom de `server.ts` no se sirven igual en `ng serve` (dev) que en el server construido | El paso 2 verifica `POST /api/contacto` con `curl` tanto en `npm start` como contra el build; registrar la ruta antes del catch-all SSR. |
| La API key se filtra al bundle del cliente o al repo | La clave solo se lee de `process.env.API_KEY_RESEND` en `server.ts`; nunca en `environment.ts` ni en componentes; `.env-template` (que hoy no está ignorado y contiene la key real) se añade a `.gitignore`; se comprueba que no aparece en `dist/`. |
| Resend en sandbox rechaza entregas a correos distintos del dueño de la cuenta | `CONTACT_TO` por defecto es el correo del usuario; documentado en `.env-template`; para otros destinatarios se requiere dominio verificado (fuera de alcance). |
| Introducir SSR cambia el output de build y puede romper el deploy actual (SPA) | SSR se añade en el paso 1 y se valida `build` + `start` antes de seguir; el modo de salida y los scripts quedan documentados; el cliente sigue funcionando sin JS de servidor para las demás pantallas. |
| Testear el envío real dispararía correos en CI | La lógica va en `sendContactEmail(payload, deps)` con el cliente Resend inyectado; los tests usan un Resend fake, nunca la red. |
| Endpoint público sin antispam | Se valida y sanea el cuerpo; honeypot/rate limiting se difieren a otro spec y se anotan como fuera de alcance. |
| `HttpClient` nuevo en el proyecto sin `provideHttpClient` | El paso 4 lo registra en `app.config.ts` antes de usar `ContactService`; el `.spec.ts` lo cubre con `provideHttpClientTesting`. |
