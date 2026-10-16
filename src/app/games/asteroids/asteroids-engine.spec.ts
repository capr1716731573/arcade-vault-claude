import { Asteroid, AsteroidsEngine, Bullet, POINTS, PowerUp, RADII, wrap } from './asteroids-engine';
// La lógica del motor no toca `ctx`: `update(dt)` avanza la simulación y los
// arrays de entidades son públicos, así que se testea sin `getContext`.
describe('asteroids-engine · utils y entidades', () => {
  it('wrap envuelve de forma toroidal', () => {
    expect(wrap(-5, 100)).toBe(95);
    expect(wrap(105, 100)).toBe(5);
    expect(wrap(50, 100)).toBe(50);
  });
  it('POINTS da los puntos por tamaño (grande 20 / mediano 50 / pequeño 100)', () => {
    expect(POINTS[3]).toBe(20);
    expect(POINTS[2]).toBe(50);
    expect(POINTS[1]).toBe(100);
  });
  it('Asteroid.split reduce el tamaño en 1 y el tamaño 1 no se parte', () => {
    const big = new Asteroid(0, 0, 3).split();
    expect(big.length).toBe(2);
    expect(big.every((a) => a.size === 2)).toBe(true);
    const mid = new Asteroid(0, 0, 2).split();
    expect(mid.length).toBe(2);
    expect(mid.every((a) => a.size === 1)).toBe(true);
    expect(new Asteroid(0, 0, 1).split()).toEqual([]);
    expect(new Asteroid(0, 0, 2).radius).toBe(RADII[2]);
  });
});
describe('asteroids-engine · simulación', () => {
  const makeEngine = () => new AsteroidsEngine(document.createElement('canvas'));
  it('arranca en estado jugable con 3 vidas, nivel 1 y score 0', () => {
    const e = makeEngine();
    expect(e.getState()).toMatchObject({ score: 0, lives: 3, level: 1, phase: 'playing' });
    expect(e.asteroids.length).toBe(4);
  });
  it('una bala sobre un asteroide suma puntos y lo parte', () => {
    const e = makeEngine();
    e.ship.invincible = 10; // evita que la nave muera y enturbie el test
    e.asteroids = [new Asteroid(100, 100, 3)];
    e.bullets = [new Bullet(100, 100, 0)];
    const before = e.score;
    e.update(0.016);
    expect(e.score).toBe(before + POINTS[3]);
    expect(e.asteroids.length).toBe(2);
    expect(e.asteroids.every((a) => a.size === 2)).toBe(true);
  });
  it('recoger el power-up activa el triple disparo', () => {
    const e = makeEngine();
    e.powerUps = [new PowerUp(e.ship.x, e.ship.y)];
    expect(e.ship.tripleShot).toBe(0);
    e.update(0.016);
    expect(e.ship.tripleShot).toBe(5);
  });
  it('agotar las 3 vidas lleva a gameover', () => {
    const e = makeEngine();
    const crashOnce = () => {
      e.ship.invincible = 0;
      e.asteroids = [new Asteroid(e.ship.x, e.ship.y, 1)];
      e.update(0.016);
    };
    crashOnce();
    expect(e.lives).toBe(2);
    expect(e.phase).toBe('dead');
    e.update(2.5); // reaparece
    expect(e.phase).toBe('playing');
    crashOnce();
    expect(e.lives).toBe(1);
    e.update(2.5);
    crashOnce();
    expect(e.lives).toBe(0);
    expect(e.phase).toBe('gameover');
    expect(e.getState().phase).toBe('gameover');
  });
});
