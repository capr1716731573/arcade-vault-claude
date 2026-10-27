# SPEC 14 — Autenticación con Supabase (registro, login y sesión)

> **Estado:** Implementado
> **Depende de:** SPEC 04 (SupabaseService + persistencia de sesión reservada para este spec), SPEC 06 (tabla `scores`, su RLS y `ScoresService`, que aquí se endurecen)
> **Fecha:** 2026-10-26
> **Objetivo:** Sustituir la autenticación simulada por autenticación real de Supabase —registro y login con email confirmado, Google y GitHub—, con sesión persistida, recuperación de contraseña, página de cuenta y guardado de puntuación restringido a usuarios autenticados.

---

## Por qué existe este spec

La autenticación de hoy es una maqueta: `Auth` (`/acceso`) es un formulario que ignora email
y contraseña, los botones de Google y GitHub no hacen nada, y `SessionService` solo guarda un
`{ name }` en `localStorage` (`av_user`). SPEC 04 integró el `SupabaseService` con
`persistSession: false` y dejó explícito que **el spec de Auth activaría la persistencia de
sesión**. Este es ese spec: conecta `@supabase/supabase-js` Auth (ya disponible en el
proyecto) para registro, login y sesión reales, con tres proveedores.

Decisiones del usuario que acotan el alcance (bloques de preguntas):

1. **Guardar exige sesión.** Se puede jugar como invitado, pero el botón "GUARDAR
   PUNTUACIÓN" solo funciona con sesión iniciada. La RLS de `scores` se endurece a rol
   `authenticated` y la tabla gana `user_id`.
2. **Registro con confirmación por email** (doble opt-in): tras registrarse hay que confirmar
   desde un enlace del correo antes de poder iniciar sesión.
3. **Alcance ampliado:** además de registro + login + logout, entran recuperación de
   contraseña y una página de cuenta/perfil.
4. **Nombre desde `user_metadata`** (sin tabla `profiles`).
5. **Se reutiliza el nombre `SessionService`** (reescrito por dentro para envolver Supabase);
   no se tocan los imports del `nav` ni de los 5 juegos.
6. **La configuración del panel/consolas** (Google, GitHub, Supabase) se documenta como guía
   paso a paso; no se hace por MCP ni código.

---

## Alcance

**Dentro:**

- **Persistencia de sesión SSR-safe** en `src/app/services/supabase.service.ts`: en el
  navegador el cliente pasa a `persistSession: true`, `autoRefreshToken: true`,
  `detectSessionInUrl: true` (flujo PKCE); en servidor conserva los flags actuales
  (`false`), decidido con `isPlatformBrowser(inject(PLATFORM_ID))`. No se crea un segundo
  cliente: todo sigue pasando por `SupabaseService`.
- **`SessionService` reescrito** (mismo archivo y nombre, mismo patrón de servicio fachada)
  para envolver Supabase Auth. Mantiene el signal `user` (ahora `{ id, name, email, provider } | null`)
  y `logout()`; añade métodos asíncronos: `register(email, password, username)`,
  `signIn(email, password)`, `signInWithOAuth('google' | 'github')`,
  `resetPassword(email)`, `updatePassword(newPassword)`, `updateUsername(name)`. El signal se
  siembra con `getSession()` y se mantiene vivo con `onAuthStateChange` (solo en navegador).
- **`/acceso` real** (`Auth`): las pestañas INICIAR SESIÓN / CREAR CUENTA se cablean a
  `signIn` / `register`; campos reales de email + contraseña (y `username` en registro);
  botones GOOGLE y GITHUB → `signInWithOAuth`. Estados de carga ("ENTRANDO…"), error legible
  (credenciales inválidas, email ya registrado, etc.) y, tras registrarse, estado **"revisa
  tu correo"**. Enlace "¿Olvidaste tu contraseña?" → `/acceso/recuperar`.
- **Ruta de callback `/acceso/callback`** (`AuthCallback`): finaliza el intercambio de sesión
  de OAuth y de la confirmación de email (`detectSessionInUrl`/`exchangeCodeForSession`),
  muestra un spinner y redirige a `/` (o a la pantalla previa).
