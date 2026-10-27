import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Provider, User as SupabaseUser } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
/** Proveedor con el que el usuario inició sesión. */
export type AuthProvider = 'email' | 'google' | 'github';
/** Usuario de sesión tal como lo consume la UI (derivado del usuario de Supabase). */
export interface User {
  id: string;
  name: string;
  email: string | null;
  provider: AuthProvider;
}
/** Resultado genérico de una operación de auth. */
export interface AuthResult {
  ok: boolean;
  error?: string;
}
/** Resultado del alta: `needsConfirmation` indica que falta confirmar el correo. */
export interface RegisterResult extends AuthResult {
  needsConfirmation: boolean;
}
/**
 * Sesión real sobre Supabase Auth (SPEC 14). Reemplaza la maqueta en `localStorage`:
 * ahora `supabase-js` persiste la sesión (clave `sb-…-auth-token`, solo navegador) y
 * este servicio refleja al usuario en el signal `user`.
 *
 * SSR-safe: en servidor `user` es `null` y no se suscribe a nada (toda la lectura de
 * sesión ocurre solo en navegador, decidido con `isPlatformBrowser`).
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly supabase = inject(SupabaseService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();
  constructor() {
    if (!this.isBrowser) return;
    const auth = this.supabase.client.auth;
    // Sembrar el signal con la sesión guardada y mantenerlo vivo con los eventos.
    auth.getSession().then(({ data }) => this._user.set(this.mapUser(data.session?.user ?? null)));
    auth.onAuthStateChange((_event, session) =>
      this._user.set(this.mapUser(session?.user ?? null)),
    );
  }
  /** Alta con email/contraseña. El `username` va a `user_metadata`. */
  async register(email: string, password: string, username: string): Promise<RegisterResult> {
    const { data, error } = await this.supabase.client.auth.signUp({
      email,
      password,
      options: {
        data: { username: username.trim() },
        emailRedirectTo: this.redirect('/acceso/callback'),
      },
    });
    if (error) return { ok: false, needsConfirmation: false, error: error.message };
    // Con "Confirm email" activo no hay sesión hasta confirmar desde el correo.
    return { ok: true, needsConfirmation: !data.session };
  }
  /** Reenvía el correo de confirmación del alta (por si el primero no llegó). */
  async resendConfirmation(email: string): Promise<AuthResult> {
    const { error } = await this.supabase.client.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: this.redirect('/acceso/callback') },
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  /** Inicio de sesión con email/contraseña. */
  async signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  /** Inicio de sesión con un proveedor OAuth (redirige el navegador a `/acceso/callback`). */
  async signInWithOAuth(provider: Exclude<AuthProvider, 'email'>): Promise<AuthResult> {
    const { error } = await this.supabase.client.auth.signInWithOAuth({
      provider: provider as Provider,
      options: { redirectTo: this.redirect('/acceso/callback') },
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  /** Envía el correo de recuperación (vuelve a `/acceso/nueva-clave`). */
  async resetPassword(email: string): Promise<AuthResult> {
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email, {
      redirectTo: this.redirect('/acceso/nueva-clave'),
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  /** Fija una nueva contraseña (requiere sesión, p. ej. en modo recovery). */
  async updatePassword(password: string): Promise<AuthResult> {
    const { error } = await this.supabase.client.auth.updateUser({ password });
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  /** Actualiza el `username` en `user_metadata` y refresca el signal. */
  async updateUsername(username: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.client.auth.updateUser({
      data: { username: username.trim() },
    });
    if (error) return { ok: false, error: error.message };
    this._user.set(this.mapUser(data.user));
    return { ok: true };
  }
  /** Cierra la sesión. */
  async logout(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this._user.set(null);
  }
  /** Resuelve el usuario actual esperando a `getSession()` (para el guard). */
  async getUser(): Promise<User | null> {
    if (!this.isBrowser) return null;
    const { data } = await this.supabase.client.auth.getSession();
    const u = this.mapUser(data.session?.user ?? null);
    this._user.set(u);
    return u;
  }
  /** URL absoluta de retorno (solo navegador; en SSR no aplica). */
  private redirect(path: string): string | undefined {
    return this.isBrowser ? `${window.location.origin}${path}` : undefined;
  }
  /** Convierte el usuario de Supabase en el `User` de la UI. */
  private mapUser(u: SupabaseUser | null): User | null {
    if (!u) return null;
    const meta = u.user_metadata ?? {};
    const raw =
      meta['username'] ||
      meta['full_name'] ||
      meta['name'] ||
      meta['user_name'] ||
      u.email?.split('@')[0] ||
      'PLAYER1';
    const name = String(raw).toUpperCase().slice(0, 12);
    const provider = u.app_metadata?.provider ?? 'email';
    const known: AuthProvider = provider === 'google' || provider === 'github' ? provider : 'email';
    return { id: u.id, name, email: u.email ?? null, provider: known };
  }
}
