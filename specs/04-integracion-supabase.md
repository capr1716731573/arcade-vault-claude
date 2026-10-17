# SPEC 04 — Integración de Supabase (cimientos)

> **Estado:** Implementado
> **Depende de:** SPEC 03 (servidor SSR y `.env-template` cargado con `process.loadEnvFile`), SPEC 01 (convención de servicios fachada en `src/app/services/`)
> **Fecha:** 2026-10-15
> **Objetivo:** Integrar `@supabase/supabase-js` como cliente directo + RLS mediante un `SupabaseService` central configurado desde `.env-template`, sin añadir aún autenticación, tablas ni UI.

---

## Alcance

**Dentro:**

- Dependencia `@supabase/supabase-js` en `package.json`.
- Añadir `SUPABASE_URL` y `SUPABASE_KEY` (clave **publishable**, pública) a `.env-template`, y **reservar** `SUPABASE_SECRET_KEY` (clave **secreta** / `service_role`, server-only, declarada pero **sin usar** en este spec). `SUPABASE_DB_PASSWORD` (ya presente) también es server-only; ni el secret key ni el DB password los usa el cliente.
- Script `scripts/generate-environment.mjs` que lee `.env-template` con `process.loadEnvFile` y genera `src/environments/environment.ts` (gitignored) con `{ supabase: { url, key } }`. Hooks npm `postinstall`/`prestart`/`prebuild`/`prewatch` lo ejecutan.
- `SupabaseService` (`providedIn: 'root'`, en `src/app/services/`) que crea el cliente con `createClient(url, key, …)` leyendo de `environment` y lo expone como `client`. SSR-safe (`persistSession:false`, sin tocar `localStorage`/`window`).
- Smoke test Vitest de `SupabaseService` con `createClient` mockeado.
- Verificación de conectividad manual en dev (una petición trivial responde sin 401) y de que los secretos server-only no entran en `dist/`.

**Fuera de alcance (para futuros specs):**

- **Autenticación** (registro/login/logout/sesión): spec propio. Hoy sigue `SessionService` + `localStorage` (`av_user`).
- **Puntuaciones reales** (tabla `scores`, guardar partidas, Salón de la Fama desde BD): spec propio. Hoy siguen `seededScores` + `av_scores`.
- **Realtime** y **edge functions**.
- Crear tablas, esquema o políticas **RLS** (no hay tablas todavía).
- **Tipado** del cliente (`database.types.ts`, `createClient<Database>`): se añade con la primera tabla.
- Cualquier **cambio de UI** o indicador visual de "conectado".
- Migrar config a `ng generate environments` con `fileReplacements` dev/prod.

## Modelo de datos

No introduce datos persistentes ni tablas en Supabase (el esquema `public` está vacío y así se queda). Introduce **configuración de entorno** y un **servicio cliente**.

Variables en `.env-template` (raíz, ya gitignored):

```
API_KEY_RESEND=...            # (ya existe) server-only, Resend
SUPABASE_DB_PASSWORD=...      # (ya existe) server-only: migraciones / CLI; NUNCA en el cliente
SUPABASE_URL=https://hjkidtirzhekbyyeiupr.supabase.co   # público (va al cliente)
SUPABASE_KEY=sb_publishable_...                          # publishable (público), protegido por RLS; va al cliente
SUPABASE_SECRET_KEY=sb_secret_...                        # secreta (service_role): server-only, salta RLS; RESERVADA, sin usar aún; NUNCA al cliente
```

Archivo generado (gitignored), escrito por el script:

```ts
// src/environments/environment.ts  — GENERADO, no editar a mano
export const environment = {
  supabase: { url: '…', key: '…' },
};
```

Servicio:

```ts
// src/app/services/supabase.service.ts  (providedIn: 'root')
// readonly client: SupabaseClient
//   createClient(environment.supabase.url, environment.supabase.key, {
//     auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
//   })
```

Convenciones: el cliente directo usa la clave **publishable** (`sb_publishable_…`), no la legacy `anon`; ningún componente crea su propio cliente (todo pasa por `SupabaseService`, igual que el resto de servicios fachada); el `SUPABASE_SECRET_KEY` y el `SUPABASE_DB_PASSWORD` nunca se leen desde código de cliente ni entran en el bundle (el generador lee **solo** url + publishable key).

