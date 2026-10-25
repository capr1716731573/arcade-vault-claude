import { TestBed } from '@angular/core/testing';
import { GamesService } from './games.service';
import { GAMES_FIXTURE, MockData, provideSupabaseMock, settle } from '../testing/supabase-mock';
describe('GamesService', () => {
  const setup = (data: MockData = { games: GAMES_FIXTURE }) => {
    TestBed.configureTestingModule({ providers: [provideSupabaseMock(data)] });
    return TestBed.inject(GamesService);
  };
  it('lee el catálogo desde Supabase (ordenado) y expone las categorías', async () => {
    const service = setup();
    await settle();
    expect(service.all().length).toBe(5);
    expect(service.all()[0].id).toBe('asteroides');
    expect(service.categories[0]).toBe('TODOS');
  });
  it('mapea las filas a Game y byId resuelve sobre la lista cargada', async () => {
    const service = setup();
    await settle();
    expect(service.byId('caida')?.title).toBe('CAÍDA');
    expect(service.byId('caida')?.playable).toBe(true);
    expect(service.byId('asteroides')?.playable).toBe(true);
    expect(service.byId('bloque-buster')?.playable).toBe(true);
    expect(service.byId('nope')).toBeUndefined();
  });
  it('expone el estado de error cuando la consulta falla', async () => {
    const service = setup({ games: [], gamesError: { message: 'fallo' } });
    await settle();
    expect(service.all()).toEqual([]);
    expect(service.error()).toBeTruthy();
  });
});
