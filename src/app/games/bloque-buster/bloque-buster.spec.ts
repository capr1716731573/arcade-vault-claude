import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BloqueBuster } from './bloque-buster';
import { ScoresService } from '../../services/scores.service';
describe('BloqueBuster (componente)', () => {
  beforeEach(() => {
    localStorage.clear();
    // Neutraliza el bucle del motor en jsdom (afterNextRender no arranca RAF real).
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '', component: BloqueBuster }])],
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('monta el canvas y refleja el estado inicial en el HUD DOM', () => {
    const f = TestBed.createComponent(BloqueBuster);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('canvas.bloque-buster-canvas')).toBeTruthy();
    expect(el.querySelector('.hud-stat.level .v')?.textContent?.trim()).toBe('01');
  });
  it('applyState refleja el estado y reactiva el guardado al reiniciar', () => {
    const comp = TestBed.createComponent(BloqueBuster).componentInstance as any;
    comp.phase.set('gameover');
    comp.saved.set(true);
    comp.applyState({ score: 50, lives: 3, level: 2, phase: 'playing' });
    expect(comp.score()).toBe(50);
    expect(comp.lives()).toBe(3);
    expect(comp.level()).toBe(2);
    expect(comp.phase()).toBe('playing');
    expect(comp.saved()).toBe(false);
  });
  it('guardar no funciona jugando, sí en gameover (game: "bloque-buster"), sin doble guardado', async () => {
    const scores = TestBed.inject(ScoresService);
    const spy = vi.spyOn(scores, 'save').mockResolvedValue({ ok: true });
    const comp = TestBed.createComponent(BloqueBuster).componentInstance as any;
    await comp.save(); // phase === 'playing' → no guarda
    expect(spy).not.toHaveBeenCalled();
    comp.phase.set('gameover');
    comp.score.set(1234);
    await comp.save();
    expect(spy).toHaveBeenCalledWith({ game: 'bloque-buster', score: 1234, name: 'INVITADO' });
    expect(comp.saved()).toBe(true);
    spy.mockClear();
    await comp.save(); // ya guardado → no repite
    expect(spy).not.toHaveBeenCalled();
  });
  it('guardar también funciona en win', async () => {
    const scores = TestBed.inject(ScoresService);
    const spy = vi.spyOn(scores, 'save').mockResolvedValue({ ok: true });
    const comp = TestBed.createComponent(BloqueBuster).componentInstance as any;
    comp.phase.set('win');
    comp.score.set(999);
    await comp.save();
    expect(spy).toHaveBeenCalledWith({ game: 'bloque-buster', score: 999, name: 'INVITADO' });
    expect(comp.saved()).toBe(true);
  });
  it('si el guardado falla no marca guardado y expone el error', async () => {
    const scores = TestBed.inject(ScoresService);
    vi.spyOn(scores, 'save').mockResolvedValue({ ok: false, error: 'boom' });
    const comp = TestBed.createComponent(BloqueBuster).componentInstance as any;
    comp.phase.set('gameover');
    await comp.save();
    expect(comp.saved()).toBe(false);
    expect(comp.saveError()).toBe('boom');
  });
  it('togglePause alterna la pausa y llama al motor', () => {
    const comp = TestBed.createComponent(BloqueBuster).componentInstance as any;
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
  it('toggleMuted alterna el silencio, avisa al motor y lo persiste', () => {
    const comp = TestBed.createComponent(BloqueBuster).componentInstance as any;
    const fake = { setMuted: vi.fn(), destroy: vi.fn() };
    comp.engine = fake;
    expect(comp.muted()).toBe(false);
    comp.toggleMuted();
    expect(comp.muted()).toBe(true);
    expect(fake.setMuted).toHaveBeenLastCalledWith(true);
    expect(localStorage.getItem('av_bloque_buster_muted')).toBe('true');
    comp.toggleMuted();
    expect(comp.muted()).toBe(false);
    expect(fake.setMuted).toHaveBeenLastCalledWith(false);
    expect(localStorage.getItem('av_bloque_buster_muted')).toBe('false');
  });
});
