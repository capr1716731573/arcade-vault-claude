import { Component, computed, signal } from '@angular/core';
import { CATS, GAMES, Game } from '../games/games.data';
import { GameCard } from './game-card/game-card';

@Component({
  selector: 'app-library',
  imports: [GameCard],
  templateUrl: './library.html',
  host: { class: 'fade-in', style: 'display: block' },
})
export class Library {
  protected readonly cats = CATS;
  protected readonly query = signal('');
  protected readonly cat = signal('TODOS');

  protected readonly filtered = computed(() => {
    const q = this.query().toLowerCase();
    const cat = this.cat();
    return GAMES.filter(
      (g) => (cat === 'TODOS' || g.cat === cat) && g.title.toLowerCase().includes(q),
    );
  });

  protected onSelect(game: Game) {
    console.log('detalle', game.id);
  }
}
