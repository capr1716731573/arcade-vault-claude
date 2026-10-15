import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { ContactRequest, ContactResponse } from '../contact/contact.model';

export type { ContactRequest, ContactResponse } from '../contact/contact.model';

/**
 * Fachada sobre `HttpClient` para el formulario de contacto. El componente usa
 * este servicio (no `fetch` ni `HttpClient` directo). Una respuesta 200 emite
 * `{ ok: true }`; los 400/500 llegan por el canal de error del Observable.
 */
@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly http = inject(HttpClient);

  /** POST del formulario al endpoint SSR, relativo a `/api/contacto`. */
  send(payload: ContactRequest): Observable<ContactResponse> {
    return this.http.post<ContactResponse>('/api/contacto', payload);
  }
}
