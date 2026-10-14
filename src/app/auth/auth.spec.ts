import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Auth } from './auth';
import { SessionService } from '../services/session.service';

describe('Auth', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  const setup = () => {
    const fixture = TestBed.createComponent(Auth);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('la pestaña "Crear cuenta" muestra el correo y "Iniciar sesión" lo oculta', () => {
    const { fixture, el } = setup();
    const tabs = el.querySelectorAll<HTMLButtonElement>('.auth-tabs button');
    expect(el.querySelector('input[type=email]')).toBeNull();
    tabs[1].click();
    fixture.detectChanges();
    expect(el.querySelector('input[type=email]')).not.toBeNull();
    tabs[0].click();
    fixture.detectChanges();
    expect(el.querySelector('input[type=email]')).toBeNull();
  });

  it('entrar guarda la sesión en mayúsculas y navega a /', () => {
    const { el } = setup();
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const input = el.querySelector<HTMLInputElement>('#auth-user')!;
    input.value = 'kai';
    input.dispatchEvent(new Event('input'));
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(TestBed.inject(SessionService).user()?.name).toBe('KAI');
    expect(nav).toHaveBeenCalledWith('/');
  });

  it('usuario vacío entra como PLAYER1', () => {
    const { el } = setup();
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(TestBed.inject(SessionService).user()?.name).toBe('PLAYER1');
  });

  it('invitado deja av_user vacío y navega a /', () => {
    const { el } = setup();
    TestBed.inject(SessionService).login('kai');
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    el.querySelector<HTMLButtonElement>('button.ghost')!.click();
    expect(localStorage.getItem('av_user')).toBeNull();
    expect(nav).toHaveBeenCalledWith('/');
  });
});
