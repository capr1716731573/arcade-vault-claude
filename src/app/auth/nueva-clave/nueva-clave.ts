import { afterNextRender, Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../services/session.service';
/**
 * Fija una contraseña nueva tras seguir el enlace de recuperación
 * (`/acceso/nueva-clave`). El enlace establece una sesión de recovery
 * (`detectSessionInUrl`); con ella, `updatePassword` cambia la clave.
 */
@Component({
  selector: 'app-nueva-clave',
  imports: [RouterLink],
  templateUrl: './nueva-clave.html',
  host: { class: 'av-auth-wrap fade-in' },
})
export class NuevaClave {
  private readonly session = inject(SessionService);
  protected readonly password = signal('');
  protected readonly password2 = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal(false);
  protected readonly ready = signal(false);
  constructor() {
    // La sesión de recovery deja disponible al usuario: habilita el formulario.
    effect(() => {
      if (this.session.user()) this.ready.set(true);
    });
    afterNextRender(() => {
      const err = this.readError();
      if (err) this.error.set(err);
      // Si no llega sesión de recovery ni error, el enlace no sirve.
      setTimeout(() => {
        if (!this.ready() && !this.error()) {
          this.error.set('El enlace no es válido o ha caducado. Pide uno nuevo.');
        }
      }, 8000);
    });
  }
  protected async submit(e: Event) {
    e.preventDefault();
    if (this.loading() || !this.ready()) return;
    const p = this.password();
    if (p.length < 6) {
      this.error.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (p !== this.password2()) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    const r = await this.session.updatePassword(p);
    this.loading.set(false);
    if (r.ok) this.done.set(true);
    else this.error.set(r.error ?? 'No se pudo actualizar la contraseña.');
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
