import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // Las pantallas renderizan en el cliente (SPA): el servidor SSR existe
    // para el endpoint POST /api/contacto; evita prerender de rutas con
    // parámetros (juego/:id, jugar/:id) y el acceso a localStorage/window
    // en el servidor.
    path: '**',
    renderMode: RenderMode.Client,
  },
];
