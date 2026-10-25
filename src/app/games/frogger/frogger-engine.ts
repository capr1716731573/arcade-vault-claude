/**
 * Motor de Frogger — juego nuevo, agnóstico de framework (SPEC 12).
 *
 * Construido desde cero (como Snake). No importa nada de Angular; solo toca
 * `window`/`document`/canvas cuando se instancia (el componente lo crea solo en
 * navegador). El overlay EN PAUSA/GAME OVER se dibuja en el canvas y el reinicio
 * es con ESPACIO; además notifica su estado observable vía `onState` para que
 * Angular refleje SCORE/VIDAS/NIVEL/TIEMPO en el HUD DOM.
 *
 * Reglas: grilla fija 16×14 de 40px; la rana salta de celda en celda (animación
 * de 120 ms) sin salir por los lados; carretera (filas 8–12) con coches/camiones
 * que matan al solapar; río (filas 1–6) con troncos y tortugas que la arrastran y
 * sobre los que debe apoyarse (las tortugas se sumergen y dejan de dar soporte);
 * 5 bocas destino (fila 0) que al llenarse completan la ronda; temporizador de
 * ronda; 3 vidas; a 0 vidas → gameover.
 *
 * Testeabilidad: `update(dt)` y la lógica no tocan `ctx` (las reglas se testean sin
 * `getContext`). Solo `draw()` usa `ctx` (ver Paso 3). El motor NO bindea `P`: la
 * pausa la dispara el componente.
 */