- **Recuperación de contraseña:** `/acceso/recuperar` (`Recuperar`) pide el email y llama
  `resetPasswordForEmail(redirectTo = …/acceso/nueva-clave)`; `/acceso/nueva-clave`
  (`NuevaClave`) detecta la sesión en modo recovery (`onAuthStateChange` → `PASSWORD_RECOVERY`)
  y permite fijar la nueva contraseña con `updatePassword`.
- **Página de cuenta `/cuenta`** (`Cuenta`, carpeta `src/app/cuenta/`): muestra email y
  proveedor, permite editar el `username` (`user_metadata`) y cerrar sesión. Protegida por un
  `authGuard` funcional (`CanActivateFn`) que redirige a `/acceso` si no hay sesión.
- **Nav:** el botón de usuario abre/enlaza a `/cuenta`; el menú móvil incluye "Cuenta".
- **Guardado de puntuación restringido** en los 5 juegos (asteroides, caída, bloque-buster,
  snake, frogger): si no hay sesión, el botón "GUARDAR PUNTUACIÓN" se sustituye por un CTA
  "INICIA SESIÓN PARA GUARDAR" que lleva a `/acceso`; con sesión, el nombre se toma de
  `user_metadata` (campo de edición manual retirado o bloqueado a ese valor). Solo cambia el
  flujo de guardado; **nada del motor ni de la jugabilidad**.
- **Base de datos (vía MCP de Supabase, no SQL versionado):** `scores` gana
  `user_id uuid references auth.users(id) default auth.uid()`; se elimina la política de
  insert anónima y se crea una de insert para rol `authenticated` con
  `with_check (user_id = auth.uid() AND score >= 0 AND char_length(name) BETWEEN 1 AND 12)`.
  `select` sigue público. Se regenera `src/app/database.types.ts`.
- **`ScoresService.save()`** deja de poder guardar anónimo; omite `user_id` en el insert para
  que lo rellene el `default auth.uid()`; devuelve el error de RLS si no hay sesión.
- **Tests:** `supabase-mock` extendido con un stub de `client.auth`; `session.service.spec.ts`
  reescrito contra ese stub; specs de los nuevos componentes/guard. Se corre por archivo
  (`npx ng test --include=…`), no la suite completa (riesgo OOM).
- **Apéndice de configuración** paso a paso (Google Cloud, GitHub Developer Settings, panel
  de Supabase: Site URL, Redirect URLs, Confirm email = on, SMTP).
- **CLAUDE.md** actualizado (bullets de `SupabaseService`/`SessionService`/auth, rutas nuevas,
  cambio de RLS de `scores`).

**Fuera de alcance (para futuros specs):**

- **MFA, magic links, OTP por teléfono, SSO/SAML.**
- **"Mis puntuaciones", perfil público, subida de avatar** a Storage.
- **Guard de toda la app:** solo `/cuenta` queda protegida; jugar y navegar siguen libres.
- **Tabla `profiles`** (el nombre vive en `user_metadata`).
- **Realtime y edge functions.**
- **Cambiar motores, reglas o jugabilidad** de los juegos (solo cambia el flujo de guardado).
- **Internacionalización** (la UI queda en español).

---

## Modelo de datos

**Sesión (en el cliente).** Supabase gestiona `auth.users`, `auth.sessions` y los tokens; el
cliente persiste la sesión en `localStorage` (clave `sb-…-auth-token`, gestionada por
`supabase-js`). La vieja clave `av_user` se retira.

Forma del usuario que expone `SessionService` (derivada del `User` de Supabase):

```ts
// src/app/services/session.service.ts
export interface User {
  id: string;
  name: string; // user_metadata.username, o el nombre del proveedor, o el local-part del email
  email: string | null;
  provider: 'email' | 'google' | 'github';
}
```

**`user_metadata`.** En el registro con email se guarda `{ username }` vía
`signUp({ options: { data: { username } } })`. Para Google/GitHub el nombre sale de los
campos que rellena el proveedor (`full_name` / `name` / `user_name`). El `name` mostrado se
resuelve con esa prioridad y se recorta igual que hoy (mayúsculas, ≤12).

