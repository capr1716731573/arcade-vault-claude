import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Nav } from './nav';
import { SessionService } from '../services/session.service';

describe('Nav', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Nav },
          { path: 'juego', component: Nav },
          { path: 'juego/:id', component: Nav },
          { path: 'jugar/:id', component: Nav },
          { path: 'salon', component: Nav },
        ]),
      ],
    });
  });

  const el = (f: { nativeElement: HTMLElement }) => f.nativeElement;

  it('sin sesión muestra "Iniciar Sesión"; con sesión, el nombre', () => {
    const fixture = TestBed.createComponent(Nav);
    fixture.detectChanges();
    expect(el(fixture).querySelector('.auth-btn')?.textContent).toContain('Iniciar Sesión');

    TestBed.inject(SessionService).login('kai');
    fixture.detectChanges();
    expect(el(fixture).querySelector('.auth-btn')?.textContent).toContain('KAI');
  });

  it('pulsar el nombre cierra sesión', () => {
    TestBed.inject(SessionService).login('kai');
    const fixture = TestBed.createComponent(Nav);
    fixture.detectChanges();
    el(fixture).querySelector<HTMLButtonElement>('.auth-btn')!.click();
    expect(TestBed.inject(SessionService).user()).toBeNull();
  });

  it('la hamburguesa abre y el backdrop cierra el panel', () => {
    const fixture = TestBed.createComponent(Nav);
    fixture.detectChanges();
    const panel = el(fixture).querySelector('.av-mobile-panel')!;
    el(fixture).querySelector<HTMLButtonElement>('.hamburger')!.click();
    fixture.detectChanges();
    expect(panel.classList).toContain('open');
    el(fixture).querySelector<HTMLElement>('.av-mobile-backdrop')!.click();
    fixture.detectChanges();
    expect(panel.classList).not.toContain('open');
  });

  it('marca el enlace activo según la ruta', async () => {
    const harness = await RouterTestingHarness.create();
    const fixture = TestBed.createComponent(Nav);
    const active = () =>
      Array.from(el(fixture).querySelectorAll('.links a.active')).map((a) => a.textContent?.trim());

    await harness.navigateByUrl('/jugar/caida');
    fixture.detectChanges();
    expect(active()).toEqual(['Biblioteca']);

    await harness.navigateByUrl('/salon');
    fixture.detectChanges();
    expect(active()).toEqual(['Salón de la Fama']);

    await harness.navigateByUrl('/juego');
    fixture.detectChanges();
    expect(active()).toEqual(['Inicio']);

    await harness.navigateByUrl('/juego/caida');
    fixture.detectChanges();
    expect(active()).toEqual(['Biblioteca']);
  });
});
