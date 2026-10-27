/**
 * Motor de Bloque Buster (Arkanoid) — port agnóstico de framework de
 * `references/started-games/04-arkanoid/game.js` + `levels.js`.
 *
 * No importa nada de Angular. Solo toca `window`/`document`/canvas/`Audio`
 * cuando se instancia (el componente lo crea únicamente en navegador). Los
 * overlays de PAUSA / GAME OVER / VICTORIA se dibujan en el canvas y el reinicio
 * es con ESPACIO; además el motor notifica su estado observable vía `onState`
 * para que Angular refleje SCORE/VIDAS/NIVEL en el HUD DOM (el HUD interno del
 * original se sustituye por ese HUD DOM, no se duplica aquí).
 *
 * Diferencias respecto al original:
 *  - **Redibujo neón vectorial**: paleta, bola, bloques y explosión se dibujan
 *    con formas + glow en canvas (sin spritesheet PNG).
 *  - **Resolución lógica fija 800×600** (aspecto 4:3): la simulación corre en ese
 *    plano y `resize()` solo escala el backing store con `devicePixelRatio`, de
 *    modo que la rejilla de bloques no se deforma.
 *  - Controles: teclado ←/→, arrastre de puntero sobre el canvas y `setInput`
 *    (botones táctiles ←/→). La pausa (P/Esc) la dispara el componente.
 *
 * Testeabilidad: `update(dt)` y la lógica (`collideAABB`, rebotes, colisión con
 * bloques, avance de nivel/`win`, pérdida de vida/`gameover`) no tocan `ctx`, de
 * modo que las reglas se pueden testear sin `getContext`. Solo `draw()` usa `ctx`.
 */
