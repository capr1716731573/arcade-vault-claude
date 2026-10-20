import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { EsNumberPipe } from '../../shared/es-number.pipe';
import { ScoresService } from '../../services/scores.service';
import { SessionService } from '../../services/session.service';
import {
  SnakeEngine,
  type GameSkin,
  type SnakePhase,
  type SnakeState,
  type TouchAction,
} from './snake-engine';
const SKIN_KEY = 'av_snake_skin';
@Component({
  selector: 'app-snake',
  imports: [EsNumberPipe, RouterLink],
  templateUrl: './snake.html',
  host: { class: 'av-player fade-in', style: 'display: block' },
})
export class Snake implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly scores = inject(ScoresService);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  // Estado reflejado desde el motor (los overlays viven dibujados en el canvas).
  protected readonly score = signal(0);
  protected readonly length = signal(0);
  protected readonly speed = signal(1);
  protected readonly phase = signal<SnakePhase>('playing');
  protected readonly paused = signal(false);
  protected readonly saved = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly name = signal(inject(SessionService).user()?.name ?? 'INVITADO');
  // Skin del juego (dark-only): clasico (default), neon, retro. Persistido por juego.
  protected readonly skin = signal<GameSkin>('clasico');
  protected readonly skinOptions: readonly { id: GameSkin; label: string }[] = [
    { id: 'clasico', label: 'CLÁSICO' },
    { id: 'neon', label: 'NEÓN' },
    { id: 'retro', label: 'RETRO' },
  ];
  private engine: SnakeEngine | null = null;
  private pauseKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  constructor() {
    // Solo navegador (no corre en SSR). El canvas ya está renderizado aquí.
    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      // El bucle RAF vive fuera de la zona de Angular para no disparar change
      // detection en cada frame; onState vuelve a la zona solo cuando cambia algo.
      this.zone.runOutsideAngular(() => {
        const engine = new SnakeEngine(canvas, {
          onState: (s) => this.zone.run(() => this.applyState(s)),
        });
        this.engine = engine;
        // Restaura el skin guardado (preferencia por juego, solo-navegador).
        const storedSkin = this.readStoredSkin();
        if (storedSkin) {
          this.zone.run(() => this.skin.set(storedSkin));
          engine.setSkin(storedSkin);
        }
        engine.start();
        // La pausa la dispara el componente (P/Esc): el motor no bindea P.
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
  private applyState(s: SnakeState) {
    this.score.set(s.score);
    this.length.set(s.length);
    this.speed.set(s.speed);
    this.phase.set(s.phase);
    // Al reiniciar la partida (ESPACIO en el canvas) se vuelve a permitir guardar.
    if (s.phase === 'playing' && (this.saved() || this.saveError())) {
      this.saved.set(false);
      this.saveError.set(null);
    }
  }
  protected togglePause() {
    const engine = this.engine;
    if (!engine || this.phase() === 'gameover') return;
    const next = !this.paused();
    this.paused.set(next);
    if (next) engine.pause();
    else engine.resume();
  }
  protected press(action: TouchAction, pressed: boolean, e: Event) {
    e.preventDefault();
    this.engine?.setInput(action, pressed);
  }
  protected selectSkin(skin: GameSkin) {
    if (skin === this.skin()) return;
    this.skin.set(skin);
    this.engine?.setSkin(skin);
    try {
      localStorage.setItem(SKIN_KEY, skin);
    } catch {
      /* localStorage no disponible (modo privado/SSR): el skin sigue en memoria. */
    }
  }
  private readStoredSkin(): GameSkin | null {
    try {
      const v = localStorage.getItem(SKIN_KEY);
      return v === 'clasico' || v === 'neon' || v === 'retro' ? v : null;
    } catch {
      return null;
    }
  }
  protected setName(value: string) {
    this.name.set(value.toUpperCase().slice(0, 12));
  }
  protected async save() {
    if (this.phase() !== 'gameover' || this.saved() || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    const res = await this.scores.save({
      game: 'snake',
      score: this.score(),
      name: this.name(),
    });
    this.saving.set(false);
    if (res.ok) this.saved.set(true);
    else this.saveError.set(res.error ?? 'No se pudo guardar la puntuación.');
  }
}
