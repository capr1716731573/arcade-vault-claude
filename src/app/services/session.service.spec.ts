import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SupabaseService } from './supabase.service';
import { SessionService } from './session.service';
import { provideSupabaseMock, type AuthUserRow } from '../testing/supabase-mock';
describe('SessionService', () => {
  const user: AuthUserRow = {
    id: 'u1',
    email: 'kai@vault.gg',
    user_metadata: { username: 'kai' },
    app_metadata: { provider: 'email' },
  };
  it('refleja la sesión en user() con el nombre de user_metadata en mayúsculas', () => {
    TestBed.configureTestingModule({ providers: [provideSupabaseMock({ authUser: user })] });
    expect(TestBed.inject(SessionService).user()).toEqual({
      id: 'u1',
      name: 'KAI',
      email: 'kai@vault.gg',
      provider: 'email',
    });
  });
  it('sin sesión, user() es null', () => {
    TestBed.configureTestingModule({ providers: [provideSupabaseMock({ authUser: null })] });
    expect(TestBed.inject(SessionService).user()).toBeNull();
  });
  it('en servidor (SSR) no lee la sesión: user() es null', () => {
    TestBed.configureTestingModule({
      providers: [provideSupabaseMock({ authUser: user }), { provide: PLATFORM_ID, useValue: 'server' }],
    });
    expect(TestBed.inject(SessionService).user()).toBeNull();
  });
  it('resuelve el nombre del proveedor OAuth cuando no hay username', () => {
    TestBed.configureTestingModule({
      providers: [
        provideSupabaseMock({
          authUser: {
            id: 'u2',
            email: 'x@y.gg',
            user_metadata: { full_name: 'Neo Runner' },
            app_metadata: { provider: 'github' },
          },
        }),
      ],
    });
    const u = TestBed.inject(SessionService).user();
    expect(u?.name).toBe('NEO RUNNER');
    expect(u?.provider).toBe('github');
  });
  it('register con confirmación de correo devuelve needsConfirmation', async () => {
    TestBed.configureTestingModule({ providers: [provideSupabaseMock({ authUser: null })] });
    const r = await TestBed.inject(SessionService).register('a@b.gg', 'secret123', 'kai');
    expect(r).toEqual({ ok: true, needsConfirmation: true });
  });
  it('signIn propaga el error de Supabase', async () => {
    TestBed.configureTestingModule({ providers: [provideSupabaseMock({ authUser: null })] });
    const auth = TestBed.inject(SupabaseService).client.auth;
    vi.spyOn(auth, 'signInWithPassword').mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    } as never);
    const r = await TestBed.inject(SessionService).signIn('a@b.gg', 'bad');
    expect(r).toEqual({ ok: false, error: 'Invalid login credentials' });
  });
  it('logout cierra la sesión y deja user() en null', async () => {
    TestBed.configureTestingModule({ providers: [provideSupabaseMock({ authUser: user })] });
    const s = TestBed.inject(SessionService);
    expect(s.user()).not.toBeNull();
    await s.logout();
    expect(s.user()).toBeNull();
  });
});
