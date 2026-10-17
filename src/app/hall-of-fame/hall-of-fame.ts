import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EsNumberPipe } from '../shared/es-number.pipe';
import { GamesService } from '../services/games.service';
import { ScoresService } from '../services/scores.service';
@Component({
  selector: 'app-hall-of-fame',
  imports: [EsNumberPipe, RouterLink],
  templateUrl: './hall-of-fame.html',
  host: { class: 'av-hall fade-in', style: 'display: block' },
})
export class HallOfFame {
  private readonly scores = inject(ScoresService);
  private readonly gamesService = inject(GamesService);
  protected readonly games = this.gamesService.games;
  protected readonly gamesLoading = this.gamesService.loading;
  protected readonly tab = signal('');
  protected readonly game = computed(() => this.games().find((g) => g.id === this.tab()));
  private readonly rowsResource = resource({
    params: () => this.tab() || undefined,
    loader: ({ params }) => this.scores.hallOfFame(params, 12),
  });
  protected readonly rows = computed(() =>
    this.rowsResource.hasValue() ? this.rowsResource.value() : [],
  );
  protected readonly rowsLoading = this.rowsResource.isLoading;
  constructor() {
    // Seleccionar la primera pestaña cuando el catálogo termina de cargar.
    effect(() => {
      const gs = this.games();
      if (gs.length && !this.tab()) this.tab.set(gs[0].id);
    });
  }
}
