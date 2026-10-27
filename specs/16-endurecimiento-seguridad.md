# SPEC 16 — Endurecimiento de seguridad (RLS, Auth, headers y guards)

> **Estado:** Implementado
> **Depende de:** SPEC 04 (SupabaseService), SPEC 06 (RLS de `games`/`scores`), SPEC 14 (auth real: `authGuard`, `/acceso`, `/acceso/nueva-clave`, `SessionService`), SPEC 15 (función `SECURITY DEFINER` de sincronización — contexto de funciones definer)
> **Fecha:** 2026-10-27
> **Objetivo:** Aplicar el checklist de seguridad del proyecto: verificar RLS, endurecer la política de contraseñas y el anti-bot en Supabase Auth, añadir headers de seguridad en el servidor Express, cerrar la función `SECURITY DEFINER` expuesta por RPC y añadir guards de navegación en Angular.

---

## Por qué existe este spec

Tras SPEC 14 (auth real) y SPEC 06/15 (catálogo, scores y perfiles con lectura pública), la app
necesita una pasada base de endurecimiento. La fuente es `references/security/security-checklist.md`.
El checklist trae un ejemplo de headers en **Next.js que no aplica**: "Arcade Vault" es Angular con
SSR servido por **Express** (`src/server.ts`, `outputMode: server`), sin host estático, así que los
headers se añaden como **middleware Express** (un punto para SSR + assets).

Estado real verificado antes de redactar:

- **RLS ya habilitada** en `games`, `scores` y `profiles` (`list_tables`). El ítem 1 del checklist
  ya está satisfecho; aquí solo se verifica y documenta.
- `get_advisors(security)`: leaked-password desactivado (el usuario ya lo activó en el panel) +
  `public.rls_auto_enable()` es `SECURITY DEFINER` ejecutable por `anon`/`authenticated` vía
  `/rest/v1/rpc/rls_auto_enable`. Sin errores de nivel ERROR.
- La config de Auth (longitud/complejidad de contraseña, leaked-password, rate limit) **no es
  programable por MCP**: va en el panel → apéndice manual (como SPEC 14).

Decisiones del usuario que acotan el alcance (dos bloques de preguntas):