// ── Constantes (exportadas para tests) ───────────────────────────────────────
/** Columnas de la grilla lógica. */
export const COLS = 16;
/** Filas de la grilla lógica. */
export const ROWS = 14;
/** Lado de la celda en px (plano lógico). */
export const CELL = 40;
/** Plano lógico fijo (no responsive; solo escala el backing store con DPR). */
export const CANVAS_W = COLS * CELL; // 640
export const CANVAS_H = ROWS * CELL; // 560
/** Zonas por índice de fila (0 = arriba). */
export const ROW_GOALS = 0;
export const ROW_RIVER_TOP = 1;
export const ROW_RIVER_BOT = 6;
export const ROW_SAFE_MID = 7;
export const ROW_ROAD_TOP = 8;
export const ROW_ROAD_BOT = 12;
export const ROW_START = 13;
/** Duración de la animación de salto, en ms. */
export const HOP_MS = 120;
/** Vidas iniciales. */
export const LIVES_START = 3;
/** Temporizador de ronda base (s) y su decremento/suelo por nivel. */
export const ROUND_TIME_BASE = 15;
export const TIME_STEP = 1.5;
export const MIN_ROUND_TIME = 8;
/** Puntuación. */
export const SCORE_ADVANCE = 10; // por fila nueva hacia arriba (1ª vez en la ronda)
export const SCORE_GOAL = 50; // por ocupar una boca
export const SCORE_ROUND = 200; // por completar la ronda
export const TIME_BONUS = 10; // × segundos restantes al ocupar una boca
/** Factor de velocidad por nivel. */
export const SPEED_GROWTH = 1.15;
/** Bocas destino: 5 bocas de 2 columnas; `GOAL_COLS[i]` es la columna izquierda. */
export const GOAL_COUNT = 5;
export const GOAL_COLS = [1, 4, 7, 10, 13] as const;
/** Ciclo de inmersión de las tortugas (s visible / s sumergida). */
export const TURTLE_UP_S = 3;
export const TURTLE_DOWN_S = 1.5;
// ── Tipos públicos ────────────────────────────────────────────────────────────
export type FroggerPhase = 'playing' | 'gameover'; // las vidas se gestionan dentro
export interface FroggerState {
  score: number;
  lives: number;
  level: number;
  timeLeft: number; // segundos restantes de la ronda (redondeado hacia arriba)
  phase: FroggerPhase;
}
export type TouchAction = 'up' | 'down' | 'left' | 'right';
export interface FroggerEngineOptions {
  /** Se invoca cuando cambia el estado observable (score/lives/level/timeLeft/phase). */
  onState?: (s: FroggerState) => void;
}
export type EntityKind = 'car' | 'truck' | 'log' | 'turtle';
export interface Entity {
  col: number; // posición continua en celdas (puede salirse y reentrar por el lado opuesto)
  width: number; // ancho en celdas
  kind: EntityKind;
}
export interface Lane {
  row: number;
  dir: 1 | -1;
  speed: number; // celdas por segundo (ya escalada por nivel)
  kind: 'road' | 'river';
  entities: Entity[];
  submergible: boolean; // true en carriles de tortugas
  submerged: boolean; // estado actual de inmersión del carril
  subT: number; // acumulador del ciclo de inmersión
}
export interface Frog {
  col: number; // float mientras deriva en el río; entero al asentarse
  row: number;
  animating: boolean;
  animT: number; // ms transcurridos del salto actual
  fromCol: number;
  fromRow: number;
  targetCol: number;
  targetRow: number;
}
// ── Direcciones ───────────────────────────────────────────────────────────────
const DELTA: Record<TouchAction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};
/** Config base de los carriles (velocidades sin escalar por nivel). */
interface LaneSpec {
  row: number;
  dir: 1 | -1;
  speed: number;
  kind: 'road' | 'river';
  entKind: EntityKind;
  width: number;
  gap: number;
  submergible?: boolean;
}
const LANE_SPECS: readonly LaneSpec[] = [
  // Río (filas 1–6): troncos y tortugas.
  { row: 1, dir: 1, speed: 1.2, kind: 'river', entKind: 'log', width: 3, gap: 2 },
  { row: 2, dir: -1, speed: 1.5, kind: 'river', entKind: 'turtle', width: 3, gap: 2, submergible: true },
  { row: 3, dir: 1, speed: 2.0, kind: 'river', entKind: 'log', width: 2, gap: 2 },
  { row: 4, dir: -1, speed: 1.1, kind: 'river', entKind: 'log', width: 4, gap: 3 },
  { row: 5, dir: 1, speed: 1.6, kind: 'river', entKind: 'turtle', width: 2, gap: 2, submergible: true },
  { row: 6, dir: -1, speed: 1.3, kind: 'river', entKind: 'log', width: 3, gap: 2 },
  // Carretera (filas 8–12): coches y camiones.
  { row: 8, dir: 1, speed: 3.0, kind: 'road', entKind: 'car', width: 1, gap: 4 },
  { row: 9, dir: -1, speed: 1.8, kind: 'road', entKind: 'car', width: 2, gap: 4 },
  { row: 10, dir: 1, speed: 2.5, kind: 'road', entKind: 'car', width: 1, gap: 3 },
  { row: 11, dir: -1, speed: 2.0, kind: 'road', entKind: 'truck', width: 3, gap: 4 },
  { row: 12, dir: 1, speed: 1.5, kind: 'road', entKind: 'car', width: 2, gap: 3 },
];
// ── Teclado ───────────────────────────────────────────────────────────────────
const DIR_FROM_CODE: Record<string, TouchAction> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};
/** Teclas que hacen scroll de la página y hay que neutralizar mientras se juega. */
const PREVENT_KEYS = new Set<string>([...Object.keys(DIR_FROM_CODE), 'Space']);
// ── Skins (paletas dark-only; el componente persiste la selección por juego) ──
export type GameSkin = 'clasico' | 'neon' | 'retro';
/** Colores que el motor usa para dibujar, por skin. Todos legibles sobre oscuro. */
export interface FroggerPalette {
  roadBg: string; // franja de carretera
  riverBg: string; // franja de río
  safeBg: string; // franjas seguras (centro/base)
  goalBg: string; // franja de bocas
  laneDash: string; // líneas discontinuas de carril (decorativas)
  frog: string; // cuerpo de la rana
  frogGlow: string; // color del resplandor de la rana
  frogEye: string; // pupila de la rana
  frogEyeWhite: string; // blanco del ojo de la rana
  car: string[]; // colores de coches (rotados por carril)
  truck: string; // color de los camiones
  vehicleWindow: string; // cabina/ventana de los vehículos
  log: string; // cuerpo del tronco
  logTop: string; // veta superior del tronco
  turtle: string; // caparazón de tortuga emergida
  turtleGlow: string; // resplandor de la tortuga
  turtleSub: string; // tortuga sumergida (apenas visible)
  turtleStroke: string; // borde del caparazón
  goalBorder: string; // marco de la boca
  goalFill: string; // relleno de la boca vacía
  hudText: string; // texto del HUD interno (PTS/NIV)
  timeGood: string; // barra de tiempo (holgado)
  timeWarn: string; // barra de tiempo (medio)
  timeBad: string; // barra de tiempo (apurado)
  timeTrack: string; // fondo de la barra de tiempo
  overlayBg: string; // velo del overlay PAUSA/GAME OVER
  overlayText: string; // título del overlay
  overlaySub: string; // subtítulo del overlay
  glow: number; // shadowBlur de las entidades (0 = vectores nítidos sin glow)
}
/** Las 3 paletas, todas sobre fondo oscuro (no hay modo claro). */
export const SKIN_PALETTES: Record<GameSkin, FroggerPalette> = {
  // Arcade sobrio: colores planos y sólidos sobre casi-negro, sin resplandor.
  clasico: {
    roadBg: '#0c0c10',
    riverBg: '#0b1a2e',
    safeBg: '#13241a',
    goalBg: '#0a1410',
    laneDash: 'rgba(255,255,255,0.14)',
    frog: '#5bd94a',
    frogGlow: 'rgba(0,0,0,0)',
    frogEye: '#0a1410',
    frogEyeWhite: '#f2f2e8',
    car: ['#e85d4a', '#e8c84a', '#6fa8dc'],
    truck: '#b8bcc4',
    vehicleWindow: 'rgba(10,14,20,0.6)',
    log: '#8a5a2b',
    logTop: '#a36a30',
    turtle: '#3fae6f',
    turtleGlow: 'rgba(0,0,0,0)',
    turtleSub: 'rgba(63,174,111,0.25)',
    turtleStroke: 'rgba(10,20,13,0.8)',
    goalBorder: '#e8c84a',
    goalFill: '#143a28',
    hudText: '#dfe6ef',
    timeGood: '#5bd94a',
    timeWarn: '#e8c84a',
    timeBad: '#e8604a',
    timeTrack: 'rgba(255,255,255,0.08)',
    overlayBg: 'rgba(5,6,10,0.82)',
    overlayText: '#ffffff',
    overlaySub: 'rgba(255,255,255,0.7)',
    glow: 0,
  },
  // Neón/CRT del Vault: entidades saturadas con resplandor (el look actual).
  neon: {
    roadBg: '#0a0a12',
    riverBg: '#07131f',
    safeBg: '#0a1f14',
    goalBg: '#06130d',
    laneDash: 'rgba(255,255,255,0.12)',
    frog: '#3bff7e',
    frogGlow: 'rgba(59,255,126,0.7)',
    frogEye: '#06130d',
    frogEyeWhite: '#eafff2',
    car: ['#ff4ac4', '#39b6ff', '#ffd166'],
    truck: '#9aa7c7',
    vehicleWindow: 'rgba(6,10,20,0.6)',
    log: '#8a5a2b',
    logTop: '#b5742e',
    turtle: '#2fe6a0',
    turtleGlow: 'rgba(47,230,160,0.6)',
    turtleSub: 'rgba(47,230,160,0.22)',
    turtleStroke: 'rgba(6,19,13,0.7)',
    goalBorder: '#ffd166',
    goalFill: '#0c3a24',
    hudText: '#cfe8ff',
    timeGood: '#3bff7e',
    timeWarn: '#ffd166',
    timeBad: '#ff4a6e',
    timeTrack: 'rgba(255,255,255,0.08)',
    overlayBg: 'rgba(4,8,12,0.8)',
    overlayText: '#ffffff',
    overlaySub: 'rgba(255,255,255,0.7)',
    glow: 10,
  },
  // Monocromo CRT: fósforo verde sobre negro verdoso; todo en gradación de verdes.
  retro: {
    roadBg: '#02100a',
    riverBg: '#03140d',
    safeBg: '#04180e',
    goalBg: '#021009',
    laneDash: 'rgba(59,255,126,0.16)',
    frog: '#4dff88',
    frogGlow: 'rgba(77,255,136,0.6)',
    frogEye: '#021009',
    frogEyeWhite: '#c7ffd8',
    car: ['#3bff7e', '#9dffb8', '#28b45a'],
    truck: '#79ffa8',
    vehicleWindow: 'rgba(2,16,10,0.7)',
    log: '#2a7a4a',
    logTop: '#48c47a',
    turtle: '#5cff97',
    turtleGlow: 'rgba(92,255,151,0.5)',
    turtleSub: 'rgba(92,255,151,0.22)',
    turtleStroke: 'rgba(2,16,10,0.7)',
    goalBorder: '#9dffb8',
    goalFill: '#0c3a24',
    hudText: '#9dffb8',
    timeGood: '#3bff7e',
    timeWarn: '#9dffb8',
    timeBad: '#1fd96a',
    timeTrack: 'rgba(59,255,126,0.1)',
    overlayBg: 'rgba(2,16,10,0.82)',
    overlayText: '#3bff7e',
    overlaySub: 'rgba(59,255,126,0.6)',
    glow: 6,
  },
};
// ── Motor ───────────────────────────────────────────────────────────────────
export class FroggerEngine {
  protected readonly ctx: CanvasRenderingContext2D | null;
  protected readonly onState?: (s: FroggerState) => void;
  // Plano lógico fijo (en px CSS); el backing store se escala con DPR en resize() (Paso 3).
  W = CANVAS_W;
  H = CANVAS_H;
  // Estado del juego (público para poder testear la lógica).
  frog: Frog = this.makeFrog();
  lanes: Lane[] = [];
  occupied: boolean[] = new Array(GOAL_COUNT).fill(false);
  score = 0;
  lives = LIVES_START;
  level = 1;
  phase: FroggerPhase = 'playing';
  /** Temporizador de ronda interno (float, en segundos). El estado expone su `ceil`. */
  timeLeft = ROUND_TIME_BASE;
  /** Fila más alta alcanzada en la vida actual (para puntuar el avance una sola vez). */
  topRow = ROW_START;
  protected pendingDir: TouchAction | null = null;
  protected spaceLatched = false;
  protected paused = false;
  private skin: GameSkin = 'clasico';
  // Ciclo de vida
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private running = false;
  private destroyed = false;
  private listening = false;
  private resizeObserver: ResizeObserver | null = null;
  private lastSnapshotKey = '';
  private readonly onKeyDown = (e: KeyboardEvent) => {
    const a = DIR_FROM_CODE[e.code];
    if (a) this.setInput(a, true);
    if (e.code === 'Space') this.spaceLatched = true;
    if (PREVENT_KEYS.has(e.code)) e.preventDefault();
  };
  constructor(
    protected readonly canvas: HTMLCanvasElement,
    opts: FroggerEngineOptions = {},
  ) {
    this.onState = opts.onState;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.initGame();
  }
  // ── API pública (ciclo de vida) ──────────────────────────────────────────────
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
  // ── API pública (lógica) ──────────────────────────────────────────────────────
  /** Controles táctiles/teclado: encolan un salto que se consume al asentarse. */
  setInput(action: TouchAction, pressed: boolean) {
    if (pressed) this.pendingDir = action;
  }
  /** Cambia el skin (clasico/neon/retro); si está pausado/parado, redibuja ya. */
  setSkin(skin: GameSkin) {
    this.skin = skin;
    if (!this.running) this.draw();
  }
  /** Reinicia la partida (equivalente a ESPACIO en gameover). */
  restart() {
    this.initGame();
    this.emitState(true);
    if (!this.destroyed && !this.running) this.resume();
    else this.draw();
  }
  /** Snapshot del estado observable (también útil para el valor inicial del HUD). */
  getState(): FroggerState {
    return {
      score: this.score,
      lives: this.lives,
      level: this.level,
      timeLeft: Math.max(0, Math.ceil(this.timeLeft)),
      phase: this.phase,
    };
  }
  // ── Setup de partida ───────────────────────────────────────────────────────────
  protected initGame() {
    this.score = 0;
    this.lives = LIVES_START;
    this.level = 1;
    this.phase = 'playing';
    this.occupied = new Array(GOAL_COUNT).fill(false);
    this.lanes = this.buildLanes(1);
    this.timeLeft = this.roundTime(1);
    this.frog = this.makeFrog();
    this.topRow = ROW_START;
    this.pendingDir = null;
    this.spaceLatched = false;
    this.paused = false;
  }
  private makeFrog(): Frog {
    const col = Math.floor(COLS / 2);
    return {
      col,
      row: ROW_START,
      animating: false,
      animT: 0,
      fromCol: col,
      fromRow: ROW_START,
      targetCol: col,
      targetRow: ROW_START,
    };
  }
  /** Temporizador de ronda para un nivel (decrece por nivel, con suelo). */
  private roundTime(level: number): number {
    return Math.max(MIN_ROUND_TIME, ROUND_TIME_BASE - (level - 1) * TIME_STEP);
  }
  /** Construye los carriles de un nivel (velocidades escaladas, entidades con huecos). */
  buildLanes(level: number): Lane[] {
    const factor = Math.pow(SPEED_GROWTH, level - 1);
    return LANE_SPECS.map((spec) => {
      const stride = spec.width + spec.gap;
      const entities: Entity[] = [];
      for (let c = 0; c < COLS; c += stride) {
        entities.push({ col: c, width: spec.width, kind: spec.entKind });
      }
      return {
        row: spec.row,
        dir: spec.dir,
        speed: spec.speed * factor,
        kind: spec.kind,
        entities,
        submergible: spec.submergible ?? false,
        submerged: false,
        subT: 0,
      };
    });
  }
  // ── Zonas ───────────────────────────────────────────────────────────────────
  private isRiver(row: number): boolean {
    return row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
  }
  private isRoad(row: number): boolean {
    return row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;
  }
  private laneForRow(row: number): Lane | undefined {
    return this.lanes.find((l) => l.row === row);
  }
  /** ¿La columna `fc` (centro de la rana) cae dentro de [col, col+width)? (con wrap). */
  private spans(col: number, width: number, fc: number): boolean {
    for (const base of [col, col - COLS, col + COLS]) {
      if (fc >= base && fc < base + width) return true;
    }
    return false;
  }
  // ── Lógica (no toca ctx → testeable sin getContext) ──────────────────────────────
  /** Avanza las entidades de todos los carriles y el ciclo de inmersión de las tortugas. */
  private moveEntities(dt: number) {
    for (const lane of this.lanes) {
      for (const ent of lane.entities) {
        ent.col += lane.speed * lane.dir * dt;
        if (lane.dir > 0 && ent.col >= COLS) ent.col = -ent.width;
        else if (lane.dir < 0 && ent.col + ent.width <= 0) ent.col = COLS;
      }
      if (lane.submergible) {
        lane.subT += dt;
        if (!lane.submerged && lane.subT >= TURTLE_UP_S) {
          lane.submerged = true;
          lane.subT = 0;
        } else if (lane.submerged && lane.subT >= TURTLE_DOWN_S) {
          lane.submerged = false;
          lane.subT = 0;
        }
      }
    }
  }
  /** Entidad del río que sostiene a la rana, o null (agua / tortuga sumergida). */
  getSupport(): Entity | null {
    const lane = this.laneForRow(this.frog.row);
    if (!lane || lane.kind !== 'river') return null;
    if (lane.submergible && lane.submerged) return null;
    const fc = this.frog.col + 0.5;
    for (const ent of lane.entities) {
      if (this.spans(ent.col, ent.width, fc)) return ent;
    }
    return null;
  }
  /** ¿Un vehículo de carretera solapa a la rana en su fila? */
  checkRoadCollision(): boolean {
    const lane = this.laneForRow(this.frog.row);
    if (!lane || lane.kind !== 'road') return false;
    const fc = this.frog.col + 0.5;
    return lane.entities.some((ent) => this.spans(ent.col, ent.width, fc));
  }
  /** Inicia un salto de 1 celda (si no se sale por los bordes laterales/verticales). */
  private startHop(action: TouchAction) {
    const base = Math.round(this.frog.col);
    const tc = base + DELTA[action].dc;
    const tr = this.frog.row + DELTA[action].dr;
    if (tc < 0 || tc > COLS - 1) return; // no salir por los lados
    if (tr < 0 || tr > ROWS - 1) return;
    this.frog.fromCol = this.frog.col;
    this.frog.fromRow = this.frog.row;
    this.frog.targetCol = tc;
    this.frog.targetRow = tr;
    this.frog.animating = true;
    this.frog.animT = 0;
  }
  /** Completa el salto y resuelve la celda destino (meta / avance / muerte). */
  private finishHop() {
    this.frog.col = this.frog.targetCol;
    this.frog.row = this.frog.targetRow;
    this.frog.animating = false;
    if (this.frog.row === ROW_GOALS) {
      this.resolveGoal();
      return;
    }
    if (this.frog.row < this.topRow) {
      this.score += SCORE_ADVANCE;
      this.topRow = this.frog.row;
    }
    if (this.isRiver(this.frog.row) && !this.getSupport()) {
      this.killFrog();
      return;
    }
    if (this.isRoad(this.frog.row) && this.checkRoadCollision()) {
      this.killFrog();
    }
  }
  /** Resuelve la llegada a la fila de bocas: ocupar+puntuar o morir. */
  private resolveGoal() {
    const fc = Math.round(this.frog.col);
    const g = GOAL_COLS.findIndex((c) => fc >= c && fc <= c + 1);
    if (g === -1 || this.occupied[g]) {
      this.killFrog();
      return;
    }
    this.occupied[g] = true;
    this.score += SCORE_GOAL + Math.floor(this.timeLeft) * TIME_BONUS;
    if (this.occupied.every(Boolean)) this.completeRound();
    else this.repositionFrog();
  }
  /** Ronda completada: sube nivel, acelera, acorta el tiempo y resetea bocas/rana. */
  private completeRound() {
    this.level += 1;
    this.score += SCORE_ROUND;
    this.occupied = new Array(GOAL_COUNT).fill(false);
    this.lanes = this.buildLanes(this.level);
    this.repositionFrog();
  }
  /** Muerte: resta vida; a 0 → gameover; si quedan, reposiciona en la base. */
  private killFrog() {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.phase = 'gameover';
      return;
    }
    this.repositionFrog();
  }
  /** Devuelve la rana a la base y reinicia temporizador/avance (conserva las bocas). */
  private repositionFrog() {
    this.frog = this.makeFrog();
    this.topRow = ROW_START;
    this.timeLeft = this.roundTime(this.level);
    this.pendingDir = null;
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
    this.moveEntities(dt);
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.killFrog();
      return;
    }
    if (this.frog.animating) {
      this.frog.animT += dt * 1000;
      if (this.frog.animT >= HOP_MS) this.finishHop();
      return;
    }
    if (this.pendingDir) {
      const action = this.pendingDir;
      this.pendingDir = null;
      this.startHop(action);
      return;
    }
    // Rana asentada: resolver el entorno de la celda actual.
    if (this.isRiver(this.frog.row)) {
      const support = this.getSupport();
      if (!support) {
        this.killFrog();
        return;
      }
      this.frog.col += this.laneForRow(this.frog.row)!.speed * this.laneForRow(this.frog.row)!.dir * dt;
      if (this.frog.col + 0.5 < 0 || this.frog.col + 0.5 >= COLS) this.killFrog();
    } else if (this.isRoad(this.frog.row)) {
      if (this.checkRoadCollision()) this.killFrog();
    }
  }
  // ── Listeners / tamaño (plano lógico fijo 640×560) ────────────────────────────
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
  private observeResize() {
    if (this.resizeObserver || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
  }
  private resize() {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const cssW = this.canvas.clientWidth || CANVAS_W;
    const cssH = this.canvas.clientHeight || CANVAS_H;
    this.W = cssW;
    this.H = cssH;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    // Mapea el plano lógico 640×560 al tamaño real del canvas (preservando 16:14 vía CSS).
    this.ctx?.setTransform((cssW / CANVAS_W) * dpr, 0, 0, (cssH / CANVAS_H) * dpr, 0, 0);
    if (!this.running) this.draw();
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
    const key = `${s.score}|${s.lives}|${s.level}|${s.timeLeft}|${s.phase}`;
    if (!force && key === this.lastSnapshotKey) return;
    this.lastSnapshotKey = key;
    this.onState(s);
  }
  // ── Draw (único que usa ctx; dibuja en coordenadas lógicas 640×560) ──────────────
  /** Paleta activa (colores de dibujo del skin actual). */
  private get palette(): FroggerPalette {
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
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  private drawZones(ctx: CanvasRenderingContext2D, p: FroggerPalette) {
    for (let r = 0; r < ROWS; r++) {
      let bg = p.safeBg;
      if (r === ROW_GOALS) bg = p.goalBg;
      else if (this.isRiver(r)) bg = p.riverBg;
      else if (this.isRoad(r)) bg = p.roadBg;
      ctx.fillStyle = bg;
      ctx.fillRect(0, r * CELL, CANVAS_W, CELL);
    }
    // Líneas de carril de la carretera (decorativas).
    ctx.strokeStyle = p.laneDash;
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 14]);
    for (let r = ROW_ROAD_TOP; r < ROW_ROAD_BOT; r++) {
      const y = (r + 1) * CELL;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  private drawEntity(
    ctx: CanvasRenderingContext2D,
    lane: Lane,
    ent: Entity,
    ox: number,
    p: FroggerPalette,
  ) {
    const x = ent.col * CELL + ox;
    const y = lane.row * CELL;
    const w = ent.width * CELL;
    if (x + w < 0 || x > CANVAS_W) return;
    const pad = 4;
    if (ent.kind === 'turtle') {
      const submerged = lane.submergible && lane.submerged;
      for (let i = 0; i < ent.width; i++) {
        const cx = x + i * CELL + CELL / 2;
        const cy = y + CELL / 2;
        ctx.save();
        if (!submerged && p.glow) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.turtleGlow;
        }
        ctx.fillStyle = submerged ? p.turtleSub : p.turtle;
        ctx.beginPath();
        ctx.arc(cx, cy, CELL * 0.34, 0, Math.PI * 2);
        ctx.fill();
        if (!submerged) {
          ctx.strokeStyle = p.turtleStroke;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      }
      return;
    }
    ctx.save();
    if (ent.kind === 'log') {
      ctx.fillStyle = p.log;
      this.roundRect(ctx, x + 2, y + pad, w - 4, CELL - pad * 2, 8);
      ctx.fill();
      ctx.fillStyle = p.logTop;
      ctx.fillRect(x + 6, y + pad + 3, w - 12, 3);
    } else {
      const color = ent.kind === 'truck' ? p.truck : p.car[lane.row % p.car.length];
      if (p.glow) {
        ctx.shadowBlur = p.glow;
        ctx.shadowColor = color;
      }
      ctx.fillStyle = color;
      this.roundRect(ctx, x + 3, y + pad, w - 6, CELL - pad * 2, 6);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = p.vehicleWindow;
      const cabX = lane.dir > 0 ? x + w - 12 : x + 4;
      ctx.fillRect(cabX, y + pad + 3, 8, CELL - pad * 2 - 6);
    }
    ctx.restore();
  }
  private drawGoals(ctx: CanvasRenderingContext2D, p: FroggerPalette) {
    for (let g = 0; g < GOAL_COUNT; g++) {
      const x = GOAL_COLS[g] * CELL;
      const w = 2 * CELL;
      const y = ROW_GOALS * CELL;
      ctx.save();
      ctx.fillStyle = p.goalFill;
      this.roundRect(ctx, x + 3, y + 4, w - 6, CELL - 8, 8);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = p.goalBorder;
      ctx.stroke();
      if (this.occupied[g]) {
        ctx.fillStyle = p.frog;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + CELL / 2, CELL * 0.26, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  private drawFrog(ctx: CanvasRenderingContext2D, p: FroggerPalette) {
    let fc = this.frog.col;
    let fr = this.frog.row;
    if (this.frog.animating) {
      const t = Math.min(1, this.frog.animT / HOP_MS);
      fc = this.frog.fromCol + (this.frog.targetCol - this.frog.fromCol) * t;
      fr = this.frog.fromRow + (this.frog.targetRow - this.frog.fromRow) * t;
    }
    const cx = fc * CELL + CELL / 2;
    const cy = fr * CELL + CELL / 2;
    ctx.save();
    if (p.glow) {
      ctx.shadowBlur = p.glow + 4;
      ctx.shadowColor = p.frogGlow;
    }
    ctx.fillStyle = p.frog;
    ctx.beginPath();
    ctx.ellipse(cx, cy, CELL * 0.32, CELL * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = p.frogEyeWhite;
    ctx.beginPath();
    ctx.arc(cx - 7, cy - 8, 4, 0, Math.PI * 2);
    ctx.arc(cx + 7, cy - 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.frogEye;
    ctx.beginPath();
    ctx.arc(cx - 7, cy - 8, 2, 0, Math.PI * 2);
    ctx.arc(cx + 7, cy - 8, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  private drawHUD(ctx: CanvasRenderingContext2D, p: FroggerPalette) {
    ctx.save();
    ctx.font = 'bold 12px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = p.hudText;
    ctx.textAlign = 'left';
    ctx.fillText(`PTS ${this.score}`, 6, 5);
    ctx.textAlign = 'center';
    ctx.fillText(`NIV ${this.level}`, CANVAS_W / 2, 5);
    for (let i = 0; i < this.lives; i++) {
      ctx.fillStyle = p.frog;
      ctx.beginPath();
      ctx.arc(CANVAS_W - 10 - i * 14, 11, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const ratio = Math.max(0, Math.min(1, this.timeLeft / this.roundTime(this.level)));
    const barColor = ratio > 0.5 ? p.timeGood : ratio > 0.25 ? p.timeWarn : p.timeBad;
    ctx.fillStyle = p.timeTrack;
    ctx.fillRect(0, CANVAS_H - 5, CANVAS_W, 5);
    ctx.fillStyle = barColor;
    ctx.fillRect(0, CANVAS_H - 5, CANVAS_W * ratio, 5);
    ctx.restore();
  }
  private drawOverlay(ctx: CanvasRenderingContext2D, title: string, sub: string, p: FroggerPalette) {
    ctx.fillStyle = p.overlayBg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = p.overlayText;
    ctx.font = 'bold 34px monospace';
    ctx.fillText(title, CANVAS_W / 2, CANVAS_H / 2 - 8);
    ctx.font = '13px monospace';
    ctx.fillStyle = p.overlaySub;
    ctx.fillText(sub, CANVAS_W / 2, CANVAS_H / 2 + 20);
  }
  private draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const p = this.palette;
    this.drawZones(ctx, p);
    for (const lane of this.lanes) {
      for (const ent of lane.entities) {
        for (const ox of [0, -CANVAS_W, CANVAS_W]) this.drawEntity(ctx, lane, ent, ox, p);
      }
    }
    this.drawGoals(ctx, p);
    this.drawFrog(ctx, p);
    this.drawHUD(ctx, p);
    if (this.phase === 'gameover')
      this.drawOverlay(ctx, 'GAME OVER', `PUNTOS: ${this.score}  —  ESPACIO REINICIA`, p);
    else if (this.paused) this.drawOverlay(ctx, 'EN PAUSA', 'PULSA P PARA REANUDAR', p);
  }
}
