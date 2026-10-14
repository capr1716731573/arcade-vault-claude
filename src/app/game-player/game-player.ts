import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { EsNumberPipe } from '../shared/es-number.pipe';
import { GamesService } from '../services/games.service';
import { ScoresService } from '../services/scores.service';
import { SessionService } from '../services/session.service';

@Component({
  selector: 'app-game-player',
  imports: [EsNumberPipe, RouterLink],
  templateUrl: './game-player.html',
  host: { class: 'av-player fade-in', style: 'display: block' },
})
export class GamePlayer {
  private readonly router = inject(Router);
  private readonly games = inject(GamesService);
  private readonly scores = inject(ScoresService);

  private readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')),
    { requireSync: true },
  );

  protected readonly game = computed(() => this.games.byId(this.id()));

  protected readonly score = signal(0);
  protected readonly lives = signal(3);
  protected readonly level = signal(1);
  protected readonly paused = signal(false);
  protected readonly over = signal(false);
  protected readonly saved = signal(false);
  protected readonly name = signal(inject(SessionService).user()?.name ?? 'INVITADO');

  protected readonly hearts = computed(() => '♥ '.repeat(this.lives()).trim() || '—');

  constructor() {
    effect(() => {
      const id = this.id();
      if (id && !this.game()) this.router.navigateByUrl('/', { replaceUrl: true });
    });

    effect((onCleanup) => {
      if (this.over() || this.paused()) return;
      const t = setInterval(() => this.tick(), 220);
      onCleanup(() => clearInterval(t));
    });
  }

  private tick() {
    const next = this.score() + Math.floor(10 + Math.random() * 90);
    this.score.set(next);
    if (next % 2500 < 100) this.level.update((l) => l + 1);
  }

  protected setName(value: string) {
    this.name.set(value.toUpperCase().slice(0, 10));
  }

  protected save() {
    const game = this.game();
    if (!game) return;
    this.scores.save({ game: game.id, score: this.score(), name: this.name() });
    this.saved.set(true);
  }

  protected restart() {
    this.score.set(0);
    this.lives.set(3);
    this.level.set(1);
    this.paused.set(false);
    this.over.set(false);
    this.saved.set(false);
  }
}
