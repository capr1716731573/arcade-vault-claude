import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Cuenta } from './cuenta';
import { provideSupabaseMock, type AuthUserRow } from '../testing/supabase-mock';
describe('Cuenta (componente)', () => {
  const user: AuthUserRow = {
    id: 'u1',
    email: 'kai@vault.gg',
    user_metadata: { username: 'kai' },
    app_metadata: { provider: 'email' },
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '', component: Cuenta }]), provideSupabaseMock({ authUser: user })],
    });
  });
  it('muestra el correo y el proveedor del usuario', () => {
    const f = TestBed.createComponent(Cuenta);
    f.detectChanges();
    const t = f.nativeElement.textContent ?? '';
    expect(t).toContain('kai@vault.gg');
    expect(t).toContain('Correo electrónico');
  });
  it('guardar el nombre marca saved', async () => {
    const comp = TestBed.createComponent(Cuenta).componentInstance as any;
    comp.name.set('NEO');
    await comp.save(new Event('submit'));
    expect(comp.saved()).toBe(true);
    expect(comp.error()).toBeNull();
  });
  it('cerrar sesión navega a la biblioteca', async () => {
    const f = TestBed.createComponent(Cuenta);
    const comp = f.componentInstance as any;
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await comp.logout();
    expect(nav).toHaveBeenCalledWith('/');
  });
});
