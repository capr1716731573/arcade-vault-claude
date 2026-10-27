import { afterNextRender, Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../../services/session.service';
/**
 * Ruta de retorno de OAuth y de la confirmación de correo (`/acceso/callback`).
 * Con `detectSessionInUrl` + PKCE, `supabase-js` intercambia el `code` de la URL
 * por una sesión al cargar; aquí solo esperamos a que el usuario quede disponible
 * y redirigimos, o mostramos el error que devuelva el proveedor.
 */
@Component({
  selector: 'app-auth-callback',
  imports: [RouterLink],
  templateUrl: './callback.html',
  host: { class: 'av-auth-wrap fade-in' },
})
export class AuthCallback {
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  protected readonly error = signal<string | null>(null);
  constructor() {
    // En cuanto la sesión esté lista, ir a la biblioteca.
    effect(() => {
      if (this.session.user()) this.router.navigateByUrl('/');
    });
    afterNextRender(() => {
      const err = this.readError();
      if (err) {
        this.error.set(err);
        return;
      }
      // Salvaguarda: si tras unos segundos no hubo sesión ni error, volver al acceso.
      setTimeout(() => {
        if (!this.session.user() && !this.error()) this.router.navigateByUrl('/acceso');
      }, 8000);
    });
  }
  /** Lee `error`/`error_description` del query o del hash de retorno. */
  private readError(): string | null {
    const q = new URLSearchParams(window.location.search);
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const desc = q.get('error_description') ?? h.get('error_description');
    const code = q.get('error') ?? h.get('error');
    if (desc) return desc.replace(/\+/g, ' ');
    return code;
  }
}
