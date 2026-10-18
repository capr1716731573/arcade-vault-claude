import {
  BASE_BALL_VX,
  BASE_BALL_VY,
  BLOCK_COLS,
  BLOCK_ROWS,
  BloqueBusterEngine,
  H,
  LEVEL_COUNT,
  LEVELS,
  LIVES,
  SCORE_PER_BLOCK,
  W,
  type Block,
} from './bloque-buster-engine';
// La lógica del motor no toca `ctx`: `update(dt)` y los helpers (collideAABB,
// rebotes, colisión con bloques, loadLevel) operan sobre paddle/ball/blocks, así
// que se testea sin `getContext`. Se crea con `muted: true` para que `play()` no
// intente reproducir audio en jsdom.
const makeEngine = () =>
  new BloqueBusterEngine(document.createElement('canvas'), { muted: true });
const mkBlock = (x: number, y: number, color = 'cyan'): Block => ({
  x,
  y,
  w: 64,
  h: 24,
  color,
  alive: true,
});
describe('bloque-buster-engine · arranque y utilidades', () => {
  it('arranca jugable: score 0, 3 vidas, nivel 1 y la rejilla llena (10×6)', () => {
    const e = makeEngine();
    expect(e.getState()).toEqual({ score: 0, lives: LIVES, level: 1, phase: 'playing' });
    expect(e.blocks.length).toBe(BLOCK_COLS * BLOCK_ROWS);
    expect(e.blocks.every((b) => b.alive)).toBe(true);
  });
  it('collideAABB detecta solape y ausencia de solape', () => {
    const e = makeEngine();
    const block = mkBlock(400, 300);
    e.ball.x = 410;
    e.ball.y = 305;
    expect(e.collideAABB(block)).toBe(true);
    e.ball.x = 100;
    e.ball.y = 100;
    expect(e.collideAABB(block)).toBe(false);
  });
  it('LEVELS aplica la velocidad por nivel a la bola (initBall)', () => {
    const e = makeEngine();
    e.loadLevel(1);
    expect(Math.abs(e.ball.vx)).toBeCloseTo(BASE_BALL_VX * LEVELS[0].speed);
    expect(e.ball.vy).toBeCloseTo(BASE_BALL_VY * LEVELS[0].speed);
    e.loadLevel(2);
    expect(Math.abs(e.ball.vx)).toBeCloseTo(BASE_BALL_VX * LEVELS[1].speed);
    expect(e.ball.vy).toBeCloseTo(BASE_BALL_VY * LEVELS[1].speed);
  });
});
describe('bloque-buster-engine · rebotes', () => {
  it('rebota en el muro izquierdo (vx se vuelve positivo, x=0)', () => {
    const e = makeEngine();
    e.blocks = [];
    e.ball.x = 2;
    e.ball.y = 300;
    e.ball.vx = -300;
    e.ball.vy = 0;
    e.update(0.016);
    expect(e.ball.x).toBe(0);
    expect(e.ball.vx).toBeGreaterThan(0);
  });
  it('rebota en el muro derecho (vx se vuelve negativo, x=W-w)', () => {
    const e = makeEngine();
    e.blocks = [];
    e.ball.x = W - e.ball.w - 1;
    e.ball.y = 300;
    e.ball.vx = 300;
    e.ball.vy = 0;
    e.update(0.016);
    expect(e.ball.x).toBe(W - e.ball.w);
    expect(e.ball.vx).toBeLessThan(0);
  });
  it('rebota en el techo (vy se vuelve positivo, y=0)', () => {
    const e = makeEngine();
    e.blocks = [];
    e.ball.x = 400;
    e.ball.y = 1;
    e.ball.vx = 0;
    e.ball.vy = -300;
    e.update(0.016);
    expect(e.ball.y).toBe(0);
    expect(e.ball.vy).toBeGreaterThan(0);
  });
  it('rebota en la paleta (bola bajando → vy negativo)', () => {
    const e = makeEngine();
    e.blocks = [];
    e.paddle.x = 350;
    e.ball.x = 360;
    e.ball.y = e.paddle.y - e.ball.h + 2;
    e.ball.vx = 0;
    e.ball.vy = 200;
    e.update(0.016);
    expect(e.ball.vy).toBeLessThan(0);
    expect(e.ball.y).toBe(e.paddle.y - e.ball.h);
  });
});
describe('bloque-buster-engine · bloques, niveles y vidas', () => {
  it('romper un bloque suma SCORE_PER_BLOCK, lo marca muerto, explota e invierte vy', () => {
    const e = makeEngine();
    // Dos bloques: se golpea el primero, el segundo queda vivo para no avanzar de nivel.
    e.blocks = [mkBlock(400, 300), mkBlock(0, 0, 'red')];
    e.ball.x = 410;
    e.ball.y = 305;
    e.ball.vx = 0;
    e.ball.vy = -200;
    e.update(0.016);
    expect(e.blocks[0].alive).toBe(false);
    expect(e.blocks[1].alive).toBe(true);
    expect(e.score).toBe(SCORE_PER_BLOCK);
    expect(e.particles.length).toBeGreaterThan(0);
    expect(e.ball.vy).toBe(200); // invertida desde -200
    expect(e.level).toBe(1); // aún quedan bloques → no avanza
  });
  it('limpiar todos los bloques avanza al siguiente nivel', () => {
    const e = makeEngine();
    e.level = 1;
    e.blocks = [mkBlock(400, 300)];
    e.ball.x = 410;
    e.ball.y = 305;
    e.ball.vx = 0;
    e.ball.vy = -200;
    e.update(0.016);
    expect(e.level).toBe(2);
  });
  it('limpiar el último nivel pasa a win', () => {
    const e = makeEngine();
    e.level = LEVEL_COUNT;
    e.blocks = [mkBlock(400, 300)];
    e.ball.x = 410;
    e.ball.y = 305;
    e.ball.vx = 0;
    e.ball.vy = -200;
    e.update(0.016);
    expect(e.phase).toBe('win');
  });
  it('perder la bola resta una vida y sigue jugando', () => {
    const e = makeEngine();
    e.blocks = [];
    e.lives = 3;
    e.ball.x = 400;
    e.ball.y = H + 10;
    e.ball.vx = 0;
    e.ball.vy = 0;
    e.update(0.016);
    expect(e.lives).toBe(2);
    expect(e.phase).toBe('playing');
  });
  it('perder la bola con la última vida pasa a gameover', () => {
    const e = makeEngine();
    e.blocks = [];
    e.lives = 1;
    e.ball.x = 400;
    e.ball.y = H + 10;
    e.ball.vx = 0;
    e.ball.vy = 0;
    e.update(0.016);
    expect(e.lives).toBe(0);
    expect(e.phase).toBe('gameover');
  });
});
