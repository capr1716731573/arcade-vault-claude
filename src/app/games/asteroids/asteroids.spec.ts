import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Asteroids } from './asteroids';
import { ScoresService } from '../../services/scores.service';
describe('Asteroids (componente)', () => {
  beforeEach(() => {
    localStorage.clear();
    // Neutraliza el bucle del motor en jsdom (afterNextRender no arranca RAF real).
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '', component: Asteroids }])],
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('monta el canvas y refleja el estado inicial en el HUD DOM', () => {
    const f = TestBed.createComponent(Asteroids);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('canvas.asteroids-canvas')).toBeTruthy();
    expect(el.textContent).toContain('INVITADO');
    expect(el.querySelector('.hud-stat.level .v')?.textContent?.trim()).toBe('01');
    expect(el.querySelector('.hud-stat.lives .v')?.textContent?.trim()).toBe('♥ ♥ ♥');
  });
  it('guardar solo funciona en gameover y envía game: "asteroides" al Salón, sin doble guardado', () => {
    const scores = TestBed.inject(ScoresService);
    const spy = vi.spyOn(scores, 'save');
    const comp = TestBed.createComponent(Asteroids).componentInstance as any;
    comp.save(); // phase === 'playing' → no guarda
    expect(spy).not.toHaveBeenCalled();
    comp.phase.set('gameover');
    comp.score.set(999);
    comp.save();
    expect(spy).toHaveBeenCalledWith({ game: 'asteroides', score: 999, name: 'INVITADO' });
    expect(comp.saved()).toBe(true);
    spy.mockClear();
    comp.save(); // ya guardado → no repite
    expect(spy).not.toHaveBeenCalled();
  });
  it('applyState refleja el estado y reactiva el guardado al reiniciar', () => {
    const comp = TestBed.createComponent(Asteroids).componentInstance as any;
    comp.phase.set('gameover');
    comp.saved.set(true);
    comp.applyState({ score: 10, lives: 2, level: 3, tripleShot: 4.2, phase: 'playing' });
    expect(comp.score()).toBe(10);
    expect(comp.lives()).toBe(2);
    expect(comp.level()).toBe(3);
    expect(comp.tripleShot()).toBe(4.2);
    expect(comp.phase()).toBe('playing');
    expect(comp.saved()).toBe(false);
  });
  it('togglePause alterna la pausa y llama al motor', () => {
    const comp = TestBed.createComponent(Asteroids).componentInstance as any;
    const fake = { pause: vi.fn(), resume: vi.fn(), destroy: vi.fn() };
    comp.engine = fake;
    expect(comp.paused()).toBe(false);
    comp.togglePause();
    expect(comp.paused()).toBe(true);
    expect(fake.pause).toHaveBeenCalledTimes(1);
    comp.togglePause();
    expect(comp.paused()).toBe(false);
    expect(fake.resume).toHaveBeenCalledTimes(1);
  });
});
