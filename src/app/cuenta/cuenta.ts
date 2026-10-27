import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../services/session.service';
/**
 * Página de cuenta (`/cuenta`, protegida por `authGuard`): muestra correo y
 * proveedor, permite editar el nombre (`user_metadata.username`) y cerrar sesión.
 */
@Component({
  selector: 'app-cuenta',
  templateUrl: './cuenta.html',
  host: { class: 'av-auth-wrap fade-in' },
})
export class Cuenta {
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);
  protected readonly name = signal(this.session.user()?.name ?? '');
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly providerLabel: Record<string, string> = {
    email: 'Correo electrónico',
    google: 'Google',
    github: 'GitHub',
  };
  protected async save(e: Event) {
    e.preventDefault();
    if (this.saving()) return;
    const n = this.name().trim();
    if (!n) {
      this.error.set('El nombre no puede estar vacío.');
      return;
    }
    this.error.set(null);
    this.saved.set(false);
    this.saving.set(true);
    const r = await this.session.updateUsername(n);
    this.saving.set(false);
    if (r.ok) {
      this.saved.set(true);
      this.name.set(this.session.user()?.name ?? n);
    } else this.error.set(r.error ?? 'No se pudo guardar.');
  }
  protected async logout() {
    await this.session.logout();
    this.router.navigateByUrl('/');
  }
}
