import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Caida } from './caida';
import { ScoresService } from '../../services/scores.service';
import { SessionService } from '../../services/session.service';
describe('Caida (componente)', () => {
  let user: WritableSignal<{ name: string } | null>;
  beforeEach(() => {
    localStorage.clear();
    user = signal<{ name: string } | null>({ name: 'KAI' });
    // Neutraliza el bucle del motor en jsdom (afterNextRender no arranca RAF real).
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: Caida }]),
        { provide: SessionService, useValue: { user } },
      ],
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
  it('guardar solo funciona en gameover y envía game: "caida" con el nombre de sesión, sin doble guardado', async () => {
    const scores = TestBed.inject(ScoresService);
    const spy = vi.spyOn(scores, 'save').mockResolvedValue({ ok: true });
    const comp = TestBed.createComponent(Caida).componentInstance as any;
    await comp.save(); // phase === 'playing' → no guarda
    expect(spy).not.toHaveBeenCalled();
    comp.phase.set('gameover');
    comp.score.set(1234);
    await comp.save();
    expect(spy).toHaveBeenCalledWith({ game: 'caida', score: 1234, name: 'KAI' });
    expect(comp.saved()).toBe(true);
    spy.mockClear();
    await comp.save(); // ya guardado → no repite
    expect(spy).not.toHaveBeenCalled();
  });
  it('sin sesión no guarda: el guard corta antes de llamar al Salón', async () => {
    const scores = TestBed.inject(ScoresService);
    const spy = vi.spyOn(scores, 'save').mockResolvedValue({ ok: true });
    user.set(null);
    const comp = TestBed.createComponent(Caida).componentInstance as any;
    comp.phase.set('gameover');
    comp.score.set(1234);
    await comp.save();
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
  it('applyState autodispara el guardado al entrar en gameover con sesión iniciada', () => {
    const scores = TestBed.inject(ScoresService);
    const spy = vi.spyOn(scores, 'save').mockResolvedValue({ ok: true });
    const comp = TestBed.createComponent(Caida).componentInstance as any;
    comp.applyState({ score: 777, lines: 5, level: 2, phase: 'gameover' });
    expect(spy).toHaveBeenCalledWith({ game: 'caida', score: 777, name: 'KAI' });
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
  it('selectSkin cambia el skin, avisa al motor y lo persiste (av_caida_skin)', () => {
    const comp = TestBed.createComponent(Caida).componentInstance as any;
    const fake = { setSkin: vi.fn(), destroy: vi.fn() };
    comp.engine = fake;
    expect(comp.skin()).toBe('clasico');
    comp.selectSkin('neon');
    expect(comp.skin()).toBe('neon');
    expect(fake.setSkin).toHaveBeenLastCalledWith('neon');
    expect(localStorage.getItem('av_caida_skin')).toBe('neon');
    comp.selectSkin('retro');
    expect(comp.skin()).toBe('retro');
    expect(localStorage.getItem('av_caida_skin')).toBe('retro');
    // Reseleccionar el mismo skin no vuelve a llamar al motor.
    fake.setSkin.mockClear();
    comp.selectSkin('retro');
    expect(fake.setSkin).not.toHaveBeenCalled();
  });
});
