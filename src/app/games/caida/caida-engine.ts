/**
 * Motor de Caída (Tetris) — port agnóstico de framework de
 * `references/started-games/03-tetris/game.js`.
 *
 * No importa nada de Angular. Solo toca `window`/`document`/canvas cuando se
 * instancia (el componente lo crea únicamente en navegador). El overlay de
 * PAUSA/GAME OVER se dibuja en el canvas (como Asteroides) y el reinicio es con
 * ESPACIO; además el motor notifica su estado observable vía `onState` para que
 * Angular refleje SCORE/LÍNEAS/NIVEL en el HUD DOM. La vista previa NEXT la
 * dibuja el motor en un segundo canvas opcional.
 *
 * Tetris tiene UNA sola vida: al no caber una pieza nueva, `phase` pasa de
 * `playing` a `gameover` directamente (sin fase intermedia).
 *
 * Testeabilidad: `update(dt)` y los métodos de lógica (`collide`, `tryRotate`,
 * `clearLines`, `hardDrop`, `spawn`, …) no tocan `ctx`, de modo que las reglas
 * (puntos por línea, nivel/velocidad, rotación con kicks, gameover) se pueden
 * testear sin `getContext`. Solo `draw()`/`drawNext()` usan `ctx`.
 */
// ── Constantes (exportadas para tests) ───────────────────────────────────────
export const COLS = 10;
export const ROWS = 20;
/** Color por índice de celda (0 = vacío). Se conservan los colores del original. */
export const COLORS: (string | null)[] = [
  null,
  '#4dd0e1', // 1 I - cian
  '#ffd54f', // 2 O - amarillo
  '#ba68c8', // 3 T - morado
  '#81c784', // 4 S - verde
  '#e57373', // 5 Z - rojo
  '#90caf9', // 6 J - azul claro
  '#ffb74d', // 7 L - naranja
  '#9e9e9e', // 8 N - tuerca (gris metálico)
];
/** Matrices de las 8 piezas (incluida la tuerca, índice 8). */
export const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];
/** Puntos por nº de líneas limpiadas de golpe (×nivel). */
export const LINE_SCORES = [0, 100, 300, 500, 800];
/** Intervalo de caída suave (soft-drop) mientras se mantiene ↓, en ms. */
const SOFT_DROP_MS = 45;
/** Wall-kicks de rotación como constante de módulo (cero asignación por rotación). */
const WALL_KICKS = [0, -1, 1, -2, 2] as const;
/** Rotación horaria pura (transpuesta + inversión). Exportada para tests. */
export function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}
const createBoard = (): number[][] =>
  Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
