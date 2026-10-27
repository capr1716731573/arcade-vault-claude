import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';
/**
 * Protege rutas que exigen sesión (p. ej. `/cuenta`). Si no hay usuario,
 * redirige a `/acceso`. Espera a `getUser()` para no rechazar por la carga
 * asíncrona inicial de la sesión.
 */
export const authGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);
  const user = session.user() ?? (await session.getUser());
  return user ? true : router.createUrlTree(['/acceso']);
};
