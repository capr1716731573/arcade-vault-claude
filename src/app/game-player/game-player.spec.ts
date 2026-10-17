import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { GamePlayer } from './game-player';
import { GAMES_FIXTURE, provideSupabaseMock } from '../testing/supabase-mock';
/** Vacía la cola de microtareas (setTimeout real: no está falseado). */
const flush = () => new Promise<void>((r) => setTimeout(r));
describe('GamePlayer', () => {
  let inserted: Array<Record<string, unknown>>;
  beforeEach(() => {
    inserted = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: GamePlayer },
          { path: 'jugar/:id', component: GamePlayer },
        ]),
        provideSupabaseMock({ games: GAMES_FIXTURE, inserted }),
      ],
    });
  });
  afterEach(() => vi.useRealTimers());
  const setup = async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/jugar/caida', GamePlayer);
    await flush(); // resuelve el resource del catálogo
    harness.detectChanges(); // renderiza el HUD ya con el juego cargado
    const el = harness.routeNativeElement!;
    const score = () => el.querySelector('.hud-stat:nth-child(2) .v')!.textContent!.trim();
    const click = (sel: string) => {
      el.querySelector<HTMLElement>(sel)!.click();
      harness.detectChanges();
    };
    const tick = (ms: number) => {
      vi.advanceTimersByTime(ms);
      harness.detectChanges();
    };
    return { harness, el, score, click, tick };
  };
  it('la puntuación sube sola, la pausa la detiene y reanudar la continúa', async () => {
    const { el, score, click, tick } = await setup();
    expect(score()).toBe('0');
    tick(660);
    expect(score()).not.toBe('0');
    click('.btn.yellow');
    expect(el.textContent).toContain('EN PAUSA');
    const frozen = score();
    tick(1000);
    expect(score()).toBe(frozen);
    click('.btn.yellow');
    tick(660);
    expect(score()).not.toBe(frozen);
  });
  it('FIN abre el modal y guarda la puntuación en Supabase', async () => {
    const { el, click, tick, harness } = await setup();
    tick(660);
    click('.btn.magenta');
    expect(el.querySelector('.modal h2')?.textContent).toContain('FIN DEL JUEGO');
    el.querySelector<HTMLElement>('.input-row .btn')!.click();
    await flush(); // resuelve el save async
    harness.detectChanges();
    expect(el.querySelector('.toast-saved')?.textContent).toContain('PUNTUACIÓN GUARDADA');
    expect(inserted[0]).toMatchObject({ game_id: 'caida', name: 'INVITADO' });
  });
  it('JUGAR DE NUEVO reinicia puntuación, vidas y nivel', async () => {
    const { el, score, click, tick } = await setup();
    tick(660);
    click('.btn.magenta');
    click('.actions .btn:not(.magenta)');
    expect(el.querySelector('.modal')).toBeNull();
    expect(score()).toBe('0');
    expect(el.querySelector('.hud-stat.lives .v')?.textContent?.trim()).toBe('♥ ♥ ♥');
    expect(el.querySelector('.hud-stat.level .v')?.textContent?.trim()).toBe('01');
  });
  it('un id inválido redirige a / tras cargar el catálogo', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/jugar/nope', GamePlayer).catch(() => undefined);
    await flush();
    harness.detectChanges();
    await flush();
    expect(TestBed.inject(Router).url).toBe('/');
  });
});
