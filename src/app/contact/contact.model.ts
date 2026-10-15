/**
 * Contrato del endpoint `POST /api/contacto`, compartido entre el cliente
 * (`ContactService`) y el servidor (`sendContactEmail`). Solo tipos: no
 * introduce código en runtime ni dependencias.
 */

/** Cuerpo que envía el formulario de contacto. */
export interface ContactRequest {
  name: string;
  email: string;
  msg: string;
}

/** Respuesta del endpoint: éxito u error con mensaje. */
export type ContactResponse = { ok: true } | { ok: false; error: string };
