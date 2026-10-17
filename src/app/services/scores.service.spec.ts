import { TestBed } from '@angular/core/testing';
import { ScoresService } from './scores.service';
import { provideSupabaseMock, scoreRow } from '../testing/supabase-mock';
describe('ScoresService', () => {
  const setup = (data = {}) => {
    TestBed.configureTestingModule({ providers: [provideSupabaseMock(data)] });
    return TestBed.inject(ScoresService);
  };
  it('top mapea las filas a ScoreRow con rank y fecha dd/mm/yyyy', async () => {
    const service = setup({
      scores: [scoreRow('ACE', 9000), scoreRow('NEO', 6500), scoreRow('VIX', 4200)],
    });
    const rows = await service.top('asteroides', 10);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(rows[0]).toMatchObject({ name: 'ACE', score: 9000 });
    expect(rows[0].date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
  it('con la tabla vacía devuelve []', async () => {
    const service = setup({ scores: [] });
    expect(await service.hallOfFame('asteroides')).toEqual([]);
  });
  it('save inserta game_id/name/score y devuelve ok', async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const service = setup({ inserted });
    const res = await service.save({ game: 'asteroides', score: 100, name: 'ABC' });
    expect(res.ok).toBe(true);
    expect(inserted[0]).toEqual({ game_id: 'asteroides', name: 'ABC', score: 100 });
  });
  it('save devuelve ok:false con el mensaje de error de Supabase', async () => {
    const service = setup({ insertError: { message: 'boom' } });
    const res = await service.save({ game: 'asteroides', score: 1, name: 'A' });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('boom');
  });
});
