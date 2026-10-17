import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { GameDetail } from './game-detail';
import { GAMES_FIXTURE, MockData, provideSupabaseMock, scoreRow } from '../testing/supabase-mock';
describe('GameDetail', () => {
  const configure = (data: MockData) =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: GameDetail },
          { path: 'juego/:id', component: GameDetail },
        ]),
        provideSupabaseMock({ games: GAMES_FIXTURE, ...data }),
      ],
    });
  const navigate = async (url: string) => {
    const harness = await RouterTestingHarness.create();
    harness.fixture.autoDetectChanges();
    await harness.navigateByUrl(url, GameDetail).catch(() => undefined);
    await harness.fixture.whenStable();
    return harness;
  };
  it('muestra el juego y sus puntuaciones reales con top1/top2/top3', async () => {
    configure({ scores: [scoreRow('ACE', 9000), scoreRow('NEO', 6500), scoreRow('VIX', 4200)] });
    const harness = await navigate('/juego/caida');
    const el = harness.routeNativeElement!;
    expect(el.querySelector('h2')?.textContent).toContain('CAÍDA');
    expect(el.querySelectorAll('.stat-strip > div').length).toBe(3);
    const rows = el.querySelectorAll('.lb-row');
    expect(rows.length).toBe(3);
    expect(rows[0].classList).toContain('top1');
    expect(rows[1].classList).toContain('top2');
    expect(rows[2].classList).toContain('top3');
  });
  it('un juego sin marcas muestra el aviso de vacío', async () => {
    configure({ scores: [] });
    const harness = await navigate('/juego/caida');
    expect(harness.routeNativeElement!.textContent).toContain('Aún no hay puntuaciones');
  });
  it('un id inválido redirige a / tras cargar el catálogo', async () => {
    configure({ scores: [] });
    await navigate('/juego/nope');
    expect(TestBed.inject(Router).url).toBe('/');
  });
});
