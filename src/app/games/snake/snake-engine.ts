/**
 * Motor de Snake — juego nuevo, agnóstico de framework (SPEC 09).
 *
 * No importa nada de Angular. Solo toca `window`/`document`/canvas/`Image` cuando
 * se instancia (el componente lo crea únicamente en navegador). El overlay de
 * PAUSA/GAME OVER se dibuja en el canvas (como Asteroides/Caída) y el reinicio es
 * con ESPACIO; además el motor notifica su estado observable vía `onState` para
 * que Angular refleje SCORE/LONGITUD/VELOCIDAD en el HUD DOM.
 *
 * Reglas: grilla cuadrada `GRID×GRID`, serpiente como lista de celdas, movimiento
 * por TICK (no por frame), giro con bloqueo de reversa 180°, WRAP toroidal en los
 * 4 bordes (los muros no matan), comida en celda libre aleatoria (fruta del atlas),
 * puntos por fruta y crecimiento de 1 segmento al comer, aceleración progresiva, y
 * UNA sola vida: la auto-colisión pasa `phase` de `playing` a `gameover`.
 *
 * Testeabilidad: `update(dt)`, `step()` y la lógica no tocan `ctx`, de modo que las
 * reglas (giro/reversa, wrap, comer/puntuar, auto-colisión, aceleración) se testean
 * sin `getContext`. Solo `draw()` usa `ctx`. El motor NO bindea `P`: la pausa la
 * dispara el componente.
 */
