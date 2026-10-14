import { Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
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
  private readonly route = inject(ActivatedRoute);

  // initialValue from snapshot (always correct at construction time).
  // filter(Boolean) ignores spurious null/empty emissions from paramMap
  // that can occur during route activation and would collapse the @if.
  private readonly id = toSignal(
    this.route.paramMap.pipe(
      map((p) => p.get('id') ?? ''),
      filter((id) => !!id),
    ),
    { initialValue: this.route.snapshot.paramMap.get('id') ?? '' },
  );

  protected readonly game = computed(() => this.games.byId(this.id()));
  protected readonly scores = computed(() => this.scoresService.top(this.id(), 10));

  constructor() {
    effect(() => {
      const id = this.id();
      if (id && !this.game()) this.router.navigateByUrl('/', { replaceUrl: true });
    });
  }
}
