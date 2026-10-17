import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { EsNumberPipe } from '../../shared/es-number.pipe';
import { ScoresService } from '../../services/scores.service';
import { SessionService } from '../../services/session.service';
import {
  AsteroidsEngine,
  type AsteroidsPhase,
  type AsteroidsState,
  type TouchAction,
} from './asteroids-engine';
@Component({
  selector: 'app-asteroids',
  imports: [EsNumberPipe, RouterLink],
  templateUrl: './asteroids.html',
  host: { class: 'av-player fade-in', style: 'display: block' },
})
export class Asteroids implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly scores = inject(ScoresService);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  // Estado reflejado desde el motor (coexiste con el HUD dibujado en el canvas).
  protected readonly score = signal(0);
  protected readonly lives = signal(3);
  protected readonly level = signal(1);
  protected readonly tripleShot = signal(0);
  protected readonly phase = signal<AsteroidsPhase>('playing');
  protected readonly paused = signal(false);
  protected readonly saved = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly name = signal(inject(SessionService).user()?.name ?? 'INVITADO');
  protected readonly hearts = computed(() => '♥ '.repeat(this.lives()).trim() || '—');
  private engine: AsteroidsEngine | null = null;
  private pauseKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  constructor() {
    // Solo navegador (no corre en SSR). El canvas ya está renderizado aquí.
    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      // El bucle RAF vive fuera de la zona de Angular para no disparar change
      // detection en cada frame; onState vuelve a la zona solo cuando cambia algo.
      this.zone.runOutsideAngular(() => {
        const engine = new AsteroidsEngine(canvas, {
          onState: (s) => this.zone.run(() => this.applyState(s)),
        });
        this.engine = engine;
        engine.start();
        const handler = (e: KeyboardEvent) => {
          if (e.code !== 'KeyP' && e.code !== 'Escape') return;
          e.preventDefault();
          this.zone.run(() => this.togglePause());
        };
        window.addEventListener('keydown', handler);
        this.pauseKeyHandler = handler;
      });
    });
  }
  ngOnDestroy() {
    this.engine?.destroy();
    this.engine = null;
    if (this.pauseKeyHandler) {
      window.removeEventListener('keydown', this.pauseKeyHandler);
      this.pauseKeyHandler = null;
    }
  }
  private applyState(s: AsteroidsState) {
    this.score.set(s.score);
    this.lives.set(s.lives);
    this.level.set(s.level);
    this.tripleShot.set(s.tripleShot);
    this.phase.set(s.phase);
    // Al reiniciar la partida (ESPACIO en el canvas) se vuelve a permitir guardar.
    if (s.phase === 'playing' && (this.saved() || this.saveError())) {
      this.saved.set(false);
      this.saveError.set(null);
    }
  }
  protected togglePause() {
    const engine = this.engine;
    if (!engine) return;
    const next = !this.paused();
    this.paused.set(next);
    if (next) engine.pause();
    else engine.resume();
  }
  protected press(action: TouchAction, pressed: boolean, e: Event) {
    e.preventDefault();
    this.engine?.setInput(action, pressed);
  }
  protected setName(value: string) {
    this.name.set(value.toUpperCase().slice(0, 10));
  }
  protected async save() {
    if (this.phase() !== 'gameover' || this.saved() || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    const res = await this.scores.save({
      game: 'asteroides',
      score: this.score(),
      name: this.name(),
    });
    this.saving.set(false);
    if (res.ok) this.saved.set(true);
    else this.saveError.set(res.error ?? 'No se pudo guardar la puntuación.');
  }
}