## Plan de implementación

1. **Dependencia.** `npm i @supabase/supabase-js`. Prueba: `npm run build` sigue compilando.
2. **Config en `.env-template`.** Añadir `SUPABASE_URL` y `SUPABASE_KEY` (publishable) con los valores reales del proyecto; declarar `SUPABASE_SECRET_KEY` (secreta / `service_role`) como variable reservada server-only — su valor lo pega el usuario desde el panel de Supabase, no se obtiene por MCP; comentar que `SUPABASE_SECRET_KEY` y `SUPABASE_DB_PASSWORD` son server-only. Prueba: el archivo sigue sin trackear (ya está en `.gitignore`).
3. **Generador de entorno.** Crear `scripts/generate-environment.mjs`: `process.loadEnvFile('.env-template')` en try/catch (si falta, avisar y escribir placeholders vacíos para que el build no rompa), `mkdirSync('src/environments', { recursive:true })` y `writeFileSync` del `environment.ts`. Añadir a `package.json` los hooks `postinstall`, `prestart`, `prebuild`, `prewatch` → `node scripts/generate-environment.mjs`. Añadir `/src/environments/environment.ts` a `.gitignore`. Prueba: ejecutar el script genera el archivo con la url+key; borrando `.env-template` genera placeholders y avisa.
4. **SupabaseService.** Crear `src/app/services/supabase.service.ts` (`providedIn:'root'`) que importa `environment`, crea el cliente con `persistSession:false, autoRefreshToken:false, detectSessionInUrl:false` y expone `client`. Prueba: inyectable en un componente; smoke manual en dev (`supabase.client.auth.getSession()` o `supabase.client.from('_x_').select('*').limit(1)`) responde sin 401 (clave aceptada).
5. **Test.** `src/app/services/supabase.service.spec.ts` con `createClient` mockeado (`vi.mock('@supabase/supabase-js')`): verifica que se pasa `environment.supabase.url`/`.key` y que el servicio expone `client`. Ejecutar `npx ng test --watch=false`.
6. **Verificación y docs.** `npm run build`; comprobar en `dist/` que **no** aparecen `SUPABASE_DB_PASSWORD` ni `API_KEY_RESEND` (la publishable key sí puede aparecer, es pública). Actualizar CLAUDE.md (sección de arquitectura: integración Supabase cliente-directo + RLS, `SupabaseService`, generador de env desde `.env-template`).

Cada paso deja la app compilando y navegable.

## Criterios de aceptación

- [ ] `npm run build` y `npx ng test --watch=false` terminan sin errores.
- [ ] `@supabase/supabase-js` está en `dependencies` de `package.json`.
- [ ] `.env-template` contiene `SUPABASE_URL`, `SUPABASE_KEY` (publishable) y `SUPABASE_SECRET_KEY` (secreta, reservada server-only) además de las claves previas; `SUPABASE_SECRET_KEY` y `SUPABASE_DB_PASSWORD` no se usan en el cliente.
- [ ] `node scripts/generate-environment.mjs` genera `src/environments/environment.ts` con `supabase.url` y `supabase.key` tomados de `.env-template` (lee **solo** esas dos variables, nunca `SUPABASE_SECRET_KEY` ni `SUPABASE_DB_PASSWORD`); sin `.env-template` genera placeholders vacíos y avisa sin romper el build.
- [ ] `src/environments/environment.ts` está en `.gitignore` y no queda trackeado; los hooks `postinstall`/`prestart`/`prebuild`/`prewatch` lo regeneran.
- [ ] `SupabaseService` es inyectable (`providedIn:'root'`) y expone un `SupabaseClient` creado con la url y la publishable key de `environment`.
- [ ] El cliente se crea con `persistSession:false` (no toca `localStorage`/`window`) y la app renderiza bajo SSR sin errores.
- [ ] Una petición trivial al proyecto (`auth.getSession()` o un `select` a una tabla inexistente) responde sin error 401, confirmando conectividad y clave válida.
- [ ] En `dist/` **no** aparecen el valor de `SUPABASE_SECRET_KEY`, `SUPABASE_DB_PASSWORD` ni `API_KEY_RESEND`.
- [ ] No se añade auth, tablas, RLS, realtime, edge functions ni cambios de UI.
- [ ] `supabase.service.spec.ts` verifica (con `createClient` mockeado) que se pasan la url y la key de `environment`.
- [ ] No hay errores en la consola del navegador al recorrer la app.

