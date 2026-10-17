import { TestBed } from '@angular/core/testing';
import { HomeService } from './home.service';
import { GAMES_FIXTURE, provideSupabaseMock, settle } from '../testing/supabase-mock';
describe('HomeService', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideSupabaseMock({ games: GAMES_FIXTURE })],
    }),
  );
  const service = () => TestBed.inject(HomeService);
  it('devuelve 4 features', () => {
    expect(service().features().length).toBe(4);
  });
  it('devuelve 3 estadísticas', () => {
    expect(service().stats().length).toBe(3);
  });
  it('devuelve 7 filas de actividad', () => {
    expect(service().activity().length).toBe(7);
  });
  it('devuelve 5 top jugadores', () => {
    expect(service().topToday().length).toBe(5);
  });
  it('devuelve 6 pricing features', () => {
    expect(service().pricingFeatures().length).toBe(6);
  });
  it('devuelve 3 FAQs', () => {
    expect(service().faqs().length).toBe(3);
  });
  it('previewGames devuelve los 6 primeros juegos del catálogo', async () => {
    const svc = service();
    await settle();
    const games = svc.previewGames();
    expect(games.length).toBe(6);
    expect(games[0].id).toBe('asteroides');
  });
});
