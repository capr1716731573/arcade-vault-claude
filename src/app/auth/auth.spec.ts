import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from './auth';
import { SupabaseService } from '../services/supabase.service';
import { provideSupabaseMock } from '../testing/supabase-mock';
describe('Auth (componente)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '', component: Auth }]), provideSupabaseMock({ authUser: null })],
    });
  });
  it('muestra las pestañas de inicio y alta', () => {
    const f = TestBed.createComponent(Auth);
    f.detectChanges();
    const t = f.nativeElement.textContent ?? '';
    expect(t).toContain('INICIAR SESIÓN');
    expect(t).toContain('CREAR CUENTA');
  });
  it('con campos vacíos muestra un error y no llama a Supabase', async () => {
    const comp = TestBed.createComponent(Auth).componentInstance as any;
    await comp.submit(new Event('submit'));
    expect(comp.error()).toBe('Introduce correo y contraseña.');
  });
  it('tras registrarse con confirmación muestra "revisa tu correo"', async () => {
    const comp = TestBed.createComponent(Auth).componentInstance as any;
    comp.tab.set('up');
    comp.email.set('a@b.gg');
    comp.password.set('secret123');
    comp.username.set('kai');
    await comp.submit(new Event('submit'));
    expect(comp.sent()).toBe(true);
  });
  it('reenvía el correo de confirmación y marca "reenviado"', async () => {
    const auth = TestBed.inject(SupabaseService).client.auth as any;
    const spy = vi.spyOn(auth, 'resend');
    const comp = TestBed.createComponent(Auth).componentInstance as any;
    comp.sent.set(true);
    comp.email.set('a@b.gg');
    await comp.resend();
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'signup', email: 'a@b.gg' }),
    );
    expect(comp.resent()).toBe(true);
    expect(comp.error()).toBeNull();
  });
  it('si el reenvío falla muestra el error traducido y no marca "reenviado"', async () => {
    const auth = TestBed.inject(SupabaseService).client.auth as any;
    vi.spyOn(auth, 'resend').mockResolvedValue({
      data: {},
      error: { message: 'For security purposes, you can only request this after 48 seconds' },
    } as never);
    const comp = TestBed.createComponent(Auth).componentInstance as any;
    comp.sent.set(true);
    comp.email.set('a@b.gg');
    await comp.resend();
    expect(comp.resent()).toBe(false);
    expect(comp.error()).toBe('Espera unos segundos antes de volver a intentarlo.');
  });
  it('traduce el error de credenciales inválidas', async () => {
    const auth = TestBed.inject(SupabaseService).client.auth;
    vi.spyOn(auth, 'signInWithPassword').mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    } as never);
    const comp = TestBed.createComponent(Auth).componentInstance as any;
    comp.email.set('a@b.gg');
    comp.password.set('bad');
    await comp.submit(new Event('submit'));
    expect(comp.error()).toBe('Credenciales inválidas.');
  });
});
