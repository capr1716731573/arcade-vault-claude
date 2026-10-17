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
import { CaidaEngine, type CaidaPhase, type CaidaState, type TouchAction } from './caida-engine';
type BoardTheme = 'dark' | 'light';
const THEME_KEY = 'av_caida_theme';
@Component({
  selector: 'app-caida',
  imports: [EsNumberPipe, RouterLink],
  templateUrl: './caida.html',
  host: { class: 'av-player fade-in', style: 'display: block' },
})
export class Caida implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly scores = inject(ScoresService);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly nextRef = viewChild.required<ElementRef<HTMLCanvasElement>>('next');
  // Estado reflejado desde el motor (el overlay vive dibujado en el canvas).
  protected readonly score = signal(0);
  protected readonly lines = signal(0);
  protected readonly level = signal(1);
  protected readonly phase = signal<CaidaPhase>('playing');
  protected readonly paused = signal(false);
  protected readonly saved = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly name = signal(inject(SessionService).user()?.name ?? 'INVITADO');
  protected readonly boardTheme = signal<BoardTheme>('dark');
  private engine: CaidaEngine | null = null;
  private pauseKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  constructor() {
    // Solo navegador (no corre en SSR). Los canvas ya están renderizados aquí.
    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      const nextCanvas = this.nextRef().nativeElement;
      // El bucle RAF vive fuera de la zona de Angular para no disparar change
      // detection en cada frame; onState vuelve a la zona solo cuando cambia algo.
      this.zone.runOutsideAngular(() => {
        const engine = new CaidaEngine(canvas, {
          onState: (s) => this.zone.run(() => this.applyState(s)),
          nextCanvas,
        });
        this.engine = engine;
        // Restaura el tema del tablero guardado (preferencia por jugador, solo-navegador).
        const stored = this.readStoredTheme();
        if (stored) {
          this.zone.run(() => this.boardTheme.set(stored));
          engine.setBoardTheme(stored);
        }
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
  private applyState(s: CaidaState) {
    this.score.set(s.score);
    this.lines.set(s.lines);
    this.level.set(s.level);
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
  protected toggleTheme() {
    const next: BoardTheme = this.boardTheme() === 'dark' ? 'light' : 'dark';
    this.boardTheme.set(next);
    this.engine?.setBoardTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* localStorage no disponible (modo privado/SSR): el tema sigue en memoria. */
    }
  }
  private readStoredTheme(): BoardTheme | null {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return v === 'light' || v === 'dark' ? v : null;
    } catch {
      return null;
    }
  }
  protected press(action: TouchAction, pressed: boolean, e: Event) {
    e.preventDefault();
    this.engine?.setInput(action, pressed);
  }
  protected setName(value: string) {
    this.name.set(value.toUpperCase().slice(0, 12));
  }
  protected async save() {
    if (this.phase() !== 'gameover' || this.saved() || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    const res = await this.scores.save({
      game: 'caida',
      score: this.score(),
      name: this.name(),
    });
    this.saving.set(false);
    if (res.ok) this.saved.set(true);
    else this.saveError.set(res.error ?? 'No se pudo guardar la puntuación.');
  }
}
