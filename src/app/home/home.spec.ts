import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';
import { GAMES_FIXTURE, provideSupabaseMock } from '../testing/supabase-mock';
describe('Home', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideSupabaseMock({ games: GAMES_FIXTURE })],
    });
  });
  const setup = () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };
  it('monta sin errores y muestra el título del hero', () => {
    const { el } = setup();
    expect(el.querySelector('.home-title')?.textContent).toContain('EL ARCADE');
  });
  it('renderiza exactamente 2 CTAs en el hero', () => {
    const { el } = setup();
    expect(el.querySelectorAll('.home-ctas a').length).toBe(2);
  });
  it('renderiza 4 tarjetas de características', () => {
    const { el } = setup();
    expect(el.querySelectorAll('.feature-card').length).toBe(4);
  });
  it('renderiza 6 mini-tarjetas del catálogo (async)', async () => {
    const fixture = TestBed.createComponent(Home);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('av-mini-card').length).toBe(6);
  });
  it('renderiza 3 bloques de estadísticas', () => {
    const { el } = setup();
    expect(el.querySelectorAll('.stat-block').length).toBe(3);
  });
  it('renderiza 7 filas de actividad', () => {
    const { el } = setup();
    expect(el.querySelectorAll('.tick-row').length).toBe(7);
  });
  it('renderiza 5 filas de top jugadores', () => {
    const { el } = setup();
    expect(el.querySelectorAll('.top-list .top-row').length).toBe(5);
  });
  it('los 3 primeros del top llevan clases top1, top2, top3', () => {
    const { el } = setup();
    const rows = el.querySelectorAll('.top-list .top-row');
    expect(rows[0].classList).toContain('top1');
    expect(rows[1].classList).toContain('top2');
    expect(rows[2].classList).toContain('top3');
    expect(rows[3].classList).not.toContain('top1');
  });
  it('renderiza 6 ítems de pricing', () => {
    const { el } = setup();
    expect(el.querySelectorAll('.pc-list li').length).toBe(6);
  });
  it('renderiza 3 FAQs', () => {
    const { el } = setup();
    expect(el.querySelectorAll('.faq-item').length).toBe(3);
  });
  it('los botones de navegación apuntan a las rutas correctas', () => {
    const { el } = setup();
    const links = Array.from(el.querySelectorAll('a[href]')).map(
      (a) => (a as HTMLAnchorElement).getAttribute('href'),
    );
    expect(links).toContain('/');          // EXPLORAR JUEGOS / VER TODOS / INSERTAR MONEDA
    expect(links).toContain('/acceso');    // CREAR CUENTA / EMPEZAR GRATIS
    expect(links).toContain('/salon');     // VER SALÓN
  });
  it('las siluetas flotantes tienen aria-hidden="true"', () => {
    const { el } = setup();
    expect(el.querySelector('.home-silos')?.getAttribute('aria-hidden')).toBe('true');
  });
});
