import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Database } from '../database.types';
/**
 * Cliente Supabase central de la app. Ningún componente crea su propio cliente:
 * todos pasan por este servicio (igual que el resto de servicios fachada).
 *
 * Usa la clave *publishable* (pública, protegida por RLS) de `environment`, que
 * el generador toma de `.env-template`. El secret key / service_role nunca llega
 * al cliente.
 *
 * Sesión (SPEC 14): en el **navegador** se activan `persistSession`,
 * `autoRefreshToken` y `detectSessionInUrl` (flujo PKCE) para que Supabase Auth
 * mantenga la sesión entre recargas y resuelva los retornos de OAuth / enlaces de
 * correo. En **servidor** (SSR) se dejan en `false`: así no se toca
 * `localStorage`/`window` durante el render. La elección se hace con
 * `isPlatformBrowser`.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly client: SupabaseClient<Database> = createClient<Database>(
    environment.supabase.url,
    environment.supabase.key,
    {
      auth: {
        persistSession: this.isBrowser,
        autoRefreshToken: this.isBrowser,
        detectSessionInUrl: this.isBrowser,
        flowType: 'pkce',
      },
    },
  );
}