1. **Headers:** los 3 del checklist (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`)
   más HSTS, `Permissions-Policy` y `X-DNS-Prefetch-Control`. **CSP se difiere** a otro spec.
2. **Anti-bot:** solo **rate limit del panel** (sin CAPTCHA).
3. **Contraseña:** panel + **validación en cliente** con regex (≥8 + minúscula + MAYÚSCULA + dígito +
   símbolo), en **alta y reset**. Espeja el requisito "Lowercase, uppercase letters, digits and
   symbols" del panel.
4. **`rls_auto_enable()`:** **revocar EXECUTE** (anon/authenticated/public).
5. **Guards:** nuevo **guest-guard** en `/acceso` y subrutas (redirige autenticados → `/cuenta`);
   se mantiene `authGuard` en `/cuenta` y el **modo invitado** (jugar sigue libre, sin gate global).

---

## Alcance

**Dentro:**

- **Headers de seguridad (código, `src/server.ts`):** middleware Express registrado **antes** de
  `express.static` y del handler SSR, que fija en toda respuesta:
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Strict-Transport-Security: max-age=31536000; includeSubDomains`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-DNS-Prefetch-Control: off`.
- **Guard de navegación (Angular):** nuevo `guestGuard` (`CanActivateFn`) en
  `src/app/services/auth.guard.ts` que, si hay usuario, redirige a `/cuenta`; si no, deja pasar.
  Se cablea en `src/app/app.routes.ts` con `canActivate: [guestGuard]` en `/acceso`,
  `/acceso/recuperar` y `/acceso/nueva-clave`. **`/acceso/callback` queda sin guard** (finaliza la
  sesión). Se mantiene `authGuard` en `/cuenta`.
- **Política de contraseña en cliente (código):** validador reutilizable (regex ≥8 + minúscula +
  MAYÚSCULA + dígito + símbolo) con mensaje legible de requisitos, aplicado en el **alta** de
  `src/app/auth/auth.ts` y en `src/app/auth/nueva-clave/nueva-clave.ts`; bloquea el submit **antes**
  de llamar a Supabase. Espeja el requisito del panel.
- **BD (vía MCP de Supabase, no versionado):** `revoke execute on function public.rls_auto_enable()
  from anon, authenticated, public;` para cerrar las 2 advertencias del advisor. **Sin cambios de
  esquema**; `src/app/database.types.ts` **no** se regenera.
- **Verificación de RLS:** confirmar y documentar `rls_enabled = true` en `games`, `scores` y
  `profiles` (ya lo está; sin migración).
- **Apéndice de configuración del panel (prerrequisito manual):** min length = 8; password
  requirements = lowercase+uppercase+digits+symbols; leaked-password protection = ON
  (HaveIBeenPwned, requiere plan Pro); rate limit de signups por hora/IP en Auth → Rate Limits.
  Re-ejecutar `get_advisors(security)` y confirmar que no quedan los lints abordados.
- **Tests:** specs por archivo de `guestGuard` y del validador de contraseña (usando el stub
  `client.auth` de `src/app/testing/supabase-mock.ts`). Comando por archivo
  (`npx ng test --include=… --watch=false`), **no** la suite completa (riesgo OOM). Los headers se
  verifican **a mano** (`curl -I`), sin test de servidor Express.
- **CLAUDE.md** actualizado (bullet de seguridad: headers en `server.ts`, `guestGuard`, política de
  contraseña, revoke de `rls_auto_enable`, estado del checklist).

**Fuera de alcance (para futuros specs):**

- **Content-Security-Policy (CSP):** requiere afinar estilos inline/SSR + nonces; su propio spec.
- **CAPTCHA** (hCaptcha/Turnstile) en `/acceso`: descartado; solo rate limit del panel.
- **Gate global / exigir login para jugar:** se conserva el modo invitado de SPEC 14.
- **Recovery-guard estricto** en `/acceso/nueva-clave` (solo sesión `PASSWORD_RECOVERY`): el
  guest-guard ya cubre al usuario logueado; el enlace de recovery lo valida Supabase.
- **Privacidad del email en `profiles`/vista** (vista sin email o RLS por dueño): sigue anotado
  desde SPEC 15.
- **MFA/2FA, WAF, rotación de claves, pentest.**
- **Advisors de rendimiento** (este spec es solo seguridad) y **versionar las migraciones** en el
  repo (se siguen aplicando por MCP).

---

## Modelo de datos

**No introduce estructuras de datos nuevas ni cambia el esquema** (solo revoca un permiso de
ejecución). `src/app/database.types.ts` **no** se regenera.

Snippets ilustrativos (no código final):

```sql
-- vía MCP de Supabase, no versionado en el repo
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
```

```ts
// Política de contraseña espejo del panel: ≥8 + minúscula + MAYÚSCULA + dígito + símbolo
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
```

```ts
// Headers fijados por el middleware de src/server.ts
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-DNS-Prefetch-Control': 'off',
};
```

---

## Plan de implementación

Numerado; cada paso deja la app **compilando y navegable**. Angular idiomático (standalone, signals,
`@if`/`@for`). La config del panel (apéndice) es prerrequisito manual.

1. **BD — cerrar la función `SECURITY DEFINER`.** Vía MCP: `revoke execute on function
   public.rls_auto_enable() from anon, authenticated, public`. Prueba: `get_advisors(security)` ya no
   lista `rls_auto_enable` en los lints `anon_security_definer_function_executable` ni
   `authenticated_security_definer_function_executable`; la app sigue funcionando (nada la invoca por RPC).
2. **Verificar RLS.** Confirmar `rls_enabled = true` en `games`, `scores`, `profiles` (ya lo está; sin
   cambios). Prueba: `list_tables` lo muestra; el Salón de la Fama sigue leyendo `scores`.
3. **Headers en el servidor.** En `src/server.ts`, añadir `app.use((req, res, next) => { … })` que fije
   los 6 headers, **antes** de `express.static` y del handler SSR. Prueba: `npm run build` +
   `node dist/05-arcade/server/server.mjs`; `curl -I http://localhost:4000/` muestra los 6 headers tanto
   en el HTML SSR como en un asset estático.
