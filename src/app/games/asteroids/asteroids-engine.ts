/**
 * Motor de Asteroides — port agnóstico de framework de
 * `references/started-games/02-asteroids/game.js`.
 *
 * No importa nada de Angular. Solo toca `window`/`document`/canvas cuando se
 * instancia (el componente lo crea únicamente en navegador). El HUD y el
 * overlay `GAME OVER` dibujados en el canvas se conservan del original; además
 * el motor notifica su estado observable vía `onState` para que Angular lo
 * refleje fuera del canvas.
 *
 * Testeabilidad: `update(dt)` avanza la simulación sin tocar `ctx` y los arrays
 * de entidades son públicos, de modo que la lógica (split, puntos, wrap,
 * power-up, gameover) se puede testear sin `getContext`. Solo `draw()` usa `ctx`.
 */
// ── Utils ───────────────────────────────────────────────────────────────────
export const wrap = (v: number, max: number) => ((v % max) + max) % max;
export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
// ── Constantes ──────────────────────────────────────────────────────────────
const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;
export const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
export const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
export const POINTS = [0, 100, 50, 20]; // puntos por tamaño
// ── Skins (paletas dark-only; el componente persiste la selección por juego) ──
export type GameSkin = 'clasico' | 'neon' | 'retro';
/** Colores que el motor usa para dibujar, por skin. Todos legibles sobre oscuro. */
export interface AsteroidsPalette {
  bg: string; // fondo del campo
  ship: string; // nave + iconos de vida
  asteroid: string; // contorno de asteroides
  bullet: string; // balas
  particle: string; // base "r,g,b" de las partículas (el alpha es dinámico)
  thruster: string; // llama del propulsor
  accent: string; // power-up 3x (recuadro, texto y aviso del HUD)
  hud: string; // texto del HUD y títulos de overlay
  hudSub: string; // subtítulos de overlay
  glow: number; // shadowBlur del resplandor (0 = vectores nítidos sin glow)
}
/** Las 3 paletas, todas sobre fondo oscuro (no hay modo claro). */
export const SKIN_PALETTES: Record<GameSkin, AsteroidsPalette> = {
  // Arcade auténtico: vectores blancos nítidos sobre negro, acento cian sobrio, sin glow.
  clasico: {
    bg: '#000000',
    ship: '#ffffff',
    asteroid: '#ffffff',
    bullet: '#ffffff',
    particle: '255,255,255',
    thruster: 'rgba(255,170,60,0.9)',
    accent: '#7fe9ff',
    hud: '#ffffff',
    hudSub: 'rgba(255,255,255,0.65)',
    glow: 0,
  },
  // Neón/CRT del Vault: cian para la nave, magenta para las rocas, chispas verdes y resplandor.
  neon: {
    bg: '#06060f',
    ship: '#00f5ff',
    asteroid: '#ff2a9d',
    bullet: '#eafcff',
    particle: '0,255,136',
    thruster: 'rgba(255,120,0,0.95)',
    accent: '#00ff88',
    hud: '#eafcff',
    hudSub: 'rgba(234,252,255,0.7)',
    glow: 12,
  },
  // Monocromo CRT: fósforo verde legible sobre un negro verdoso, con bloom tenue.
  retro: {
    bg: '#02100a',
    ship: '#3bff7e',
    asteroid: '#2fe06e',
    bullet: '#c7ffd8',
    particle: '59,255,126',
    thruster: 'rgba(170,255,150,0.85)',
    accent: '#9dffb8',
    hud: '#3bff7e',
    hudSub: 'rgba(59,255,126,0.6)',
    glow: 7,
  },
};
// ── Tipos públicos ────────────────────────────────────────────────────────────
export type AsteroidsPhase = 'playing' | 'dead' | 'gameover';
export interface AsteroidsState {
  score: number;
  lives: number;
  level: number;
  /** Segundos restantes del power-up triple disparo (0 si inactivo). */
  tripleShot: number;
  phase: AsteroidsPhase;
}
export type TouchAction = 'left' | 'right' | 'thrust' | 'shoot';
export interface AsteroidsEngineOptions {
  /** Se invoca cuando cambia el estado observable (score/lives/level/3x/phase). */
  onState?: (s: AsteroidsState) => void;
}
const TOUCH_CODE: Record<TouchAction, string> = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  thrust: 'ArrowUp',
  shoot: 'Space',
};
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);
// ── Bullet ──────────────────────────────────────────────────────────────────
export class Bullet {
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;
  constructor(
    public x: number,
    public y: number,
    angle: number,
  ) {
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }
  update(dt: number, W: number, H: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D, p: AsteroidsPalette) {
    ctx.save();
    if (p.glow) {
      ctx.shadowBlur = p.glow;
      ctx.shadowColor = p.bullet;
    }
    ctx.fillStyle = p.bullet;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
// ── Asteroid ────────────────────────────────────────────────────────────────
export class Asteroid {
  radius: number;
  dead = false;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][] = [];
  constructor(
    public x: number,
    public y: number,
    public size = 3,
  ) {
    this.radius = RADII[size];
    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);
    // Polígono irregular
    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }
  update(dt: number, W: number, H: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }
  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }
  draw(ctx: CanvasRenderingContext2D, p: AsteroidsPalette) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    if (p.glow) {
      ctx.shadowBlur = p.glow;
      ctx.shadowColor = p.asteroid;
    }
    ctx.strokeStyle = p.asteroid;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++) ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}