**Tabla `scores` (cambia).** Se añade `user_id` y se endurece la RLS:

```sql
-- vía MCP de Supabase (apply_migration), no versionado en el repo
alter table public.scores
  add column user_id uuid references auth.users(id) default auth.uid();

drop policy scores_insert_public on public.scores;      -- insert anónimo, se elimina
create policy scores_insert_auth on public.scores
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and score >= 0
    and char_length(name) between 1 and 12
  );
-- scores_select_public (SELECT, público) se mantiene.
```

`src/app/database.types.ts` se regenera: `scores.Row/Insert/Update` gana `user_id: string | null`
(`Insert` opcional por el `default`).

**Entorno.** No entran secretos nuevos al cliente: los client secret de Google/GitHub viven
en el panel de Supabase, no en el bundle. `.env-template` y el generador no cambian.

---

## Plan de implementación

Numerado; cada paso deja la app **compilando y navegable** (Angular idiomático: standalone,
signals, control de flujo `@if`/`@for`).

1. **BD + tipos.** Vía MCP de Supabase: `alter table scores add user_id …`; sustituir la
   política de insert anónima por `scores_insert_auth` (rol `authenticated`, `with_check`).
   Regenerar `src/app/database.types.ts`. Prueba: `npm run build` compila; el `select` de
   `scores` sigue respondiendo.
2. **Persistencia SSR-safe.** En `SupabaseService`, elegir las opciones de `auth` con
   `isPlatformBrowser`: navegador = `{ persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }`;
   servidor = los flags actuales. Prueba: la app renderiza bajo SSR sin tocar `window`;
   `supabase.client.auth.getSession()` funciona en navegador.
3. **`SessionService` real.** Reescribir el servicio: signal `user` sembrado con `getSession()`
   y actualizado por `onAuthStateChange` (suscripción solo en navegador); métodos `register`,
   `signIn`, `signInWithOAuth`, `resetPassword`, `updatePassword`, `updateUsername`, `logout`.
   El `nav` sigue mostrando el usuario sin cambios de import. Prueba: iniciar sesión por
   consola refleja el nombre en el nav; recargar mantiene la sesión.
4. **`/acceso` real.** Cablear pestañas a `signIn`/`register` con campos reales (email, pass,
   username en alta), validación mínima, estados de carga/error y el estado "revisa tu correo"
   tras el alta; botones Google/GitHub → `signInWithOAuth`; enlace a `/acceso/recuperar`.
   Retirar `login(name)`/"jugar como invitado" falsos. Prueba: alta real envía correo; login
   de un usuario confirmado entra y redirige a `/`.
5. **`/acceso/callback`.** Componente `AuthCallback` + ruta: finaliza OAuth/confirmación,
   spinner y redirección. Declarar la ruta **antes** de cualquier comodín. Prueba: el login con
   Google/GitHub vuelve a la app ya autenticado.
6. **Recuperación de contraseña.** `/acceso/recuperar` (pide email → `resetPasswordForEmail`)
   y `/acceso/nueva-clave` (sesión recovery → `updatePassword`). Prueba: el correo de reset
   lleva a `/acceso/nueva-clave` y la nueva contraseña funciona.
7. **`/cuenta` + guard.** Componente `Cuenta` (email, proveedor, editar `username`, logout) y
   `authGuard` (`CanActivateFn`) que protege `/cuenta`; enlace en el `nav`. Prueba: sin sesión
   `/cuenta` redirige a `/acceso`; con sesión muestra y edita el nombre.
8. **Guardado restringido en los 5 juegos.** En cada componente de juego, condicionar el
   botón "GUARDAR PUNTUACIÓN": con sesión usa `user_metadata` como nombre; sin sesión muestra
   el CTA "INICIA SESIÓN PARA GUARDAR" → `/acceso`. `ScoresService.save()` omite `user_id`
   (lo pone `auth.uid()`). Prueba: invitado no puede guardar; autenticado guarda y la fila
   lleva su `user_id`.
