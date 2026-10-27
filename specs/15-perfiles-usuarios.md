# SPEC 15 — Tabla de perfiles de usuario sincronizada desde Supabase Auth

> **Estado:** Aprobado
> **Depende de:** SPEC 06 (tabla `scores` y `ScoresService`), SPEC 14 (auth real: `auth.users`, `scores.user_id`, `SessionService`)
> **Fecha:** 2026-10-26
> **Objetivo:** Crear una tabla pública `profiles` sincronizada automáticamente desde `auth.users` por un trigger, para exponer de forma consultable el usuario (email, nombre y proveedor) y poder unirla con `scores` y listar puntuaciones por jugador.

---

## Por qué existe este spec

Supabase Auth guarda los usuarios en `auth.users` (esquema `auth`), con `email`,
`encrypted_password` (hash), el proveedor en `raw_app_meta_data` y el nombre en
`raw_user_meta_data`. Esa tabla **no es visible en el Table Editor del esquema `public`** ni
consultable desde el cliente (RLS la cierra), y PostgREST **no puede unir** `scores` con ella
automáticamente. SPEC 14 decidió a propósito **no** crear una tabla `profiles` (el nombre vive
en `user_metadata`).

Este spec **revierte esa decisión de forma documentada**: añade un espejo `public.profiles`,
sincronizado por un trigger desde `auth.users`, visible y consultable, que se puede unir con
`scores` (por el `user_id` compartido) para listar puntuaciones por jugador —igual que `scores`
se une a `games` por `game_id`—. Es un espejo de lectura: **`user_metadata` sigue mandando** el
nombre y **no cambia nada del flujo de SPEC 14** (SessionService, `/acceso`, `/cuenta`, el
guardado de los 5 juegos).

Decisiones del usuario que acotan el alcance (bloque de preguntas):

1. **`scores` mantiene su FK a `auth.users`**; la unión con `profiles` se hace por el id
   compartido (`profiles.id = scores.user_id`). No se duplica ni repunta la FK de `scores`.
2. **`profiles` es un espejo**; `user_metadata` sigue siendo la fuente de verdad del nombre.
3. **Lectura pública total** de `profiles` (incluye el email). Decisión explícita para este
   proyecto de curso; se anota el riesgo de privacidad.
4. **El trigger sincroniza AFTER INSERT y AFTER UPDATE** de `auth.users` (upsert).
5. **Se implementa en la rama existente `spec-14-autenticacion-supabase`** (no se crea
   `spec-15-…`).

---

## Alcance

**Dentro:**

- **Tabla `public.profiles`** (vía MCP de Supabase, no SQL versionado): un perfil por usuario,
  `id` como PK y FK a `auth.users(id)` con `on delete cascade`. Columnas: `id`, `email`,
  `username`, `provider`, `created_at`, `updated_at`. **Sin columna de contraseña.**
- **RLS de `profiles`:** `select` **público** (rol `anon` + `authenticated`); `update` solo del
  propio dueño (`id = auth.uid()`); **sin** insert/delete desde el cliente (lo hace el trigger).
- **Función + trigger de sincronización:** `public.handle_profile_sync()` (`security definer`,
  `search_path = public`) que hace **upsert** en `profiles`; trigger `on_auth_user_profile`
  **AFTER INSERT OR UPDATE ON `auth.users`**. Resuelve el `username` con la misma prioridad que
  `SessionService.mapUser` (`username` → `full_name` → `name` → `user_name` → local-part del
  email) y el `provider` de `raw_app_meta_data->>'provider'` (por defecto `email`). Guarda el
  valor **crudo** (el formateo a mayúsculas/≤12 sigue siendo cosa de la UI).
- **Vista `public.scores_con_perfil`** (lectura pública): `scores` `LEFT JOIN profiles` por
  `profiles.id = scores.user_id`, exponiendo cada puntuación con `username`/`provider` del autor.
  Es el mecanismo del "join por usuario" sin tocar las FK de `scores`.
- **Tipos:** regenerar `src/app/database.types.ts` (gana `profiles` y la vista).
- **`ScoresService`:** método de lectura `porUsuario(userId)` (puntuaciones de un usuario con su
  perfil unido, leídas de `scores_con_perfil`). Extender `src/app/testing/supabase-mock.ts` para
  cubrirlo. Pasa por `SupabaseService`, como el resto.
