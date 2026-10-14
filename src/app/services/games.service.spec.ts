import { TestBed } from '@angular/core/testing';
import { GamesService } from './games.service';

describe('GamesService', () => {
  const service = () => TestBed.inject(GamesService);

  it('expone los 8 juegos y las categorías', () => {
    expect(service().all().length).toBe(8);
    expect(service().categories[0]).toBe('TODOS');
  });

  it('byId devuelve el juego o undefined', () => {
    expect(service().byId('caida')?.title).toBe('CAÍDA');
    expect(service().byId('nope')).toBeUndefined();
  });
});