// ── Skins (paletas dark-only; el componente persiste la selección por juego) ──
export type GameSkin = 'clasico' | 'neon' | 'retro';
/** Colores que el motor usa para dibujar, por skin. Todos legibles sobre oscuro. */
export interface CaidaPalette {
  bg: string; // fondo del tablero y de la vista previa NEXT
  grid: string; // líneas de la rejilla
  blocks: (string | null)[]; // color por índice de celda (0 = vacío; 1..8 incl. la tuerca)
  highlight: string; // banda superior de brillo de cada bloque
  ghostAlpha: number; // opacidad del ghost (proyección del hard-drop)
  overlayBg: string; // velo del overlay PAUSA/GAME OVER
  overlayText: string; // título del overlay
  overlaySub: string; // subtítulo del overlay
  glow: number; // shadowBlur de los bloques (0 = vectores nítidos sin glow)
}
/** Las 3 paletas, todas sobre fondo oscuro (no hay modo claro). */
export const SKIN_PALETTES: Record<GameSkin, CaidaPalette> = {
  // Arcade auténtico: colores originales de las piezas sobre negro, sin resplandor.
  clasico: {
    bg: '#05050c',
    grid: 'rgba(255,255,255,0.07)',
    blocks: COLORS,
    highlight: 'rgba(255,255,255,0.12)',
    ghostAlpha: 0.2,
    overlayBg: 'rgba(5,5,12,0.8)',
    overlayText: '#ffffff',
    overlaySub: 'rgba(255,255,255,0.65)',
    glow: 0,
  },
  // Neón/CRT del Vault: piezas saturadas con resplandor (el look actual del Vault).
  neon: {
    bg: '#06060f',
    grid: 'rgba(255,255,255,0.07)',
    blocks: [
      null,
      '#22e0ff', // I
      '#ffe95c', // O
      '#d36bff', // T
      '#54ff9f', // S
      '#ff5c7a', // Z
      '#5ca8ff', // J
      '#ffa94d', // L
      '#c7d0e0', // N (tuerca)
    ],
    highlight: 'rgba(255,255,255,0.18)',
    ghostAlpha: 0.22,
    overlayBg: 'rgba(6,6,15,0.78)',
    overlayText: '#ffffff',
    overlaySub: 'rgba(255,255,255,0.65)',
    glow: 9,
  },
  // Monocromo CRT: fósforo verde sobre negro verdoso; piezas en gradación de verdes.
  retro: {
    bg: '#02100a',
    grid: 'rgba(59,255,126,0.12)',
    blocks: [
      null,
      '#3bff7e', // I
      '#9dffb8', // O
      '#1fd96a', // T
      '#5cff97', // S
      '#28b45a', // Z
      '#79ffa8', // J
      '#48e67e', // L
      '#c7ffd8', // N (tuerca)
    ],
    highlight: 'rgba(200,255,214,0.18)',
    ghostAlpha: 0.22,
    overlayBg: 'rgba(2,16,10,0.8)',
    overlayText: '#3bff7e',
    overlaySub: 'rgba(59,255,126,0.6)',
    glow: 6,
  },
};
// ── Tipos públicos ────────────────────────────────────────────────────────────
export type CaidaPhase = 'playing' | 'gameover'; // una sola vida: no hay fase 'dead'
export interface CaidaState {
  score: number;
  lines: number;
  level: number;
  phase: CaidaPhase;
}
export interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}
export type TouchAction = 'left' | 'right' | 'rotate' | 'soft' | 'hard';
export interface CaidaEngineOptions {
  /** Se invoca cuando cambia el estado observable (score/lines/level/phase). */
  onState?: (s: CaidaState) => void;
  /** Segundo canvas donde el motor dibuja la vista previa de la siguiente pieza. */
  nextCanvas?: HTMLCanvasElement;
}
const TOUCH_CODE: Record<TouchAction, string> = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  rotate: 'ArrowUp',
  soft: 'ArrowDown',
  hard: 'Space',
};
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);
// ── Motor ───────────────────────────────────────────────────────────────────
export class CaidaEngine {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly onState?: (s: CaidaState) => void;
  private readonly nextCanvas: HTMLCanvasElement | null;
  private readonly nextCtx: CanvasRenderingContext2D | null;
  // Dimensiones actuales (en px CSS); se recalculan con el tamaño del canvas.
  W = COLS * 30;
  H = ROWS * 30;
  private nextW = 96;
  private nextH = 96;
  // Estado del juego (público para poder testear la lógica).
  board: number[][] = createBoard();
  current!: Piece;
  next!: Piece;
  score = 0;
  lines = 0;
  level = 1;
  phase: CaidaPhase = 'playing';
  private dropInterval = 1000;
  private dropAccum = 0;
  private skin: GameSkin = 'clasico';
  private paused = false;
  // Input
  private readonly keys: Record<string, boolean> = {};
  private readonly justPressed: Record<string, boolean> = {};
  // Ciclo de vida
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private running = false;
  private destroyed = false;
  private listening = false;
  private resizeObserver: ResizeObserver | null = null;
  // Buffer offscreen del fondo estático (bg + rejilla); se repinta solo en resize()/setSkin().
  private bgCanvas: HTMLCanvasElement | null = null;
  // Último estado emitido (comparación campo a campo: cero asignaciones por frame en estado estable).
  private lastScore = -1;
  private lastLines = -1;
  private lastLevel = -1;
  private lastPhase: CaidaPhase | '' = '';
  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    this.setKey(e.code, true);
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.setKey(e.code, false);
  };
  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: CaidaEngineOptions = {},
  ) {
    this.onState = opts.onState;
    this.nextCanvas = opts.nextCanvas ?? null;
    this.ctx = canvas.getContext('2d');
    this.nextCtx = this.nextCanvas?.getContext('2d') ?? null;
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
    this.clearJustPressed();
    this.rafId = requestAnimationFrame(this.loop);
  }
  /** Reinicia la partida (equivalente a ESPACIO en gameover). */
  restart() {
    this.initGame();
    this.emitState(true);
    if (!this.destroyed && !this.running) this.resume();
    else this.draw();
  }
  /** Controles táctiles: alimentan los mismos flags que el teclado. */
  setInput(action: TouchAction, pressed: boolean) {
    this.setKey(TOUCH_CODE[action], pressed);
  }
  /** Cambia el skin (clasico/neon/retro); si está pausado/parado, redibuja ya. */
  setSkin(skin: GameSkin) {
    this.skin = skin;
    this.buildBg();
    if (!this.running) this.draw();
    this.drawNext();
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
  getState(): CaidaState {
    return { score: this.score, lines: this.lines, level: this.level, phase: this.phase };
  }
  // ── Input interno ─────────────────────────────────────────────────────────────
  private setKey(code: string, down: boolean) {
    if (down && !this.keys[code]) this.justPressed[code] = true;
    this.keys[code] = down;
  }
  private pressed(code: string): boolean {
    const val = !!this.justPressed[code];
    this.justPressed[code] = false;
    return val;
  }
  private clearJustPressed() {
    for (const k of Object.keys(this.justPressed)) this.justPressed[k] = false;
  }
  private attachListeners() {
    if (this.listening || typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.listening = true;
  }
  private detachListeners() {
    if (!this.listening || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.listening = false;
  }
  // ── Tamaño responsive ─────────────────────────────────────────────────────────
  private observeResize() {
    if (this.resizeObserver || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    if (this.nextCanvas) this.resizeObserver.observe(this.nextCanvas);
  }
  private resize() {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const cssW = this.canvas.clientWidth || this.W || COLS * 30;
    const cssH = this.canvas.clientHeight || this.H || ROWS * 30;
    this.W = cssW;
    this.H = cssH;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.nextCanvas && this.nextCtx) {
      const nw = this.nextCanvas.clientWidth || this.nextW;
      const nh = this.nextCanvas.clientHeight || this.nextH;
      this.nextW = nw;
      this.nextH = nh;
      this.nextCanvas.width = Math.max(1, Math.round(nw * dpr));
      this.nextCanvas.height = Math.max(1, Math.round(nh * dpr));
      this.nextCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.drawNext();
    }
    this.buildBg();
  }
  /** (Re)construye el buffer offscreen del fondo estático (bg + rejilla) al tamaño del plano lógico. */
  private buildBg() {
    if (!this.ctx || typeof document === 'undefined') return;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const pxW = Math.max(1, Math.round(this.W * dpr));
    const pxH = Math.max(1, Math.round(this.H * dpr));
    if (!this.bgCanvas) this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = pxW;
    this.bgCanvas.height = pxH;
    const bctx = this.bgCanvas.getContext('2d');
    if (!bctx) return;
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const p = this.palette;
    bctx.fillStyle = p.bg;
    bctx.fillRect(0, 0, this.W, this.H);
    const cell = Math.min(this.W / COLS, this.H / ROWS);
    const ox = (this.W - cell * COLS) / 2;
    const oy = (this.H - cell * ROWS) / 2;
    bctx.save();
    bctx.translate(ox, oy);
    bctx.strokeStyle = p.grid;
    bctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      bctx.beginPath();
      bctx.moveTo(c * cell, 0);
      bctx.lineTo(c * cell, ROWS * cell);
      bctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      bctx.beginPath();
      bctx.moveTo(0, r * cell);
      bctx.lineTo(COLS * cell, r * cell);
      bctx.stroke();
    }
    bctx.restore();
  }
  // ── Setup de partida ───────────────────────────────────────────────────────────
  private randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1; // 1..8 (incluye la tuerca)
    const shape = PIECES[type]!.map((row) => [...row]);
    return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
  }
  private initGame() {
    this.board = createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.phase = 'playing';
    this.paused = false;
    this.dropInterval = 1000;
    this.dropAccum = 0;
    this.clearJustPressed();
    this.next = this.randomPiece();
    this.spawn();
  }
  // ── Lógica (no toca ctx → testeable sin getContext) ──────────────────────────────
  /** Colisión de `shape` colocada en (ox, oy) contra bordes y celdas ocupadas. */
  collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }
  /** Rota la pieza actual con wall-kicks [0, -1, 1, -2, 2]. */
  tryRotate() {
    const rotated = rotateCW(this.current.shape);
    for (const kick of WALL_KICKS) {
      if (!this.collide(rotated, this.current.x + kick, this.current.y)) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }
  private merge() {
    const { shape, x, y } = this.current;
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) this.board[y + r][x + c] = shape[r][c];
  }
  /** Limpia filas completas, suma puntos (×nivel) y recalcula nivel/velocidad. */
  clearLines(): number {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((v) => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      this.lines += cleared;
      this.score += (LINE_SCORES[cleared] || 0) * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 90);
    }
    return cleared;
  }
  /** Fila donde aterrizaría la pieza actual (proyección para el ghost / hard-drop). */
  ghostY(): number {
    let gy = this.current.y;
    while (!this.collide(this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }
  hardDrop() {
    const gy = this.ghostY();
    this.score += (gy - this.current.y) * 2;
    this.current.y = gy;
    this.lockPiece();
  }
  private lockPiece() {
    this.merge();
    this.clearLines();
    this.spawn();
  }
  /** Saca la pieza siguiente; si no cabe, fin de la partida (una sola vida). */
  spawn() {
    this.current = this.next;
    this.next = this.randomPiece();
    if (this.collide(this.current.shape, this.current.x, this.current.y)) {
      this.phase = 'gameover';
    }
    this.drawNext();
  }
  private stepDown(soft: boolean) {
    if (!this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      if (soft) this.score += 1;
    } else {
      this.lockPiece();
    }
  }
  // ── Update (simulación; no toca ctx) ─────────────────────────────────────────────
  update(dt: number) {
    if (this.phase === 'gameover') {
      if (this.pressed('Space')) this.initGame();
      return;
    }
    // Acciones discretas (una por pulsación).
    if (this.pressed('ArrowLeft') && !this.collide(this.current.shape, this.current.x - 1, this.current.y))
      this.current.x--;
    if (this.pressed('ArrowRight') && !this.collide(this.current.shape, this.current.x + 1, this.current.y))
      this.current.x++;
    const rotUp = this.pressed('ArrowUp');
    const rotX = this.pressed('KeyX');
    if (rotUp || rotX) this.tryRotate();
    if (this.pressed('Space')) this.hardDrop();
    if (this.phase !== 'playing') return; // el hard-drop pudo terminar la partida
    // Caída automática (acelerada mientras se mantiene ↓ = soft-drop).
    const soft = !!this.keys['ArrowDown'];
    this.dropAccum += dt * 1000;
    const interval = soft ? Math.min(this.dropInterval, SOFT_DROP_MS) : this.dropInterval;
    if (this.dropAccum >= interval) {
      this.dropAccum = 0;
      this.stepDown(soft);
    }
  }
  // ── Draw ────────────────────────────────────────────────────────────────────
  /** Paleta activa (colores de dibujo del skin actual). */
  private get palette(): CaidaPalette {
    return SKIN_PALETTES[this.skin];
  }
  /** Celda con relleno plano (sin glow): el glow del skin se reserva a la pieza activa (≤1/frame). */
  private drawBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    cell: number,
    p: CaidaPalette,
    alpha = 1,
  ) {
    if (!colorIndex) return;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.fillStyle = p.blocks[colorIndex]!;
    ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
    ctx.fillStyle = p.highlight;
    ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, Math.max(2, cell * 0.13));
    if (alpha !== 1) ctx.globalAlpha = 1;
  }
  private drawOverlay(title: string, sub: string) {
    const ctx = this.ctx!;
    const p = this.palette;
    const s = Math.min(1, Math.max(0.5, this.W / 300));
    ctx.fillStyle = p.overlayBg;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = p.overlayText;
    ctx.font = `bold ${30 * s}px monospace`;
    ctx.fillText(title, this.W / 2, this.H / 2 - 10 * s);
    ctx.font = `${12 * s}px monospace`;
    ctx.fillStyle = p.overlaySub;
    ctx.fillText(sub, this.W / 2, this.H / 2 + 20 * s);
  }
  private draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const p = this.palette;
    // Fondo estático (bg + rejilla) cacheado en offscreen: un único drawImage por frame.
    if (!this.bgCanvas) this.buildBg();
    if (this.bgCanvas) ctx.drawImage(this.bgCanvas, 0, 0, this.W, this.H);
    else {
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    // Celdas cuadradas centradas (mantiene el aspecto 10×20 pase lo que pase).
    const cell = Math.min(this.W / COLS, this.H / ROWS);
    const ox = (this.W - cell * COLS) / 2;
    const oy = (this.H - cell * ROWS) / 2;
    ctx.save();
    ctx.translate(ox, oy);
    // Tablero
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) this.drawBlock(ctx, c, r, this.board[r][c], cell, p);
    // Ghost + pieza actual (solo jugando)
    if (this.phase === 'playing' && this.current) {
      const gy = this.ghostY();
      for (let r = 0; r < this.current.shape.length; r++)
        for (let c = 0; c < this.current.shape[r].length; c++)
          if (this.current.shape[r][c])
            this.drawBlock(ctx, this.current.x + c, gy + r, this.current.shape[r][c], cell, p, p.ghostAlpha);
      for (let r = 0; r < this.current.shape.length; r++)
        for (let c = 0; c < this.current.shape[r].length; c++)
          if (this.current.shape[r][c])
            this.drawBlock(ctx, this.current.x + c, this.current.y + r, this.current.shape[r][c], cell, p);
    }
    ctx.restore();
    if (this.phase === 'gameover')
      this.drawOverlay('GAME OVER', `PUNTOS: ${this.score}  —  ESPACIO REINICIA`);
    else if (this.paused) this.drawOverlay('EN PAUSA', 'PULSA P PARA REANUDAR');
  }
  private drawNext() {
    const ctx = this.nextCtx;
    if (!ctx || !this.next) return;
    const p = this.palette;
    const W = this.nextW;
    const H = this.nextH;
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, W, H);
    const shape = this.next.shape;
    const cell = Math.min(W, H) / 4;
    const ox = (W - cell * shape[0].length) / 2;
    const oy = (H - cell * shape.length) / 2;
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const color = p.blocks[shape[r][c]]!;
        ctx.save();
        if (p.glow) {
          ctx.shadowBlur = p.glow;
          ctx.shadowColor = color;
        }
        ctx.fillStyle = color;
        ctx.fillRect(ox + c * cell + 1, oy + r * cell + 1, cell - 2, cell - 2);
        ctx.shadowBlur = 0;
        ctx.fillStyle = p.highlight;
        ctx.fillRect(ox + c * cell + 1, oy + r * cell + 1, cell - 2, Math.max(2, cell * 0.13));
        ctx.restore();
      }
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
    if (
      !force &&
      this.score === this.lastScore &&
      this.lines === this.lastLines &&
      this.level === this.lastLevel &&
      this.phase === this.lastPhase
    )
      return;
    this.lastScore = this.score;
    this.lastLines = this.lines;
    this.lastLevel = this.level;
    this.lastPhase = this.phase;
    this.onState(this.getState());
  }
}