- **Tests:** un test por archivo del nuevo método (`scores.service.spec.ts`); se corre con
  `npx ng test --include=… --watch=false`, **no** la suite completa (riesgo OOM).
- **CLAUDE.md** actualizado (nueva tabla `profiles` + trigger + vista; matiza la decisión de
  SPEC 14 de "sin tabla `profiles`").

**Fuera de alcance (para futuros specs):**

- **Hacer `profiles` la fuente de verdad del nombre** (seguiría en `user_metadata`).
- **Cambiar la UI** (Salón de la Fama, Biblioteca, `/cuenta`) para mostrar proveedor/avatar.
- **Avatares / subida a Storage.**
- **Repuntar o duplicar la FK de `scores`** (se mantiene `scores.user_id → auth.users`).
- **Vista sin email o RLS por dueño** (endurecer la privacidad del email) — mejora futura si
  esto va a producción.
- **Realtime, edge functions, internacionalización.**

---

## Modelo de datos

Todo vía **MCP de Supabase** (`apply_migration`), no versionado en el repo. Snippets
ilustrativos:

**Tabla + RLS:**

```sql
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  username   text,
  provider   text,                                   -- 'email' | 'google' | 'github'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
-- Decisión del usuario: lectura pública total (incluye email).
create policy profiles_select_public on public.profiles
  for select to anon, authenticated using (true);
-- El dueño puede actualizar su propio perfil (por si la app escribe directo algún día).
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Sin políticas de insert/delete desde el cliente: lo gestiona el trigger.
```

**Función + trigger (upsert en INSERT y UPDATE):**

```sql
create function public.handle_profile_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, username, provider, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name',     new.raw_user_meta_data->>'user_name',
             split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    now()
  )
  on conflict (id) do update set
    email = excluded.email, username = excluded.username,
    provider = excluded.provider, updated_at = now();
  return new;
end;
$$;
create trigger on_auth_user_profile
  after insert or update on auth.users
  for each row execute function public.handle_profile_sync();
```

**Vista del join por usuario (lectura pública):**

```sql
create view public.scores_con_perfil as
  select s.id, s.game_id, s.name, s.score, s.created_at, s.user_id,
         p.username as perfil_username, p.provider as perfil_provider
  from public.scores s
  left join public.profiles p on p.id = s.user_id;
```

**Tipos.** `src/app/database.types.ts` se regenera: aparece `public.profiles`
(`Row`/`Insert`/`Update`) y la vista `scores_con_perfil` (`Row` de solo lectura).

**Backfill.** El trigger cubre a los usuarios **nuevos** y los cambios. Hoy `auth.users` está
**vacía**, así que no hace falta backfill; si hubiera usuarios previos, se haría un `insert …
select` inicial desde `auth.users` (anotado, no necesario ahora).

**Nombre de la migración sugerido:** `profiles_sync_from_auth_users`.

---

## Plan de implementación

Numerado; cada paso deja la BD/app en estado funcional. Se implementa en la rama existente
**`spec-14-autenticacion-supabase`** (ver Decisiones).

1. **Tabla + RLS.** Crear `public.profiles` y sus políticas (`select` público, `update` propio).
   Prueba: la tabla aparece en el esquema `public`; `select` devuelve vacío sin error.
2. **Función + trigger.** Crear `handle_profile_sync()` y `on_auth_user_profile` (AFTER INSERT
   OR UPDATE). Prueba: crear un usuario de prueba en `auth.users` genera su fila en `profiles`;
   actualizar su `raw_user_meta_data.username` actualiza `profiles.username`; borrarlo elimina
   el perfil (cascade). Limpiar el usuario de prueba al terminar.
3. **Vista.** Crear `public.scores_con_perfil`. Prueba: `select` de la vista une cada score con
   el `username`/`provider` del autor por `user_id = profiles.id`.
4. **Tipos.** Regenerar `src/app/database.types.ts`. Prueba: `npm run build` compila.
5. **`ScoresService.porUsuario(userId)`.** Leer `scores_con_perfil` filtrando por `user_id`;
   devolver score + perfil. Extender `supabase-mock`. Prueba: `npx ng test
   --include=src/app/services/scores.service.spec.ts --watch=false` pasa.
