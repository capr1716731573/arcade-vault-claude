import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Caida } from './caida';
import { ScoresService } from '../../services/scores.service';
describe('Caida (componente)', () => {
  beforeEach(() => {
    localStorage.clear();
    // Neutraliza el bucle del motor en jsdom (afterNextRender no arranca RAF real).
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '', component: Caida }])],
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('monta los canvas (tablero + NEXT) y refleja el estado inicial en el HUD DOM', () => {
    const f = TestBed.createComponent(Caida);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('canvas.caida-canvas')).toBeTruthy();
    expect(el.querySelector('canvas.caida-next')).toBeTruthy();
    expect(el.querySelector('.hud-stat.level .v')?.textContent?.trim()).toBe('01');
  });
  it('guardar solo funciona en gameover y envía game: "caida" al Salón, sin doble guardado', async () => {
    const scores = TestBed.inject(ScoresService);
    const spy = vi.spyOn(scores, 'save').mockResolvedValue({ ok: true });
    const comp = TestBed.createComponent(Caida).componentInstance as any;
    await comp.save(); // phase === 'playing' → no guarda
    expect(spy).not.toHaveBeenCalled();
    comp.phase.set('gameover');
    comp.score.set(1234);
    await comp.save();
    expect(spy).toHaveBeenCalledWith({ game: 'caida', score: 1234, name: 'INVITADO' });
    expect(comp.saved()).toBe(true);
    spy.mockClear();
    await comp.save(); // ya guardado → no repite
    expect(spy).not.toHaveBeenCalled();
  });
  it('si el guardado falla no marca guardado y expone el error', async () => {
    const scores = TestBed.inject(ScoresService);
    vi.spyOn(scores, 'save').mockResolvedValue({ ok: false, error: 'boom' });
    const comp = TestBed.createComponent(Caida).componentInstance as any;
    comp.phase.set('gameover');
    await comp.save();
    expect(comp.saved()).toBe(false);
    expect(comp.saveError()).toBe('boom');
  });
  it('applyState refleja el estado y reactiva el guardado al reiniciar', () => {
    const comp = TestBed.createComponent(Caida).componentInstance as any;
    comp.phase.set('gameover');
    comp.saved.set(true);
    comp.applyState({ score: 10, lines: 3, level: 2, phase: 'playing' });
    expect(comp.score()).toBe(10);
    expect(comp.lines()).toBe(3);
    expect(comp.level()).toBe(2);
    expect(comp.phase()).toBe('playing');
    expect(comp.saved()).toBe(false);
  });
  it('togglePause alterna la pausa y llama al motor', () => {
    const comp = TestBed.createComponent(Caida).componentInstance as any;
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
  it('toggleTheme alterna el tema del tablero, avisa al motor y lo persiste', () => {
    const comp = TestBed.createComponent(Caida).componentInstance as any;
    const fake = { setBoardTheme: vi.fn(), destroy: vi.fn() };
    comp.engine = fake;
    expect(comp.boardTheme()).toBe('dark');
    comp.toggleTheme();
    expect(comp.boardTheme()).toBe('light');
    expect(fake.setBoardTheme).toHaveBeenLastCalledWith('light');
    expect(localStorage.getItem('av_caida_theme')).toBe('light');
    comp.toggleTheme();
    expect(comp.boardTheme()).toBe('dark');
    expect(localStorage.getItem('av_caida_theme')).toBe('dark');
  });
});
