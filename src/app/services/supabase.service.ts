import { Injectable } from '@angular/core';
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
 * SSR-safe: `persistSession: false` + `autoRefreshToken: false` +
 * `detectSessionInUrl: false` evitan tocar `localStorage`/`window` durante el
 * render en servidor. La persistencia de sesión la activará el futuro spec de auth.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient<Database> = createClient<Database>(
    environment.supabase.url,
    environment.supabase.key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
