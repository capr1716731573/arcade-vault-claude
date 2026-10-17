import { Component, computed, effect, inject, resource } from '@angular/core';
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
  private readonly scoresResource = resource({
    params: () => this.id() || undefined,
    loader: ({ params }) => this.scoresService.top(params, 10),
  });
  protected readonly scores = computed(() =>
    this.scoresResource.hasValue() ? this.scoresResource.value() : [],
  );
  protected readonly scoresLoading = this.scoresResource.isLoading;
  protected readonly gamesLoading = this.games.loading;
  protected readonly gamesError = this.games.error;
  constructor() {
    effect(() => {
      // Esperar a que el catálogo cargue antes de decidir que el juego no existe;
      // si no, durante la carga byId() sería undefined y redirigiría un id válido.
      if (this.games.loading()) return;
      const id = this.id();
      if (id && !this.game()) this.router.navigateByUrl('/', { replaceUrl: true });
    });
  }
  protected retry() {
    this.games.reload();
  }
}