9. **Tests + docs.** Extender `supabase-mock` con `client.auth`; reescribir
   `session.service.spec.ts`; specs de `Auth`, `Cuenta` y `authGuard`. Comando por archivo
   (`npx ng test --include=… --watch=false`), no la suite completa. Actualizar CLAUDE.md.

> La **configuración del panel** (proveedores OAuth, Site URL, Redirect URLs, Confirm email,
> SMTP) es un **prerrequisito manual** detallado en el apéndice; no es un paso de código, pero
> debe estar hecha para que los pasos 4–6 se verifiquen de extremo a extremo.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores y los specs tocados pasan por archivo
      (`npx ng test --include=… --watch=false`); la suite completa no se corre (riesgo OOM).
- [ ] El registro con email crea el usuario y **envía correo de confirmación**; sin confirmar,
      el login se rechaza con un mensaje legible; tras confirmar, el login entra.
- [ ] Login con email/contraseña válido inicia sesión y redirige a `/`; credenciales malas
      muestran error legible, no excepción en consola.
- [ ] El botón GOOGLE inicia sesión con Google y vuelve autenticado vía `/acceso/callback`.
- [ ] El botón GITHUB inicia sesión con GitHub y vuelve autenticado vía `/acceso/callback`.
- [ ] "¿Olvidaste tu contraseña?" envía el correo de reset; el enlace abre `/acceso/nueva-clave`
      y la nueva contraseña permite iniciar sesión.
- [ ] La sesión **persiste al recargar** y entre pestañas; `logout` la limpia y el `nav` vuelve
      a "Iniciar Sesión".
- [ ] `/cuenta` muestra email y proveedor, edita el `username` (persiste en `user_metadata`) y
      cierra sesión; sin sesión, `/cuenta` redirige a `/acceso`.
- [ ] Un invitado puede jugar los 5 juegos, pero el botón de guardar muestra "INICIA SESIÓN
      PARA GUARDAR"; no se inserta ninguna fila en `scores`.
- [ ] Un usuario autenticado guarda puntuación y la fila de `scores` lleva su `user_id`
      (= `auth.uid()`); el nombre proviene de `user_metadata`.
- [ ] La RLS rechaza cualquier insert en `scores` desde el rol `anon`; el `select` sigue
      público y el Salón de la Fama se muestra igual.
- [ ] La app renderiza bajo SSR sin tocar `window`/`localStorage` en servidor (persistencia y
      `onAuthStateChange` solo en navegador); sin errores en consola al recorrerla.
- [ ] Ningún secreto de proveedor (client secret de Google/GitHub) aparece en `dist/`.
- [ ] El `nav` y los 5 juegos siguen compilando sin cambiar sus imports de `SessionService`.

---

## Decisiones tomadas y descartadas

- **Sí:** reutilizar Supabase Auth (`@supabase/supabase-js`, ya en el proyecto) + RLS. **No:**
  auth propia tras endpoints SSR — Supabase ya resuelve sesión, tokens y OAuth.
- **Sí:** **guardar exige sesión** y `scores` gana `user_id` (`default auth.uid()`, `with_check
  user_id = auth.uid()`). **No:** dejar el insert anónimo — el usuario quiere ligar la marca a
  su dueño y cerrar el insert abierto.
- **Sí:** **confirmación de email** (doble opt-in) con pantalla "revisa tu correo" + callback.
  **No:** alta sin confirmar — decisión explícita del usuario.
- **Sí:** **recuperación de contraseña y página `/cuenta`** en este spec. **No:** diferirlas —
  el usuario las pidió dentro del alcance.
- **Sí:** **nombre en `user_metadata`** (username al registrarse; nombre del proveedor en
  OAuth). **No:** tabla `profiles` con trigger/RLS — innecesaria para el alias y añade esquema.
- **Sí:** **reescribir `SessionService` conservando nombre, archivo y signal `user`**. **No:**
  crear un `AuthService` nuevo y reapuntar 6 consumidores — menos churn manteniendo el nombre.
- **Sí:** **persistencia SSR-safe con `isPlatformBrowser`** sobre el mismo cliente. **No:**
  segundo cliente o storage custom — un solo `SupabaseService`, como fija SPEC 04.
