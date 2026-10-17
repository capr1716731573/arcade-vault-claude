import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Game, GamesService } from '../services/games.service';
import { GameCard } from './game-card/game-card';
@Component({
  selector: 'app-library',
  imports: [GameCard],
  templateUrl: './library.html',
  host: { class: 'fade-in', style: 'display: block' },
})
export class Library {
  private readonly games = inject(GamesService);
  private readonly router = inject(Router);
  protected readonly cats = this.games.categories;
  protected readonly loading = this.games.loading;
  protected readonly error = this.games.error;
  protected readonly query = signal('');
  protected readonly cat = signal('TODOS');
  protected readonly filtered = computed(() => {
    const q = this.query().toLowerCase();
    const cat = this.cat();
    return this.games.all().filter(
      (g) => (cat === 'TODOS' || g.cat === cat) && g.title.toLowerCase().includes(q),
    );
  });
  protected retry() {
    this.games.reload();
  }
  protected onSelect(game: Game) {
    this.router.navigate(['/juego', game.id]);
  }
}
