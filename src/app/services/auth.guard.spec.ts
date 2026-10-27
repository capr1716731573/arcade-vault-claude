import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { provideSupabaseMock, type AuthUserRow } from '../testing/supabase-mock';
describe('authGuard', () => {
  const user: AuthUserRow = { id: 'u1', email: 'kai@vault.gg', app_metadata: { provider: 'email' } };
  const run = () =>
    TestBed.runInInjectionContext(() =>
      (authGuard as (r: unknown, s: unknown) => unknown)({}, {}),
    ) as Promise<boolean | UrlTree>;
  it('permite el acceso cuando hay sesión', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideSupabaseMock({ authUser: user })] });
    expect(await run()).toBe(true);
  });
  it('redirige a /acceso cuando no hay sesión', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideSupabaseMock({ authUser: null })] });
    const r = await run();
    expect(r).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(r as UrlTree)).toBe('/acceso');
  });
});