4. **`guestGuard` + rutas.** Añadir `guestGuard` en `src/app/services/auth.guard.ts` (patrón de
   `authGuard`: espera `getUser()`; si HAY usuario → `router.createUrlTree(['/cuenta'])`, si no → `true`).
   Cablear `canActivate: [guestGuard]` en `/acceso`, `/acceso/recuperar`, `/acceso/nueva-clave` en
   `app.routes.ts` (callback intacto). Prueba: autenticado que va a `/acceso` es redirigido a `/cuenta`;
   invitado entra normalmente.
5. **Política de contraseña en cliente.** Crear un validador reutilizable (`PASSWORD_RE` + mensaje
   legible) y aplicarlo en el alta de `src/app/auth/auth.ts` y en `src/app/auth/nueva-clave/nueva-clave.ts`:
   bloquear submit y mostrar qué falta, antes de llamar a Supabase. Prueba: `abc` se rechaza en cliente
   con mensaje; `Abcdef1!` pasa y llega a Supabase.
6. **Tests.** Spec por archivo de `guestGuard` (redirige autenticado, deja pasar invitado) y del
   validador de contraseña (casos válidos/inválidos). Comando por archivo
   (`npx ng test --include=… --watch=false`), no la suite completa. Prueba: ambos specs pasan.
7. **Docs.** Actualizar CLAUDE.md (bullet de seguridad) y marcar el checklist. Prueba: CLAUDE.md
   refleja headers/`guestGuard`/política/revoke.

> El **apéndice** (min length, requirements, leaked-password, rate limit) es prerrequisito manual; la
> captura del usuario confirma min length = 8, requirements y leaked-password ya puestos. Falta
> confirmar el rate limit de signups.

---

## Criterios de aceptación

- [ ] `get_advisors(security)` ya no reporta `rls_auto_enable` en `anon_security_definer_function_executable`
      ni en `authenticated_security_definer_function_executable`.
- [ ] `list_tables` confirma `rls_enabled = true` en `games`, `scores` y `profiles`.
- [ ] `curl -I` sobre una página SSR y sobre un asset estático devuelve los 6 headers con los valores
      exactos de la sección Modelo de datos.
- [ ] Un usuario autenticado que navega a `/acceso`, `/acceso/recuperar` o `/acceso/nueva-clave` es
      redirigido a `/cuenta`; un invitado accede normalmente.
- [ ] `/acceso/callback` sigue accesible para cualquiera (finaliza la sesión); no lleva `guestGuard`.
- [ ] `/cuenta` sigue protegida por `authGuard` (invitado → `/acceso`).
- [ ] El alta de `/acceso` rechaza en cliente una contraseña que no cumpla ≥8 + minúscula + MAYÚSCULA +
      dígito + símbolo, con mensaje legible, y no llama a Supabase.
- [ ] `/acceso/nueva-clave` aplica la misma validación antes de `updatePassword`.
- [ ] En el panel: min length = 8, requirements = lowercase+uppercase+digits+symbols, leaked-password
      protection = ON y un rate limit de signups configurado (apéndice; verificado en el panel).
- [ ] `npm run build` compila sin errores; los specs de `guestGuard` y del validador pasan por archivo
      (no se corre la suite completa).
- [ ] Jugar los 5 juegos y el guardado de puntuación siguen igual (modo invitado intacto; sin cambios de motor).
- [ ] CLAUDE.md documenta headers, `guestGuard`, política de contraseña y el revoke de `rls_auto_enable`.

---

## Decisiones tomadas y descartadas