// ── PowerUp (triple disparo) ──────────────────────────────────────────────────
export class PowerUp {
  vx: number;
  vy: number;
  radius = 12;
  ttl = POWERUP_TTL;
  dead = false;
  constructor(
    public x: number,
    public y: number,
  ) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }
  update(dt: number, W: number, H: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D, p: AsteroidsPalette) {
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
    ctx.save();
    if (p.glow) {
      ctx.shadowBlur = p.glow;
      ctx.shadowColor = p.accent;
    }
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    const r = this.radius * pulse;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.save();
    if (p.glow) {
      ctx.shadowBlur = p.glow;
      ctx.shadowColor = p.accent;
    }
    ctx.fillStyle = p.accent;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('3x', this.x, this.y);
    ctx.restore();
  }
}
// ── Ship ──────────────────────────────────────────────────────────────────────
export class Ship {
  x = 0;
  y = 0;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 3;
  shootCooldown = 0;
  tripleShot = 0;
  dead = false;
  constructor(W: number, H: number) {
    this.reset(W, H);
  }
  reset(W: number, H: number) {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }
  update(dt: number, W: number, H: number, keys: Record<string, boolean>) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;
    const ROT = 3.5; // rad/s
    const THRUST = 260; // px/s²
    const DRAG = 0.987;
    if (keys['ArrowLeft']) this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;
    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }
    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }
  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }
  draw(ctx: CanvasRenderingContext2D, p: AsteroidsPalette) {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    if (p.glow) {
      ctx.shadowBlur = p.glow;
      ctx.shadowColor = p.ship;
    }
    ctx.strokeStyle = p.ship;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo(20, 0); // nariz
    ctx.lineTo(-12, -9); // ala izquierda
    ctx.lineTo(-7, 0); // muesca trasera
    ctx.lineTo(-12, 9); // ala derecha
    ctx.closePath();
    ctx.stroke();
    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = p.thruster;
      if (p.glow) ctx.shadowColor = p.thruster;
      ctx.stroke();
    }
    ctx.restore();
  }
}
// ── Partículas (explosión) ────────────────────────────────────────────────────
export class Particle {
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;
  constructor(
    public x: number,
    public y: number,
  ) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }
  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D, p: AsteroidsPalette) {
    const alpha = this.ttl / this.life;
    const color = `rgba(${p.particle},${alpha.toFixed(2)})`;
    ctx.save();
    if (p.glow) {
      ctx.shadowBlur = p.glow;
      ctx.shadowColor = color;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
    ctx.restore();
  }
}
// ── Motor ───────────────────────────────────────────────────────────────────
export class AsteroidsEngine {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly onState?: (s: AsteroidsState) => void;
  // Dimensiones actuales (en px CSS); se recalculan con el tamaño del canvas.
  W = 800;
  H = 600;
  // Estado del juego (público para poder testear la lógica).
  ship!: Ship;
  bullets: Bullet[] = [];
  asteroids: Asteroid[] = [];
  particles: Particle[] = [];
  powerUps: PowerUp[] = [];
  score = 0;
  lives = 3;
  level = 1;
  phase: AsteroidsPhase = 'playing';
  private deadTimer = 0;
  private powerUpSpawned = false;
  private killsSinceSpawn = 0;
  private skin: GameSkin = 'clasico';
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
  private lastSnapshotKey = '';
  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    this.setKey(e.code, true);
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.setKey(e.code, false);
  };
  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: AsteroidsEngineOptions = {},
  ) {
    this.onState = opts.onState;
    this.ctx = canvas.getContext('2d');
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
    this.lastTime = null;
    this.emitState(true);
    this.rafId = requestAnimationFrame(this.loop);
  }
  /** Congela el bucle (la última imagen queda en pantalla). */
  pause() {
    if (!this.running) return;
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
  /** Reanuda el bucle tras una pausa. */
  resume() {
    if (this.destroyed || this.running) return;
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
  }
  /** Controles táctiles: alimentan los mismos flags que el teclado. */
  setInput(action: TouchAction, pressed: boolean) {
    this.setKey(TOUCH_CODE[action], pressed);
  }
  /** Cambia el skin (clasico/neon/retro); si está pausado/parado, redibuja ya. */
  setSkin(skin: GameSkin) {
    this.skin = skin;
    if (!this.running) this.draw();
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
  getState(): AsteroidsState {
    return {
      score: this.score,
      lives: this.lives,
      level: this.level,
      tripleShot: Math.max(0, this.ship?.tripleShot ?? 0),
      phase: this.phase,
    };
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
  }
  private resize() {
    const cssW = this.canvas.clientWidth || this.W || 800;
    const cssH = this.canvas.clientHeight || this.H || 600;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    this.W = cssW;
    this.H = cssH;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // ── Setup de partida ───────────────────────────────────────────────────────────
  private spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, this.W);
        y = rand(0, this.H);
      } while (Math.hypot(x - this.W / 2, y - this.H / 2) < SAFE_DIST);
      this.asteroids.push(new Asteroid(x, y, 3));
    }
  }
  private initGame() {
    this.ship = new Ship(this.W, this.H);
    this.bullets = [];
    this.asteroids = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.killsSinceSpawn = 0;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.phase = 'playing';
    this.spawnAsteroids(4);
  }
  private nextLevel() {
    this.level++;
    this.bullets = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.killsSinceSpawn = 0;
    this.ship.reset(this.W, this.H);
    this.spawnAsteroids(3 + this.level);
  }
  private explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y));
  }
  private killShip() {
    this.explode(this.ship.x, this.ship.y, 14);
    this.ship.dead = true;
    this.lives--;
    if (this.lives <= 0) {
      this.phase = 'gameover';
    } else {
      this.phase = 'dead';
      this.deadTimer = 2;
    }
  }
  // ── Update (simulación; no toca ctx → testeable sin getContext) ──────────────────
  update(dt: number) {
    if (this.phase === 'gameover') {
      if (this.pressed('Space')) this.initGame();
      this.particles.forEach((p) => p.update(dt));
      this.particles = this.particles.filter((p) => !p.dead);
      return;
    }
    if (this.phase === 'dead') {
      this.deadTimer -= dt;
      this.particles.forEach((p) => p.update(dt));
      this.particles = this.particles.filter((p) => !p.dead);
      this.asteroids.forEach((a) => a.update(dt, this.W, this.H));
      if (this.deadTimer <= 0) {
        this.phase = 'playing';
        this.ship.reset(this.W, this.H);
      }
      return;
    }
    // Disparar
    if (this.pressed('Space')) {
      this.bullets.push(...this.ship.tryShoot());
    }
    this.ship.update(dt, this.W, this.H, this.keys);
    this.bullets.forEach((b) => b.update(dt, this.W, this.H));
    this.asteroids.forEach((a) => a.update(dt, this.W, this.H));
    this.particles.forEach((p) => p.update(dt));
    this.powerUps.forEach((p) => p.update(dt, this.W, this.H));
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.particles = this.particles.filter((p) => !p.dead);
    this.powerUps = this.powerUps.filter((p) => !p.dead);
    for (const p of this.powerUps) {
      if (!p.dead && dist(this.ship, p) < this.ship.radius + p.radius) {
        p.dead = true;
        this.ship.tripleShot = POWERUP_DURATION;
      }
    }
    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of this.bullets) {
      for (const a of this.asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          this.score += POINTS[a.size];
          this.explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!this.powerUpSpawned) {
            this.killsSinceSpawn++;
            const guaranteed = this.killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              this.powerUps.push(new PowerUp(a.x, a.y));
              this.powerUpSpawned = true;
            }
          }
        }
      }
    }
    this.asteroids = this.asteroids.filter((a) => !a.dead).concat(newAsteroids);
    this.bullets = this.bullets.filter((b) => !b.dead);
    // Nave vs asteroide
    if (this.ship.invincible <= 0) {
      for (const a of this.asteroids) {
        if (dist(this.ship, a) < this.ship.radius + a.radius * 0.82) {
          this.killShip();
          break;
        }
      }
    }
    // Nivel completado
    if (this.asteroids.length === 0) this.nextLevel();
  }
  // ── Draw ────────────────────────────────────────────────────────────────────
  /** Paleta activa (colores de dibujo del skin actual). */
  private get palette(): AsteroidsPalette {
    return SKIN_PALETTES[this.skin];
  }
  /** Escala del HUD/overlay dibujado en canvas, proporcional al ancho (1 a 800px). */
  private uiScale(): number {
    return Math.min(1, Math.max(0.45, this.W / 800));
  }
  private drawLifeIcon(x: number, y: number, s = 1) {
    const ctx = this.ctx!;
    const p = this.palette;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.scale(s, s);
    if (p.glow) {
      ctx.shadowBlur = p.glow;
      ctx.shadowColor = p.ship;
    }
    ctx.strokeStyle = p.ship;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  private drawHUD() {
    const ctx = this.ctx!;
    const p = this.palette;
    const s = this.uiScale();
    if (p.glow) {
      ctx.shadowBlur = p.glow;
      ctx.shadowColor = p.hud;
    }
    ctx.fillStyle = p.hud;
    ctx.font = `${15 * s}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE  ${this.score}`, 14 * s, 26 * s);
    ctx.textAlign = 'center';
    ctx.fillText(`NIVEL ${this.level}`, this.W / 2, 26 * s);
    for (let i = 0; i < this.lives; i++) this.drawLifeIcon(this.W - (16 + i * 22) * s, 18 * s, s);
    if (this.ship.tripleShot > 0) {
      ctx.textAlign = 'left';
      ctx.fillStyle = p.accent;
      if (p.glow) ctx.shadowColor = p.accent;
      ctx.fillText(`3x  ${this.ship.tripleShot.toFixed(1)}s`, 14 * s, 46 * s);
    }
    ctx.shadowBlur = 0;
  }
  private drawOverlay(title: string, sub: string) {
    const ctx = this.ctx!;
    const p = this.palette;
    const s = this.uiScale();
    ctx.textAlign = 'center';
    if (p.glow) {
      ctx.shadowBlur = p.glow;
      ctx.shadowColor = p.hud;
    }
    ctx.fillStyle = p.hud;
    ctx.font = `bold ${46 * s}px monospace`;
    ctx.fillText(title, this.W / 2, this.H / 2 - 18 * s);
    ctx.font = `${18 * s}px monospace`;
    ctx.fillStyle = p.hudSub;
    if (p.glow) ctx.shadowColor = p.hudSub;
    ctx.fillText(sub, this.W / 2, this.H / 2 + 22 * s);
    ctx.shadowBlur = 0;
  }
  private draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const p = this.palette;
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, this.W, this.H);
    this.particles.forEach((pt) => pt.draw(ctx, p));
    this.asteroids.forEach((a) => a.draw(ctx, p));
    this.powerUps.forEach((pu) => pu.draw(ctx, p));
    this.bullets.forEach((b) => b.draw(ctx, p));
    this.ship.draw(ctx, p);
    this.drawHUD();
    if (this.phase === 'gameover')
      this.drawOverlay('GAME OVER', `PUNTAJE: ${this.score}   —   ESPACIO PARA REINICIAR`);
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
    const key = `${s.score}|${s.lives}|${s.level}|${s.tripleShot.toFixed(1)}|${s.phase}`;
    if (!force && key === this.lastSnapshotKey) return;
    this.lastSnapshotKey = key;
    this.onState(s);
  }
}