// ── Constantes (exportadas para tests) ───────────────────────────────────────
/** Plano lógico fijo (aspecto 4:3). La física corre siempre en estas unidades. */
export const W = 800;
export const H = 600;
export const PADDLE_SPEED = 400; // px/s (teclado/botones)
export const BLOCK_COLS = 10;
export const BLOCK_ROWS = 6;
export const BLOCK_W = 64;
export const BLOCK_H = 24;
export const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
export const BLOCKS_ORIGIN_Y = 80;
export const BASE_BALL_VX = 200;
export const BASE_BALL_VY = -300;
export const SCORE_PER_BLOCK = 10;
export const LIVES = 3;
/** Duración de referencia de la explosión (ms), heredada del original. */
export const EXPLOSION_DURATION = 150;
/** Mapeo de los nombres de color lógicos del original a la paleta neón. */
export const BLOCK_NEON: Record<string, string> = {
  red: '#ff4d6d',
  yellow: '#ffd54f',
  cyan: '#22d3ee',
  magenta: '#ff3df5',
  hotpink: '#ff6ec7',
  green: '#39ff14',
  gray: '#aab2d0',
};
// ── Skins (paletas dark-only; el componente persiste la selección por juego) ──
export type GameSkin = 'clasico' | 'neon' | 'retro';
/** Colores que el motor usa para dibujar, por skin. Todos legibles sobre oscuro. */
export interface BloqueBusterPalette {
  bg: string; // fondo del campo
  paddle: string; // barra del jugador
  ball: string; // núcleo de la bola
  ballGlow: string; // halo de la bola (shadowColor)
  blockShine: string; // brillo superior de cada bloque
  blocks: Record<string, string>; // color del bloque por nombre lógico
  overlayBg: string; // velo del overlay (pausa/gameover/win)
  overlayTitle: string; // título del overlay (y color del resplandor del título)
  overlaySub: string; // subtítulo del overlay
  glow: number; // shadowBlur del resplandor (0 = vectores nítidos sin glow)
}
/** Las 3 paletas, todas sobre fondo oscuro (no hay modo claro). */
export const SKIN_PALETTES: Record<GameSkin, BloqueBusterPalette> = {
  // Arcade auténtico: campo negro, bloques en colores sólidos, paleta plateada, sin glow.
  clasico: {
    bg: '#06060a',
    paddle: '#d6e0f5',
    ball: '#ffffff',
    ballGlow: '#ffffff',
    blockShine: 'rgba(255,255,255,0.3)',
    blocks: {
      red: '#f2514e',
      yellow: '#f2c14e',
      cyan: '#4ec9f2',
      magenta: '#c86cf0',
      hotpink: '#f26ca8',
      green: '#5fd24e',
      gray: '#c3ccd9',
    },
    overlayBg: 'rgba(0,0,0,0.72)',
    overlayTitle: '#ffffff',
    overlaySub: 'rgba(255,255,255,0.68)',
    glow: 0,
  },
  // Neón/CRT del Vault: el look actual (bloques neón, paleta y bola cian con resplandor).
  neon: {
    bg: '#06060f',
    paddle: '#22d3ee',
    ball: '#ffffff',
    ballGlow: '#eafcff',
    blockShine: 'rgba(255,255,255,0.22)',
    blocks: BLOCK_NEON,
    overlayBg: 'rgba(4,4,15,0.72)',
    overlayTitle: '#eafcff',
    overlaySub: 'rgba(234,252,255,0.72)',
    glow: 12,
  },
  // Monocromo CRT: fósforo verde en gradación de brillos distinguibles, con bloom tenue.
  retro: {
    bg: '#02100a',
    paddle: '#3bff7e',
    ball: '#d7ffe4',
    ballGlow: '#3bff7e',
    blockShine: 'rgba(199,255,216,0.26)',
    blocks: {
      red: '#1c7a43',
      yellow: '#2aa65a',
      cyan: '#39d672',
      magenta: '#5bf294',
      hotpink: '#86ffb4',
      green: '#b7ffcf',
      gray: '#2f9c5d',
    },
    overlayBg: 'rgba(2,16,10,0.75)',
    overlayTitle: '#9dffb8',
    overlaySub: 'rgba(59,255,126,0.62)',
    glow: 7,
  },
};
// ── Niveles (port fiel de levels.js) ─────────────────────────────────────────
export interface LevelDef {
  speed: number;
  blocks: { col: number; row: number; color: string }[];
}
function buildLevels(): LevelDef[] {
  const rowColors1 = ['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];
  const rowColors2 = ['gray', 'cyan', 'hotpink', 'yellow', 'magenta', 'green'];
  const rowColors4 = ['cyan', 'magenta', 'green', 'yellow', 'hotpink', 'red'];
  const l1: LevelDef['blocks'] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) l1.push({ col, row, color: rowColors1[row] });
  const l2: LevelDef['blocks'] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });
  const l3: LevelDef['blocks'] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0) l3.push({ col, row, color: row < 3 ? 'yellow' : 'magenta' });
  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: LevelDef['blocks'] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col)) l4.push({ col, row, color: rowColors4[row] });
  const l5: LevelDef['blocks'] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross) l5.push({ col, row, color: isCross && !isFrame ? 'hotpink' : 'cyan' });
    }
  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
}
export const LEVELS: LevelDef[] = buildLevels();
export const LEVEL_COUNT = LEVELS.length;
// ── Tipos públicos ────────────────────────────────────────────────────────────
export type BloqueBusterPhase = 'playing' | 'gameover' | 'win';
export interface BloqueBusterState {
  score: number;
  lives: number;
  level: number; // 1..5
  phase: BloqueBusterPhase;
}
export type TouchAction = 'left' | 'right';
export interface BloqueBusterEngineOptions {
  /** Se invoca cuando cambia el estado observable (score/lives/level/phase). */
  onState?: (s: BloqueBusterState) => void;
  /** Estado inicial del silencio (el componente lo lee de localStorage). */
  muted?: boolean;
  /** Skin inicial (el componente lo lee de localStorage); por defecto 'clasico'. */
  skin?: GameSkin;
}
export interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
}
const TOUCH_CODE: Record<TouchAction, string> = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
};
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Space']);
const BOUNCE_SRC = '/games/bloque-buster/ball-bounce.mp3';
const BREAK_SRC = '/games/bloque-buster/break-sound.mp3';
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);
// ── Partícula de explosión neón ──────────────────────────────────────────────
export class Particle {
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;
  constructor(
    public x: number,
    public y: number,
    public color: string,
  ) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(40, 180);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.3, 0.6);
    this.ttl = this.life;
  }
  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D, glow = 8) {
    const alpha = Math.max(0, this.ttl / this.life);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    if (glow) {
      ctx.shadowColor = this.color;
      ctx.shadowBlur = glow;
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}
// ── Motor ───────────────────────────────────────────────────────────────────
export class BloqueBusterEngine {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly onState?: (s: BloqueBusterState) => void;
  // Estado del juego (público para poder testear la lógica).
  paddle = { x: 0, y: 560, w: 81, h: 14 };
  ball = { x: 0, y: 0, w: 16, h: 16, vx: BASE_BALL_VX, vy: BASE_BALL_VY };
  blocks: Block[] = [];
  particles: Particle[] = [];
  score = 0;
  lives = LIVES;
  level = 1;
  phase: BloqueBusterPhase = 'playing';
  private paused = false;
  private muted: boolean;
  private skin: GameSkin = 'clasico';
  // Audio (solo navegador).
  private bounceSound: HTMLAudioElement | null = null;
  private breakSound: HTMLAudioElement | null = null;
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
  // Dedupe de emitState por comparación campo a campo (sin asignar string por frame).
  private lastScore = -1;
  private lastLives = -1;
  private lastLevel = -1;
  private lastPhase: BloqueBusterPhase | '' = '';
  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    this.setKey(e.code, true);
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.setKey(e.code, false);
  };
  /** Arrastre de puntero: mapea clientX a la coordenada lógica y centra la paleta. */
  private readonly onPointer = (e: PointerEvent) => {
    if (this.phase !== 'playing') return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width) return;
    const lx = ((e.clientX - rect.left) / rect.width) * W;
    this.paddle.x = clamp(lx - this.paddle.w / 2, 0, W - this.paddle.w);
  };
  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: BloqueBusterEngineOptions = {},
  ) {
    this.onState = opts.onState;
    this.muted = opts.muted ?? false;
    this.skin = opts.skin ?? 'clasico';
    this.ctx = canvas.getContext('2d');
    if (typeof Audio !== 'undefined') {
      try {
        this.bounceSound = new Audio(BOUNCE_SRC);
        this.breakSound = new Audio(BREAK_SRC);
      } catch {
        /* Audio no disponible: el juego sigue sin sonido. */
      }
    }
    this.resize();
    this.initGame();
  }
  // ── API pública ─────────────────────────────────────────────────────────────
  /** Arranca el bucle y la captura de teclado/puntero. */
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
  /** Reinicia la partida (equivalente a ESPACIO en gameover/win). */
  restart() {
    this.initGame();
    this.emitState(true);
    if (!this.destroyed && !this.running) this.resume();
    else this.draw();
  }
  /** Controles táctiles ←/→: alimentan los mismos flags que el teclado. */
  setInput(action: TouchAction, pressed: boolean) {
    this.setKey(TOUCH_CODE[action], pressed);
  }
  /** Silencia/activa los dos efectos. */
  setMuted(muted: boolean) {
    this.muted = muted;
  }
  /** Cambia el skin (clasico/neon/retro); si está pausado/parado, redibuja ya. */
  setSkin(skin: GameSkin) {
    this.skin = skin;
    if (!this.running) this.draw();
  }
  /** Cancela el RAF, quita listeners de teclado/puntero y el observador de tamaño. */
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
  getState(): BloqueBusterState {
    return { score: this.score, lives: this.lives, level: this.level, phase: this.phase };
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
    this.canvas.addEventListener('pointerdown', this.onPointer);
    this.canvas.addEventListener('pointermove', this.onPointer);
    this.listening = true;
  }
  private detachListeners() {
    if (!this.listening || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('pointerdown', this.onPointer);
    this.canvas.removeEventListener('pointermove', this.onPointer);
    this.listening = false;
  }
  // ── Tamaño responsive (plano lógico fijo 800×600) ─────────────────────────────
  private observeResize() {
    if (this.resizeObserver || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
  }
  private resize() {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const cssW = this.canvas.clientWidth || W;
    const cssH = this.canvas.clientHeight || H;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    // Mapea el plano lógico 800×600 al tamaño real del canvas (preservando 4:3 vía CSS).
    this.ctx?.setTransform((cssW / W) * dpr, 0, 0, (cssH / H) * dpr, 0, 0);
    if (!this.running) this.draw();
  }
  // ── Sonido ──────────────────────────────────────────────────────────────────
  private play(el: HTMLAudioElement | null) {
    if (this.muted || !el) return;
    try {
      const clone = el.cloneNode(true) as HTMLAudioElement;
      clone.volume = 0.5;
      void clone.play()?.catch(() => {});
    } catch {
      /* Reproducción no disponible (p. ej. jsdom): se ignora. */
    }
  }
  // ── Setup de partida ───────────────────────────────────────────────────────────
  private initPaddle() {
    this.paddle.x = (W - this.paddle.w) / 2;
  }
  private initBall() {
    const speed = LEVELS[this.level - 1].speed;
    this.ball.x = this.paddle.x + (this.paddle.w - this.ball.w) / 2;
    this.ball.y = this.paddle.y - this.ball.h;
    this.ball.vx = BASE_BALL_VX * speed;
    this.ball.vy = BASE_BALL_VY * speed;
  }
  /** Carga el nivel n (1..5): genera los bloques y reposiciona la bola. */
  loadLevel(n: number) {
    this.level = n;
    const def = LEVELS[n - 1];
    this.blocks = def.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    this.particles = [];
    this.initBall();
  }
  private initGame() {
    this.score = 0;
    this.lives = LIVES;
    this.phase = 'playing';
    this.paused = false;
    this.particles = [];
    this.clearJustPressed();
    this.initPaddle();
    this.loadLevel(1);
  }
  // ── Lógica (no toca ctx → testeable sin getContext) ──────────────────────────────
  /** Colisión AABB entre la bola y un bloque. */
  collideAABB(block: Block): boolean {
    return (
      this.ball.x < block.x + block.w &&
      this.ball.x + this.ball.w > block.x &&
      this.ball.y < block.y + block.h &&
      this.ball.y + this.ball.h > block.y
    );
  }
  private explode(block: Block) {
    const cx = block.x + block.w / 2;
    const cy = block.y + block.h / 2;
    const color = this.palette.blocks[block.color] ?? '#ffffff';
    for (let i = 0; i < 10; i++) this.particles.push(new Particle(cx, cy, color));
  }
  private loseLife() {
    this.lives--;
    if (this.lives <= 0) {
      this.lives = 0;
      this.phase = 'gameover';
    } else {
      this.initBall();
    }
  }
  // ── Update (simulación; no toca ctx) ─────────────────────────────────────────────
  update(dt: number) {
    // Las partículas siguen avanzando para que la explosión termine su animación;
    // compactación in situ (sin crear array nuevo ni closures por frame).
    const parts = this.particles;
    let pw = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.update(dt);
      if (!p.dead) parts[pw++] = p;
    }
    parts.length = pw;
    if (this.phase !== 'playing') {
      if (this.pressed('Space')) this.initGame();
      return;
    }
    // Paleta (teclado/botones).
    if (this.keys['ArrowLeft']) this.paddle.x = Math.max(0, this.paddle.x - PADDLE_SPEED * dt);
    if (this.keys['ArrowRight'])
      this.paddle.x = Math.min(W - this.paddle.w, this.paddle.x + PADDLE_SPEED * dt);
    // Movimiento de la bola.
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
    // Rebotes en muros (izquierda, derecha, techo).
    if (this.ball.x <= 0) {
      this.ball.x = 0;
      this.ball.vx = Math.abs(this.ball.vx);
      this.play(this.bounceSound);
    }
    if (this.ball.x + this.ball.w >= W) {
      this.ball.x = W - this.ball.w;
      this.ball.vx = -Math.abs(this.ball.vx);
      this.play(this.bounceSound);
    }
    if (this.ball.y <= 0) {
      this.ball.y = 0;
      this.ball.vy = Math.abs(this.ball.vy);
      this.play(this.bounceSound);
    }
    // Rebote en la paleta.
    if (
      this.ball.vy > 0 &&
      this.ball.x + this.ball.w > this.paddle.x &&
      this.ball.x < this.paddle.x + this.paddle.w &&
      this.ball.y + this.ball.h >= this.paddle.y &&
      this.ball.y + this.ball.h <= this.paddle.y + this.paddle.h + 8
    ) {
      this.ball.y = this.paddle.y - this.ball.h;
      this.ball.vy = -Math.abs(this.ball.vy);
      this.play(this.bounceSound);
    }
    // Colisión con bloques (uno por frame); bucle indexado, sin closures.
    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i];
      if (!block.alive) continue;
      if (this.collideAABB(block)) {
        block.alive = false;
        this.explode(block);
        this.score += SCORE_PER_BLOCK;
        this.ball.vy = -this.ball.vy;
        this.play(this.breakSound);
        // ¿Quedan bloques vivos? Escaneo indexado (equivalente a .every() sin closure).
        let anyAlive = false;
        for (let j = 0; j < this.blocks.length; j++)
          if (this.blocks[j].alive) {
            anyAlive = true;
            break;
          }
        if (!anyAlive) {
          if (this.level < LEVEL_COUNT) this.loadLevel(this.level + 1);
          else this.phase = 'win';
        }
        break;
      }
    }
    // Bola perdida.
    if (this.ball.y > H) this.loseLife();
  }
  // ── Draw ──────────────────────────────────────────────────────────────────────
  /** Paleta activa (colores de dibujo del skin actual). */
  private get palette(): BloqueBusterPalette {
    return SKIN_PALETTES[this.skin];
  }
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  private drawBlock(ctx: CanvasRenderingContext2D, block: Block) {
    const p = this.palette;
    const color = p.blocks[block.color] ?? '#ffffff';
    // Relleno plano (sin shadowBlur): el glow se reserva a la bola + overlay (≤2/frame).
    ctx.fillStyle = color;
    this.roundRect(ctx, block.x + 2, block.y + 2, block.w - 4, block.h - 4, 5);
    ctx.fill();
    // Brillo superior.
    ctx.fillStyle = p.blockShine;
    this.roundRect(ctx, block.x + 4, block.y + 4, block.w - 8, (block.h - 8) * 0.42, 3);
    ctx.fill();
  }
  private drawOverlay(title: string, sub: string) {
    const ctx = this.ctx!;
    const p = this.palette;
    ctx.fillStyle = p.overlayBg;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (p.glow) {
      ctx.shadowColor = p.overlayTitle;
      ctx.shadowBlur = p.glow + 6;
    }
    ctx.fillStyle = p.overlayTitle;
    ctx.font = 'bold 56px monospace';
    ctx.fillText(title, W / 2, H / 2 - 18);
    ctx.shadowBlur = 0;
    ctx.font = '18px monospace';
    ctx.fillStyle = p.overlaySub;
    ctx.fillText(sub, W / 2, H / 2 + 28);
  }
  private draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const pal = this.palette;
    // Fondo.
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    // Bloques (bucle indexado, relleno plano).
    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i];
      if (block.alive) this.drawBlock(ctx, block);
    }
    // Partículas (explosión) — rellenos planos (glow = 0), sin sombra por partícula.
    for (let i = 0; i < this.particles.length; i++) this.particles[i].draw(ctx, 0);
    // Paleta (barra del skin activo) — relleno plano (el glow se reserva a la bola).
    ctx.fillStyle = pal.paddle;
    this.roundRect(ctx, this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h, 7);
    ctx.fill();
    // Bola (núcleo claro con halo del skin activo).
    ctx.save();
    if (pal.glow) {
      ctx.shadowColor = pal.ballGlow;
      ctx.shadowBlur = pal.glow + 2;
    }
    ctx.fillStyle = pal.ball;
    ctx.beginPath();
    ctx.arc(this.ball.x + this.ball.w / 2, this.ball.y + this.ball.h / 2, this.ball.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Overlays.
    if (this.phase === 'gameover')
      this.drawOverlay('GAME OVER', `PUNTOS: ${this.score}   —   ESPACIO REINICIA`);
    else if (this.phase === 'win')
      this.drawOverlay('¡COMPLETADO!', `PUNTOS: ${this.score}   —   ESPACIO REINICIA`);
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
    // Dedupe sin asignar por frame: comparación campo a campo; el snapshot (objeto)
    // solo se crea cuando el estado observable cambia de verdad.
    if (
      !force &&
      this.score === this.lastScore &&
      this.lives === this.lastLives &&
      this.level === this.lastLevel &&
      this.phase === this.lastPhase
    )
      return;
    this.lastScore = this.score;
    this.lastLives = this.lives;
    this.lastLevel = this.level;
    this.lastPhase = this.phase;
    this.onState(this.getState());
  }
}