- **Sí:** headers en middleware Express (`src/server.ts`), un punto para SSR + assets. **No:** config de
  host estático (`_headers`/`netlify.toml`) — no hay host estático; el app es `outputMode: server`. **No:**
  adaptar el ejemplo Next.js del checklist — no hay Next.js.
- **Sí:** 3 headers del checklist + HSTS + `Permissions-Policy` + `X-DNS-Prefetch-Control`. **No:** CSP
  ahora — rompe estilos inline/SSR sin afinar nonces; va a su propio spec.
- **Sí:** anti-bot = rate limit del panel. **No:** CAPTCHA — evita proveedor externo + widget en `/acceso`
  para un proyecto de curso.
- **Sí:** validación de contraseña en cliente (regex) en alta **y** reset, espejo del panel. **No:** solo
  panel — el usuario quiere feedback inmediato y complejidad explícita.
- **Sí:** `guestGuard` en `/acceso` y subrutas + mantener `authGuard` en `/cuenta`. **No:** gate global /
  login para jugar — rompería el modo invitado de SPEC 14. **No:** recovery-guard estricto en
  `/acceso/nueva-clave` — el guest-guard ya cubre al usuario logueado; el enlace de recovery lo valida Supabase.
- **Sí:** **revocar EXECUTE** de `rls_auto_enable` (anon/authenticated/public). **No:** `DROP` — reversible
  y no se confirma qué proceso privilegiado la usa; el revoke cierra el warning sin borrar.
- **Sí:** permisos/migraciones por MCP, no versionados — coherente con el proyecto. **No:** SQL versionado en el repo.
- **Sí:** verificación de headers manual (`curl -I`). **No:** test de servidor Express — el stack de tests es
  de componentes Angular (Vitest/jsdom) y la suite completa da OOM.

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| `X-Frame-Options: DENY` u otros headers rompen el flujo OAuth o algún embed | OAuth usa navegación top-level (no iframe) y la app no se embebe; se verifica login Google/GitHub tras añadir headers. |
| HSTS cacheado fuerza HTTPS donde no hay TLS (pruebas locales) | `localhost` está exento de HSTS en navegadores; en prod el sitio ya sirve HTTPS; `includeSubDomains` sin `preload`. |
| Revocar EXECUTE rompe algo que invoca `rls_auto_enable` por RPC | La app no la llama (solo `GamesService`/`ScoresService` hacen reads/inserts de tabla); el revoke no afecta a `service_role`; reversible con `grant`. |
| La regex de contraseña diverge del requisito real del panel | Se fija la misma regla (≥8 + 4 clases) que la captura; Supabase es la fuente de verdad y rechaza en servidor si difiere. |
| `guestGuard` atrapa `/acceso/callback` y rompe confirmación/OAuth | `/acceso/callback` **no** lleva `guestGuard` (criterio de aceptación explícito). |
| `getUser()` asíncrono retrasa la decisión del guard | Mismo patrón ya probado en `authGuard` (espera `getUser()`); redirección en cuanto resuelve. |

---

## Apéndice — Configuración del panel (prerrequisito manual)

A cargo del usuario; no es código (no programable por MCP). La captura del usuario confirma los tres
primeros ya puestos.

1. **Auth → Providers → Email / Password security:**
   - Minimum password length = **8**.
   - Password requirements = **Lowercase, uppercase letters, digits and symbols**.
   - Prevent use of leaked passwords = **ON** (HaveIBeenPwned; requiere plan **Pro**).
2. **Auth → Rate Limits:** fijar un límite razonable de **signups por hora** (anti-bot) y anotar el valor.
3. Tras los cambios de BD, re-ejecutar `get_advisors(security)` y confirmar que no quedan los lints abordados.

---

## Lo que **no** entra en este spec

- CSP, CAPTCHA, gate global / login para jugar, recovery-guard estricto.
- Privacidad del email en `profiles`/vista.
- MFA/2FA, WAF, rotación de claves, pentest.
- Advisors de rendimiento; versionar migraciones en el repo.

Cada uno, si llega, va en su propio spec.