6. **Docs.** Actualizar CLAUDE.md (tabla `profiles`, trigger, vista; matiz sobre SPEC 14).

---

## Criterios de aceptación

- [ ] `public.profiles` existe en el esquema `public` con `id`, `email`, `username`,
      `provider`, `created_at`, `updated_at`; RLS activa.
- [ ] Insertar un usuario en `auth.users` crea automáticamente su fila en `profiles` con el
      mismo `id` (trigger INSERT).
- [ ] Cambiar `raw_user_meta_data.username` (o el email) de un usuario actualiza su fila en
      `profiles` (trigger UPDATE).
- [ ] Borrar un usuario de `auth.users` elimina su perfil (`on delete cascade`).
- [ ] El `select` de `profiles` responde desde el cliente con rol `anon` (lectura pública).
- [ ] La vista `scores_con_perfil` une cada puntuación con el `username`/`provider` de su autor
      por `user_id = profiles.id`.
- [ ] `ScoresService.porUsuario(userId)` devuelve las puntuaciones de ese usuario con su perfil
      unido; su test por archivo pasa.
- [ ] `npm run build` compila sin errores y `database.types.ts` incluye `profiles` y la vista.
- [ ] **No** se añade una segunda FK en `scores` (sigue `scores.user_id → auth.users`).
- [ ] CLAUDE.md documenta la tabla `profiles`, el trigger y la vista.

---

## Decisiones tomadas y descartadas

- **Sí:** `profiles` como **espejo** sincronizado por trigger; `user_metadata` sigue siendo la
  fuente del nombre (cero cambios en SessionService ni en los 5 juegos). **No:** `profiles` como
  fuente de verdad — más acoplamiento con lo que ya funciona de SPEC 14.
- **Sí:** trigger **AFTER INSERT OR UPDATE** con upsert (`on conflict`). **No:** solo INSERT —
  dejaría `profiles` desactualizado al cambiar el nombre/email.
- **Sí:** mantener `scores.user_id → auth.users` y unir por id compartido mediante la **vista**
  `scores_con_perfil`. **No:** repuntar/duplicar la FK de `scores` — innecesario y tocaría la
  RLS que fijó SPEC 14.
- **Sí:** **lectura pública total** de `profiles` (incluye email) — decisión explícita del
  usuario para este proyecto. **No:** vista sin email o RLS por dueño — se ofreció y se descartó
  por simplicidad (anotado como mejora futura si va a producción).
- **Sí:** función **`security definer` con `search_path = public`** y solo upsert en `profiles`.
  **No:** insert/delete de `profiles` desde el cliente — lo gestiona el trigger.
- **Sí:** implementar en la rama existente **`spec-14-autenticacion-supabase`**. **No:** rama
  nueva `spec-15-…` — decisión del usuario.

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| La lectura pública de `profiles` expone el **email** de todos los usuarios al cliente anónimo | Decisión explícita del usuario (proyecto de curso). Para producción: vista sin email o RLS por dueño (anotado, fuera de alcance). |
| Trigger `security definer` mal acotado = escalada de privilegios | `search_path = public` fijado; la función solo hace upsert en `public.profiles`; sin insert/delete desde el cliente. |
| `/spec-impl` crearía la rama `spec-15-…` por `AutoCreateBranch: true` | Al implementar, quedarse en `spec-14-autenticacion-supabase` (declinar la creación / `git checkout` manual). Documentado como decisión. |
| Doble verdad del nombre (`user_metadata` vs `profiles`) si el trigger falla | El trigger AFTER UPDATE mantiene la sincronía; `profiles` es espejo y `user_metadata` manda; se verifica en el criterio de UPDATE. |
| PostgREST no puede embeber `scores`↔`profiles` (no hay FK directa) | La **vista** `scores_con_perfil` resuelve el join a nivel de BD sin añadir FK. |

---

## Lo que **no** entra en este spec

- Hacer `profiles` la fuente de verdad del nombre (sigue en `user_metadata`).
- Cambiar la UI (Salón de la Fama, Biblioteca, `/cuenta`) para mostrar proveedor/avatar.
- Avatares / subida a Storage.
- Repuntar o duplicar la FK de `scores`.
- Endurecer la privacidad del email (vista sin email / RLS por dueño).
- Realtime, edge functions, internacionalización.

Cada uno, si llega, va en su propio spec.
