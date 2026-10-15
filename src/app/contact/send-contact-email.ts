import type { ContactRequest, ContactResponse } from './contact.model';

/**
 * Forma mínima del cliente Resend que usa esta función. Se define aquí (en
 * lugar de importar `Resend`) para poder inyectar un cliente falso en los
 * tests sin tocar la red ni depender del SDK en este módulo.
 */
export interface ResendLike {
  emails: {
    send(payload: {
      from: string;
      to: string;
      replyTo: string;
      subject: string;
      html: string;
      text: string;
    }): Promise<{ data: unknown; error: unknown }>;
  };
}

/** Dependencias inyectadas al handler (cliente Resend y destinatario). */
export interface SendContactDeps {
  /** Cliente Resend, o `null` cuando no hay `API_KEY_RESEND` configurada. */
  resend: ResendLike | null;
  /** Destinatario del aviso (`CONTACT_TO` o el fallback del servidor). */
  to: string;
}

/** Resultado listo para mapear a una respuesta HTTP. */
export interface ContactResult {
  status: number;
  body: ContactResponse;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Escapa el contenido del visitante antes de incrustarlo en el HTML del correo. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Lógica pura del endpoint de contacto: valida el cuerpo y, si es válido,
 * envía el aviso al equipo mediante el cliente Resend inyectado.
 *
 * No accede a `process.env` ni abre conexiones por sí misma (el cliente se
 * inyecta vía `deps`), por lo que es testeable con un Resend falso.
 *
 * - Campos vacíos o correo con formato inválido → 400.
 * - Sin cliente Resend (falta `API_KEY_RESEND`) o fallo de Resend → 500.
 * - Envío aceptado → 200 `{ ok: true }`. Nunca propaga una excepción.
 */
export async function sendContactEmail(
  payload: Partial<ContactRequest> | null | undefined,
  deps: SendContactDeps,
): Promise<ContactResult> {
  const name = (payload?.name ?? '').trim();
  const email = (payload?.email ?? '').trim();
  const msg = (payload?.msg ?? '').trim();

  // Validación de servidor: los tres campos no vacíos + formato de correo.
  if (!name || !email || !msg || !EMAIL_RE.test(email)) {
    return { status: 400, body: { ok: false, error: 'Datos de contacto inválidos.' } };
  }

  // Sin API_KEY_RESEND el cliente no se construye en el servidor.
  if (!deps.resend) {
    return {
      status: 500,
      body: { ok: false, error: 'El servicio de correo no está configurado.' },
    };
  }

  try {
    const { error } = await deps.resend.emails.send({
      from: 'Arcade Vault <onboarding@resend.dev>',
      to: deps.to,
      replyTo: email,
      subject: `Nuevo mensaje de ${name} — Arcade Vault`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${msg}`,
      html:
        `<h2>Nuevo mensaje — Arcade Vault</h2>` +
        `<p><strong>Nombre:</strong> ${escapeHtml(name)}</p>` +
        `<p><strong>Correo:</strong> ${escapeHtml(email)}</p>` +
        `<p><strong>Mensaje:</strong></p>` +
        `<p>${escapeHtml(msg).replace(/\n/g, '<br>')}</p>`,
    });

    if (error) {
      return { status: 500, body: { ok: false, error: 'No se pudo enviar el correo.' } };
    }
    return { status: 200, body: { ok: true } };
  } catch {
    return { status: 500, body: { ok: false, error: 'No se pudo enviar el correo.' } };
  }
}
