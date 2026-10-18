import { BASE_MS, GRID, MIN_MS, SnakeEngine, SPEED_STEP, START_LENGTH } from './snake-engine';
import { FRUIT_POINTS } from './sprites';
// La lógica del motor no toca `ctx`: `step()`/`update(dt)` operan sobre
// `snake`/`fruit`/`dir`, así que se testea sin `getContext`. Se conduce la
// simulación fijando los campos públicos y llamando `step()`.
const makeEngine = () => new SnakeEngine(document.createElement('canvas'));
describe('snake-engine · estado inicial', () => {
  it('arranca jugable: score 0, longitud inicial, velocidad 1, con comida', () => {
    const e = makeEngine();
    expect(e.getState()).toEqual({ score: 0, length: START_LENGTH, speed: 1, phase: 'playing' });
    expect(e.snake.length).toBe(START_LENGTH);
    expect(e.fruit).not.toBeNull();
    expect(e.stepInterval).toBe(BASE_MS);
  });
});
describe('snake-engine · movimiento y wrap', () => {
  it('un paso avanza la cabeza en la dirección actual', () => {
    const e = makeEngine();
    e.fruit = null; // sin comida para no crecer ni interferir
    const head = { ...e.snake[0] };
    e.step();
    expect(e.snake[0]).toEqual({ x: head.x + 1, y: head.y });
    expect(e.snake.length).toBe(START_LENGTH); // avanza y recorta la cola
  });
  it('wrap toroidal: sale por un borde y reaparece en el opuesto', () => {
    const e = makeEngine();
    e.snake = [{ x: GRID - 1, y: 5 }];
    e.dir = { x: 1, y: 0 };
    e.nextDir = { x: 1, y: 0 };
    e.fruit = null;
    e.step();
    expect(e.snake[0]).toEqual({ x: 0, y: 5 }); // (GRID-1 + 1) % GRID = 0
  });
});
describe('snake-engine · comer y aceleración', () => {
  it('comer suma los puntos de la fruta, alarga +1 y repone comida', () => {
    const e = makeEngine();
    e.snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    e.dir = { x: 1, y: 0 };
    e.nextDir = { x: 1, y: 0 };
    e.fruit = { x: 6, y: 5, name: 'apple' };
    e.score = 0;
    e.step();
    expect(e.score).toBe(FRUIT_POINTS.apple);
    expect(e.snake.length).toBe(4); // crece 1 (no recorta la cola)
    expect(e.fruitsEaten).toBe(1);
    expect(e.fruit).not.toBeNull(); // se repone
  });
  it('comer reduce el intervalo de paso (acelera)', () => {
    const e = makeEngine();
    e.snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ];
    e.dir = { x: 1, y: 0 };
    e.nextDir = { x: 1, y: 0 };
    e.fruit = { x: 6, y: 5, name: 'cherry' };
    e.step();
    expect(e.stepInterval).toBe(Math.max(MIN_MS, BASE_MS - SPEED_STEP * 1));
    expect(e.fruitsEaten).toBe(1);
  });
});
describe('snake-engine · giro y fin de partida', () => {
  it('bloquea la reversa 180° y acepta el giro perpendicular', () => {
    const e = makeEngine(); // dir inicial = derecha, longitud > 1
    e.setInput('left', true); // opuesto a derecha → se ignora
    expect(e.nextDir).toEqual({ x: 1, y: 0 });
    e.setInput('up', true); // perpendicular → se acepta
    expect(e.nextDir).toEqual({ x: 0, y: -1 });
  });
  it('una sola vida: morderse a sí misma → gameover', () => {
    const e = makeEngine();
    // Serpiente en espiral; la cabeza baja hacia un segmento interno (no la cola).
    e.snake = [
      { x: 1, y: 0 }, // cabeza
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 }, // la cabeza entrará aquí
      { x: 2, y: 1 }, // cola
    ];
    e.dir = { x: 0, y: 1 };
    e.nextDir = { x: 0, y: 1 };
    e.fruit = null;
    e.step();
    expect(e.phase).toBe('gameover');
    expect(e.getState().phase).toBe('gameover');
  });
  it('ESPACIO en gameover reinicia la partida', () => {
    const e = makeEngine();
    e.phase = 'gameover';
    e.score = 500;
    (e as unknown as { spaceLatched: boolean }).spaceLatched = true;
    e.update(0.016);
    expect(e.phase).toBe('playing');
    expect(e.score).toBe(0);
    expect(e.snake.length).toBe(START_LENGTH);
  });
});
