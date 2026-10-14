import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EsNumberPipe } from '../shared/es-number.pipe';
import { GamesService } from '../services/games.service';
import { ScoresService } from '../services/scores.service';
import { SessionService } from '../services/session.service';

@Component({
  selector: 'app-hall-of-fame',
  imports: [EsNumberPipe, RouterLink],
  templateUrl: './hall-of-fame.html',
  host: { class: 'av-hall fade-in', style: 'display: block' },
})
export class HallOfFame {
  private readonly scores = inject(ScoresService);
  protected readonly games = inject(GamesService).all();
  protected readonly session = inject(SessionService);

  protected readonly tab = signal(this.games[0].id);
  protected readonly game = computed(() => this.games.find((g) => g.id === this.tab())!);
  protected readonly rows = computed(() => this.scores.hallOfFame(this.tab(), 12));

  protected readonly you = computed(() => {
    const tab = this.tab();
    return {
      rank: 8 + (tab.length % 4),
      score: (this.rows()[5]?.score ?? 0) - 2400 || 9999,
    };
  });
}
