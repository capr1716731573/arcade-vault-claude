import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../services/session.service';
/**
 * Solicitud de recuperación de contraseña (`/acceso/recuperar`). Envía el correo
 * de reset de Supabase, que vuelve a `/acceso/nueva-clave`.
 */
@Component({
  selector: 'app-recuperar',
  imports: [RouterLink],
  templateUrl: './recuperar.html',
  host: { class: 'av-auth-wrap fade-in' },
})
export class Recuperar {
  private readonly session = inject(SessionService);
  protected readonly email = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sent = signal(false);
  protected async submit(e: Event) {
    e.preventDefault();
    if (this.loading()) return;
    const email = this.email().trim();
    if (!email) {
      this.error.set('Introduce tu correo.');
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    const r = await this.session.resetPassword(email);
    this.loading.set(false);
    if (r.ok) this.sent.set(true);
    else this.error.set(r.error ?? 'No se pudo enviar el correo.');
  }
}
