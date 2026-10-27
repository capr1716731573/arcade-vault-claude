import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../services/session.service';
import { validatePassword } from './password-policy';
@Component({
  selector: 'app-auth',
  imports: [RouterLink],
  templateUrl: './auth.html',
  host: { class: 'av-auth-wrap fade-in' },
})
export class Auth {
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  protected readonly tab = signal<'in' | 'up'>('in');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly username = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sent = signal(false);
  protected readonly resent = signal(false);
  protected setTab(t: 'in' | 'up') {
    this.tab.set(t);
    this.error.set(null);
    this.sent.set(false);
    this.resent.set(false);
  }
  /** Reenvía el correo de confirmación desde la pantalla "revisa tu correo". */
  protected async resend() {
    if (this.loading()) return;
    this.error.set(null);
    this.loading.set(true);
    const r = await this.session.resendConfirmation(this.email().trim());
    this.loading.set(false);
    if (r.ok) this.resent.set(true);
    else this.error.set(this.translate(r.error));
  }
  protected async submit(e: Event) {
    e.preventDefault();
    if (this.loading()) return;
    this.error.set(null);
    const email = this.email().trim();
    const password = this.password();
    if (!email || !password) {
      this.error.set('Introduce correo y contraseña.');
      return;
    }
    this.loading.set(true);
    if (this.tab() === 'in') {
      const r = await this.session.signIn(email, password);
      this.loading.set(false);
      if (r.ok) this.router.navigateByUrl('/');
      else this.error.set(this.translate(r.error));
      return;
    }
    const username = this.username().trim();
    if (!username) {
      this.loading.set(false);
      this.error.set('Elige un nombre de jugador.');
      return;
    }
    const policyError = validatePassword(password);
    if (policyError) {
      this.loading.set(false);
      this.error.set(policyError);
      return;
    }
    const r = await this.session.register(email, password, username);
    this.loading.set(false);
    if (!r.ok) {
      this.error.set(this.translate(r.error));
      return;
    }
    if (r.needsConfirmation) this.sent.set(true);
    else this.router.navigateByUrl('/');
  }
  protected async oauth(provider: 'google' | 'github') {
    if (this.loading()) return;
    this.error.set(null);
    this.loading.set(true);
    const r = await this.session.signInWithOAuth(provider);
    // Con éxito el navegador ya está redirigiendo; solo restauramos si falló.
    if (!r.ok) {
      this.loading.set(false);
      this.error.set(this.translate(r.error));
    }
  }
  /** Traduce los errores más comunes de Supabase a mensajes legibles en español. */
  private translate(msg?: string): string {
    const m = (msg ?? '').toLowerCase();
    if (m.includes('invalid login')) return 'Credenciales inválidas.';
    if (m.includes('email not confirmed')) return 'Debes confirmar tu correo antes de entrar.';
    if (m.includes('already registered') || m.includes('already been registered'))
      return 'Ese correo ya está registrado.';
    if (m.includes('at least 6')) return 'La contraseña debe tener al menos 6 caracteres.';
    if (m.includes('rate limit') || m.includes('security purposes') || m.includes('only request'))
      return 'Espera unos segundos antes de volver a intentarlo.';
    if (m.includes('unable to validate email') || m.includes('invalid email'))
      return 'El correo no es válido.';
    return msg || 'No se pudo completar la operación.';
  }
}