import {
  FRUITS_IMAGE_SRC,
  FRUIT_NAMES,
  FRUIT_POINTS,
  FRUIT_SPRITES,
  type FruitName,
} from './sprites';
// ── Constantes (exportadas para tests) ───────────────────────────────────────
/** Lado de la grilla lógica (tablero GRID×GRID). */
export const GRID = 21;
/** Longitud inicial de la serpiente. */
export const START_LENGTH = 3;
/** Intervalo inicial entre pasos, en ms. */
export const BASE_MS = 140;
/** Reducción del intervalo por cada fruta comida, en ms. */
export const SPEED_STEP = 4;
/** Intervalo mínimo entre pasos (tope de velocidad), en ms. */
export const MIN_MS = 60;
// ── Tipos públicos ────────────────────────────────────────────────────────────
export type SnakePhase = 'playing' | 'gameover'; // una sola vida
export interface SnakeState {
  score: number;
  length: number;
  speed: number;
  phase: SnakePhase;
}
export interface Cell {
  x: number;
  y: number;
}
export interface Fruit {
  x: number;
  y: number;
  name: FruitName;
}
export type TouchAction = 'up' | 'down' | 'left' | 'right';
export interface SnakeEngineOptions {
  /** Se invoca cuando cambia el estado observable (score/length/speed/phase). */
  onState?: (s: SnakeState) => void;
}
// ── Direcciones ───────────────────────────────────────────────────────────────
const DIR = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const;
const DIR_FROM_CODE: Record<string, Cell> = {
  ArrowUp: DIR.up,
  KeyW: DIR.up,
  ArrowDown: DIR.down,
  KeyS: DIR.down,
  ArrowLeft: DIR.left,
  KeyA: DIR.left,
  ArrowRight: DIR.right,
  KeyD: DIR.right,
};
const DIR_FROM_ACTION: Record<TouchAction, Cell> = {
  up: DIR.up,
  down: DIR.down,
  left: DIR.left,
  right: DIR.right,
};
/** Teclas que hacen scroll de la página y hay que neutralizar mientras se juega. */
const PREVENT_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
// ── Motor ───────────────────────────────────────────────────────────────────
export class SnakeEngine {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly onState?: (s: SnakeState) => void;
  private img: HTMLImageElement | null = null;
  private imgReady = false;
  // Dimensiones actuales (en px CSS); se recalculan con el tamaño del canvas.
  W = GRID * 20;
  H = GRID * 20;
  // Estado del juego (público para poder testear la lógica).
  snake: Cell[] = [];
  fruit: Fruit | null = null;
  dir: Cell = { ...DIR.right };
  nextDir: Cell = { ...DIR.right };
  score = 0;
  fruitsEaten = 0;
  phase: SnakePhase = 'playing';
  stepInterval = BASE_MS;
  private stepAccum = 0;
  private paused = false;
  private spaceLatched = false;
  // Ciclo de vida
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private running = false;
  private destroyed = false;
  private listening = false;
  private resizeObserver: ResizeObserver | null = null;
  private lastSnapshotKey = '';
  private readonly onKeyDown = (e: KeyboardEvent) => {
    const d = DIR_FROM_CODE[e.code];
    if (d) this.turn(d);
    if (e.code === 'Space') this.spaceLatched = true;
    if (PREVENT_KEYS.has(e.code)) e.preventDefault();
  };
  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: SnakeEngineOptions = {},
  ) {
    this.onState = opts.onState;
    this.ctx = canvas.getContext('2d');
    this.loadImage();
    this.resize();
    this.initGame();
  }
  // ── API pública ─────────────────────────────────────────────────────────────
  /** Arranca el bucle y la captura de teclado. */
  start() {
    if (this.destroyed || this.running) return;
    this.attachListeners();
    this.observeResize();
    this.resize();
    this.running = true;
    this.paused = false;
    this.lastTime = null;
    this.emitState(true);
    this.rafId = requestAnimationFrame(this.loop);
  }
  /** Congela el bucle y pinta "EN PAUSA" en el canvas. */
  pause() {
    if (!this.running) return;
    this.running = false;
    this.paused = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.draw();
  }
  /** Reanuda el bucle tras una pausa. */
  resume() {
    if (this.destroyed || this.running) return;
    this.paused = false;
    this.running = true;
    this.lastTime = null;
    this.spaceLatched = false;
    this.rafId = requestAnimationFrame(this.loop);
  }
  /** Reinicia la partida (equivalente a ESPACIO en gameover). */
  restart() {
    this.initGame();
    this.emitState(true);
    if (!this.destroyed && !this.running) this.resume();
    else this.draw();
  }
  /** Controles táctiles: giran igual que el teclado (ignoran la reversa 180°). */
  setInput(action: TouchAction, pressed: boolean) {
    if (pressed) this.turn(DIR_FROM_ACTION[action]);
  }
  /** Cancela el RAF, quita listeners de teclado y el observador de tamaño. */
  destroy() {
    this.destroyed = true;
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.detachListeners();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }
  /** Snapshot del estado observable (también útil para el valor inicial del HUD). */
  getState(): SnakeState {
    return {
      score: this.score,
      length: this.snake.length,
      speed: Math.floor(this.fruitsEaten / 5) + 1,
      phase: this.phase,
    };
  }
  // ── Input interno ─────────────────────────────────────────────────────────────
  /** Encola un giro; bloquea la reversa 180° (contra la dirección actual). */
  private turn(d: Cell) {
    if (this.snake.length > 1 && d.x === -this.dir.x && d.y === -this.dir.y) return;
    this.nextDir = d;
  }
  private attachListeners() {
    if (this.listening || typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDown);
    this.listening = true;
  }
  private detachListeners() {
    if (!this.listening || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.onKeyDown);
    this.listening = false;
  }
  // ── Tamaño responsive (grilla cuadrada 1:1) ───────────────────────────────────
  private observeResize() {
    if (this.resizeObserver || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
  }
  private resize() {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const cssW = this.canvas.clientWidth || this.W || GRID * 20;
    const cssH = this.canvas.clientHeight || this.H || GRID * 20;
    this.W = cssW;
    this.H = cssH;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // ── Setup de partida ───────────────────────────────────────────────────────────
  private initGame() {
    const cx = Math.floor(GRID / 2);
    const cy = Math.floor(GRID / 2);
    this.snake = [];
    for (let i = 0; i < START_LENGTH; i++) this.snake.push({ x: cx - i, y: cy });
    this.dir = { ...DIR.right };
    this.nextDir = { ...DIR.right };
    this.score = 0;
    this.fruitsEaten = 0;
    this.phase = 'playing';
    this.paused = false;
    this.stepInterval = BASE_MS;
    this.stepAccum = 0;
    this.spaceLatched = false;
    this.spawnFruit();
  }
  /** Coloca una fruta aleatoria en una celda libre. Sin celdas libres → fin. */
  private spawnFruit() {
    const occupied = new Set(this.snake.map((c) => c.y * GRID + c.x));
    const free: number[] = [];
    for (let i = 0; i < GRID * GRID; i++) if (!occupied.has(i)) free.push(i);
    if (free.length === 0) {
      this.fruit = null;
      this.phase = 'gameover';
      return;
    }
    const idx = free[Math.floor(Math.random() * free.length)];
    const name = FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)];
    this.fruit = { x: idx % GRID, y: Math.floor(idx / GRID), name };
  }
  // ── Lógica (no toca ctx → testeable sin getContext) ──────────────────────────────
  /** Avanza la serpiente un paso de celda. Aplica giro, wrap, comer y auto-colisión. */
  step() {
    this.dir = this.nextDir;
    const head = this.snake[0];
    const nx = (head.x + this.dir.x + GRID) % GRID; // wrap toroidal
    const ny = (head.y + this.dir.y + GRID) % GRID;
    const willGrow = !!this.fruit && this.fruit.x === nx && this.fruit.y === ny;
    // Colisión con el cuerpo. Si no crece, la cola se moverá, así que se excluye.
    const limit = willGrow ? this.snake.length : this.snake.length - 1;
    for (let i = 0; i < limit; i++) {
      if (this.snake[i].x === nx && this.snake[i].y === ny) {
        this.phase = 'gameover';
        return;
      }
    }
    this.snake.unshift({ x: nx, y: ny });
    if (willGrow) {
      this.score += FRUIT_POINTS[this.fruit!.name];
      this.fruitsEaten++;
      this.stepInterval = Math.max(MIN_MS, BASE_MS - SPEED_STEP * this.fruitsEaten);
      this.spawnFruit();
    } else {
      this.snake.pop();
    }
  }
  // ── Update (simulación; no toca ctx) ─────────────────────────────────────────────
  update(dt: number) {
    if (this.phase === 'gameover') {
      if (this.spaceLatched) {
        this.spaceLatched = false;
        this.initGame();
      }
      return;
    }
    this.stepAccum += dt * 1000;
    while (this.stepAccum >= this.stepInterval) {
      this.stepAccum -= this.stepInterval;
      this.step();
      // step() pudo terminar la partida; el cast rompe el estrechamiento del guard previo.
      if ((this.phase as SnakePhase) === 'gameover') {
        this.stepAccum = 0;
        break;
      }
    }
  }
  // ── Draw (único que usa ctx) ──────────────────────────────────────────────────
  private loadImage() {
    if (typeof window === 'undefined' || typeof Image === 'undefined') return;
    const img = new Image();
    img.onload = () => {
      this.imgReady = true;
    };
    img.src = FRUITS_IMAGE_SRC;
    this.img = img;
  }
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  private drawSegment(ctx: CanvasRenderingContext2D, c: Cell, cell: number, head: boolean) {
    const pad = Math.max(1, cell * 0.08);
    const s = cell - pad * 2;
    const r = Math.min(6, s * 0.3);
    ctx.save();
    ctx.shadowBlur = head ? 16 : 10;
    ctx.shadowColor = 'rgba(57,255,150,0.65)';
    ctx.fillStyle = head ? '#9dffc9' : '#2fe6a0';
    this.roundRect(ctx, c.x * cell + pad, c.y * cell + pad, s, s, r);
    ctx.fill();
    ctx.restore();
  }
  private drawFruit(ctx: CanvasRenderingContext2D, fruit: Fruit, cell: number) {
    const sxc = fruit.x * cell;
    const syc = fruit.y * cell;
    if (this.imgReady && this.img) {
      const sp = FRUIT_SPRITES[fruit.name];
      const inner = cell * 0.9;
      const scale = Math.min(inner / sp.w, inner / sp.h);
      const dw = sp.w * scale;
      const dh = sp.h * scale;
      ctx.drawImage(this.img, sp.x, sp.y, sp.w, sp.h, sxc + (cell - dw) / 2, syc + (cell - dh) / 2, dw, dh);
    } else {
      // Marcador neón de reserva mientras carga la imagen (la lógica no depende de ella).
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = 'rgba(255,74,196,0.8)';
      ctx.fillStyle = '#ff4ac4';
      ctx.beginPath();
      ctx.arc(sxc + cell / 2, syc + cell / 2, cell * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  private drawOverlay(title: string, sub: string) {
    const ctx = this.ctx!;
    const s = Math.min(1, Math.max(0.5, this.W / 400));
    ctx.fillStyle = 'rgba(6,6,15,0.78)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${30 * s}px monospace`;
    ctx.fillText(title, this.W / 2, this.H / 2 - 10 * s);
    ctx.font = `${12 * s}px monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(sub, this.W / 2, this.H / 2 + 20 * s);
  }
  private draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, this.W, this.H);
    const cell = Math.min(this.W, this.H) / GRID;
    const ox = (this.W - cell * GRID) / 2;
    const oy = (this.H - cell * GRID) / 2;
    ctx.save();
    ctx.translate(ox, oy);
    // Rejilla
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, GRID * cell);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(GRID * cell, i * cell);
      ctx.stroke();
    }
    // Fruta
    if (this.fruit) this.drawFruit(ctx, this.fruit, cell);
    // Serpiente (de la cola a la cabeza, para que la cabeza quede encima)
    for (let i = this.snake.length - 1; i >= 0; i--)
      this.drawSegment(ctx, this.snake[i], cell, i === 0);
    ctx.restore();
    if (this.phase === 'gameover')
      this.drawOverlay('GAME OVER', `PUNTOS: ${this.score}  —  ESPACIO REINICIA`);
    else if (this.paused) this.drawOverlay('EN PAUSA', 'PULSA P PARA REANUDAR');
  }
  // ── Bucle principal ────────────────────────────────────────────────────────────
  private readonly loop = (ts: number) => {
    if (!this.running) return;
    const dt = this.lastTime === null ? 0 : Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    this.update(dt);
    this.draw();
    this.emitState();
    this.rafId = requestAnimationFrame(this.loop);
  };
  // ── Notificación de estado ───────────────────────────────────────────────────────
  private emitState(force = false) {
    if (!this.onState) return;
    const s = this.getState();
    const key = `${s.score}|${s.length}|${s.speed}|${s.phase}`;
    if (!force && key === this.lastSnapshotKey) return;
    this.lastSnapshotKey = key;
    this.onState(s);
  }
}