## Decisiones tomadas y descartadas

- **Sí:** cliente directo (`@supabase/supabase-js`) + RLS. Patrón idiomático de Supabase; la publishable key es pública por diseño y la seguridad la da RLS; necesario para que el futuro spec de Auth gestione la sesión en el navegador. **No:** envolver Supabase tras endpoints SSR `/api/*` como Resend — innecesario para claves públicas y estorba al manejo de sesión en cliente.
- **Sí:** URL + publishable key en `.env-template` (fuente única de config) y un **script prebuild** que genera `src/environments/environment.ts` (gitignored). Mantiene el cliente síncrono y `.env-template` como única fuente. **No:** `environment.ts` commiteado con las claves (más simple, pero el usuario quiere una sola fuente de secretos). **No:** `TransferState` vía SSR — las rutas usan `RenderMode.Client`, el servidor no renderiza y no habría estado que transferir. **No:** endpoint `GET /api/config` — vuelve asíncrona la inicialización del cliente y añade un round-trip.
- **Sí:** clave **publishable** (`sb_publishable_…`), recomendada y rotable de forma independiente, sobre la `anon` legacy JWT.
- **Sí:** reservar `SUPABASE_SECRET_KEY` (clave secreta / `service_role`) en `.env-template` como variable **server-only sin usar** todavía, lista para las futuras edge functions / endpoints que deban saltar RLS. El generador no la lee, así que nunca llega al cliente. **No:** usar el secret key en el navegador — salta RLS y daría acceso total a la BD.
- **Sí:** cliente **sin tipar** ahora; `database.types.ts` + `createClient<Database>` se difieren al spec de puntuaciones, cuando exista una tabla que tipar.
- **Sí:** `persistSession:false, autoRefreshToken:false, detectSessionInUrl:false` mientras no haya auth → cliente SSR-safe. El spec de Auth activará la persistencia de sesión.
- **Sí:** `SUPABASE_DB_PASSWORD` se queda como secreto server-only (migraciones/CLI); el generador lee solo url+key, así nunca entra en el bundle.
- **No:** `ng generate environments` con `fileReplacements` dev/prod; se usa un único `environment.ts` generado, más simple para esta config.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| `environment.ts` gitignored → ausente en clon nuevo / CI / IDE y rompe el build | Hooks `postinstall` + `prestart`/`prebuild`/`prewatch` lo generan; si falta `.env-template`, el script escribe placeholders vacíos y avisa, así el build compila. |
| `process.loadEnvFile` no existe en Node antiguo | Requiere Node ≥ 20.12 (ya exigido por Angular 22 y usado en `src/server.ts`); try/catch con mensaje claro. |
| El cliente Supabase toca APIs solo-navegador durante SSR y rompe el render | `persistSession:false, autoRefreshToken:false, detectSessionInUrl:false`; no se toca `localStorage`/`window` en este spec. |
| Fuga de secretos reales (secret key, DB password, Resend key) al bundle del cliente | El generador lee **solo** `SUPABASE_URL`/`SUPABASE_KEY`; `SUPABASE_SECRET_KEY` y `SUPABASE_DB_PASSWORD` se quedan en `process.env` (server-only); criterio de aceptación: grep en `dist/` confirma su ausencia. |
| Uso de la clave equivocada (legacy vs publishable, o secreta) | Comentar en `.env-template` que `SUPABASE_KEY` es la publishable (cliente) y `SUPABASE_SECRET_KEY` la secreta (server-only); nunca usar la secreta en el cliente. |

## Lo que **no** entra en este spec

- Autenticación (registro/login/logout/sesión) — su propio spec.
- Puntuaciones reales, tabla `scores` y RLS — su propio spec.
- Realtime y edge functions — specs futuros.
- Tipado del cliente (`database.types.ts`) — con la primera tabla.
- Cualquier cambio de UI.

Cada uno, si llega, va en su propio spec.
