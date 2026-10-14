import { TestBed } from '@angular/core/testing';
import { ScoresService } from './scores.service';

describe('ScoresService', () => {
  beforeEach(() => localStorage.clear());
  const service = () => TestBed.inject(ScoresService);

  it('top devuelve filas ordenadas por puntuación descendente', () => {
    const rows = service().top('caida', 10);
    expect(rows.length).toBe(10);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].score).toBeGreaterThanOrEqual(rows[i].score);
    }
  });

  it('hallOfFame devuelve 12 filas y usa otra semilla que top', () => {
    const hall = service().hallOfFame('caida');
    expect(hall.length).toBe(12);
    expect(hall.map((r) => r.name)).not.toEqual(
      service()
        .top('caida', 12)
        .map((r) => r.name),
    );
  });

  it('save añade entradas con at a av_scores', () => {
    service().save({ game: 'caida', score: 100, name: 'ABC' });
    service().save({ game: 'caida', score: 200, name: 'ABC' });
    const all = JSON.parse(localStorage.getItem('av_scores')!);
    expect(all.length).toBe(2);
    expect(all[1]).toEqual({ game: 'caida', score: 200, name: 'ABC', at: expect.any(Number) });
  });

  it('save no falla con JSON corrupto', () => {
    localStorage.setItem('av_scores', '{rota');
    expect(() => service().save({ game: 'caida', score: 1, name: 'A' })).not.toThrow();
  });
});