- **Sí:** **flujo PKCE + `detectSessionInUrl` + ruta `/acceso/callback`** dedicada. **No:**
  flujo implícito con token en el hash — PKCE es el recomendado para SPA.
- **Sí:** **configuración del panel como guía paso a paso** (apéndice) + prerrequisito manual.
  **No:** intentarlo por MCP/código — los secretos de proveedor y el Site URL no son
  programables desde aquí.
- **Sí:** **solo `/cuenta` protegida** por guard; jugar sigue libre. **No:** guard global —
  rompería el modo invitado que el usuario quiere conservar.

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| El cliente Supabase con `persistSession: true` toca `localStorage`/`window` en SSR y rompe el render | `isPlatformBrowser` elige los flags; en servidor se mantienen `false`; `onAuthStateChange` solo se suscribe en navegador. |
| OAuth no vuelve a la app (Redirect URL mal configurada) | El apéndice fija los Redirect URLs exactos (incl. `/acceso/callback`) en el panel y en las consolas; criterio de aceptación por proveedor. |
| El correo de confirmación/reset no llega o va a spam (SMTP por defecto de Supabase, con límite de envíos) | El apéndice indica el SMTP por defecto y su límite, y cómo configurar uno propio si hace falta; se prueba con un correo real. |
| El cambio de RLS bloquea el guardado legítimo o deja pasar inserts no deseados | `with_check (user_id = auth.uid() …)` para `authenticated`; pruebas: invitado rechazado, autenticado aceptado con su `user_id`. |
| Fuga de secretos de proveedor al bundle | Los client secret viven solo en el panel de Supabase; criterio: grep en `dist/` no los encuentra. |
| La reescritura de `SessionService` rompe el nav o los 5 juegos | Se conservan el nombre del servicio, el signal `user` y `logout()`; `build` + specs por archivo lo verifican. |
| Tokens de recovery/confirm expiran o se reusan | Mensajes de error legibles y reintento desde `/acceso/recuperar`; no se guardan tokens en estado propio. |

---

## Apéndice — Configuración del panel y las consolas (prerrequisito manual)

Pasos a cargo del usuario, antes de verificar los flujos de extremo a extremo. No son código:
son configuración de infraestructura que no se puede hacer por MCP ni desde el bundle.

1. **Google Cloud Console** (proveedor Google):
   - Crear/usar un proyecto → **APIs & Services → OAuth consent screen** (tipo External,
     datos mínimos de la app).
   - **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
   - En **Authorized redirect URIs** añadir el callback de Supabase:
     `https://<proyecto>.supabase.co/auth/v1/callback`.
   - Copiar el **Client ID** y el **Client Secret**.
2. **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App** (proveedor GitHub):
   - **Homepage URL**: la URL del sitio (p. ej. `http://localhost:4200`).
   - **Authorization callback URL**: `https://<proyecto>.supabase.co/auth/v1/callback`.
   - Generar y copiar **Client ID** y **Client Secret**.
3. **Supabase → Authentication → Providers:**
   - **Email**: activar **Confirm email** (doble opt-in).
   - **Google**: activar y pegar Client ID + Client Secret del paso 1.
   - **GitHub**: activar y pegar Client ID + Client Secret del paso 2.
4. **Supabase → Authentication → URL Configuration:**
   - **Site URL**: `http://localhost:4200` (en producción, la URL real).
   - **Redirect URLs**: añadir `http://localhost:4200/acceso/callback` y
     `http://localhost:4200/acceso/nueva-clave` (y sus equivalentes de producción).
5. **SMTP de correos:** el remitente por defecto de Supabase sirve para pruebas con un
   **límite bajo de envíos**; para producción (o si el correo no llega), configurar un SMTP
   propio en **Authentication → Emails / SMTP**.

---

## Lo que **no** entra en este spec

- MFA, magic links, OTP por teléfono, SSO/SAML.
- "Mis puntuaciones", perfil público, subida de avatar.
- Guard de toda la app (solo `/cuenta`), tabla `profiles`, realtime, edge functions.
- Cambios en motores/reglas/jugabilidad de los juegos (solo el flujo de guardado).
- Internacionalización.

Cada uno, si llega, va en su propio spec.
