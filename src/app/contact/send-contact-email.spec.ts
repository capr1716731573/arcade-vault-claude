import { sendContactEmail, type ResendLike } from './send-contact-email';

function fakeResend(result: { data: unknown; error: unknown } = { data: { id: 'email_1' }, error: null }) {
  const send = vi.fn().mockResolvedValue(result);
  const resend: ResendLike = { emails: { send } };
  return { resend, send };
}

const valid = { name: 'Ada', email: 'ada@example.com', msg: 'Hola equipo' };

describe('sendContactEmail', () => {
  it('campos vacíos → 400 y no llama a Resend', async () => {
    const { resend, send } = fakeResend();
    const res = await sendContactEmail({ name: '', email: 'a@b.com', msg: 'x' }, { resend, to: 't@x.com' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: expect.any(String) });
    expect(send).not.toHaveBeenCalled();
  });

  it('correo con formato inválido → 400 y no llama a Resend', async () => {
    const { resend, send } = fakeResend();
    const res = await sendContactEmail({ ...valid, email: 'no-es-email' }, { resend, to: 't@x.com' });
    expect(res.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it('sin cliente Resend (falta API_KEY_RESEND) → 500', async () => {
    const res = await sendContactEmail(valid, { resend: null, to: 't@x.com' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: expect.any(String) });
  });

  it('datos válidos → 200 y llama a Resend con from sandbox, to, replyTo y asunto con el nombre', async () => {
    const { resend, send } = fakeResend();
    const res = await sendContactEmail(valid, { resend, to: 'equipo@arcade.dev' });
    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0][0];
    expect(payload.from).toBe('Arcade Vault <onboarding@resend.dev>');
    expect(payload.to).toBe('equipo@arcade.dev');
    expect(payload.replyTo).toBe('ada@example.com');
    expect(payload.subject).toContain('Ada');
    expect(payload.text).toContain('Hola equipo');
    expect(payload.html).toContain('Hola equipo');
  });

  it('escapa el HTML del visitante en el cuerpo del correo', async () => {
    const { resend, send } = fakeResend();
    await sendContactEmail({ ...valid, msg: '<script>alert(1)</script>' }, { resend, to: 't@x.com' });
    const payload = send.mock.calls[0][0];
    expect(payload.html).not.toContain('<script>');
    expect(payload.html).toContain('&lt;script&gt;');
  });

  it('si Resend devuelve error → 500', async () => {
    const { resend } = fakeResend({ data: null, error: { message: 'boom' } });
    const res = await sendContactEmail(valid, { resend, to: 't@x.com' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: expect.any(String) });
  });

  it('si Resend lanza una excepción → 500 (nunca propaga)', async () => {
    const send = vi.fn().mockRejectedValue(new Error('network'));
    const resend: ResendLike = { emails: { send } };
    const res = await sendContactEmail(valid, { resend, to: 't@x.com' });
    expect(res.status).toBe(500);
  });
});
