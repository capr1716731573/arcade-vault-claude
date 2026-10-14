import { Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { EsNumberPipe } from '../shared/es-number.pipe';
import { GamesService } from '../services/games.service';
import { ScoresService } from '../services/scores.service';

@Component({
  selector: 'app-game-detail',
  imports: [EsNumberPipe, RouterLink],
  templateUrl: './game-detail.html',
  host: { class: 'fade-in', style: 'display: block' },
})
export class GameDetail {
  private readonly router = inject(Router);
  private readonly games = inject(GamesService);
  private readonly scoresService = inject(ScoresService);

  private readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')),
    { requireSync: true },
  );

  protected readonly game = computed(() => this.games.byId(this.id()));
  protected readonly scores = computed(() => this.scoresService.top(this.id(), 10));

  constructor() {
    effect(() => {
      if (!this.game()) this.router.navigateByUrl('/', { replaceUrl: true });
    });
  }
}
