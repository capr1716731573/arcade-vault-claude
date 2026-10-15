import { Injectable } from '@angular/core';
import { CATS, GAMES, Game } from '../data/games.data';

export type { Game, GameColor } from '../data/games.data';

@Injectable({ providedIn: 'root' })
export class GamesService {
  readonly categories = CATS;

  all(): Game[] {
    return GAMES;
  }

  byId(id: string): Game | undefined {
    return GAMES.find((g) => g.id === id);
  }
}
