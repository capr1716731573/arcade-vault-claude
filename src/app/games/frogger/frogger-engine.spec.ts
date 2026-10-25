import {
  FroggerEngine,
  GOAL_COLS,
  LIVES_START,
  ROUND_TIME_BASE,
  ROW_START,
  SCORE_ADVANCE,
  SCORE_GOAL,
  SPEED_GROWTH,
  type Entity,
  type Lane,
} from './frogger-engine';
// La lógica del motor no toca `ctx`: `update(dt)` opera sobre `frog`/`lanes`/
// `occupied`/`timeLeft`, así que se testea sin `getContext`. Se conduce la
// simulación fijando los campos públicos, llamando `setInput()` y `update(dt)`.
const makeEngine = () => new FroggerEngine(document.createElement('canvas'));
const mkLane = (over: Partial<Lane> & { row: number; kind: 'road' | 'river' }): Lane => ({
  row: over.row,
  dir: over.dir ?? 1,
  speed: over.speed ?? 0,
  kind: over.kind,
  entities: over.entities ?? [],
  submergible: over.submergible ?? false,
  submerged: over.submerged ?? false,
  subT: over.subT ?? 0,
});
const ent = (col: number, width: number, kind: Entity['kind']): Entity => ({ col, width, kind });
describe('frogger-engine · estado inicial', () => {
  it('arranca jugable: score 0, 3 vidas, nivel 1, tiempo base, con carriles', () => {
    const e = makeEngine();
    expect(e.getState()).toEqual({
      score: 0,
      lives: LIVES_START,
      level: 1,
      timeLeft: ROUND_TIME_BASE,
      phase: 'playing',
    });
    expect(e.frog.row).toBe(ROW_START);
    expect(e.lanes.length).toBeGreaterThan(0);
  });
});
describe('frogger-engine · salto de la rana', () => {
  it('un salto avanza 1 fila hacia arriba y suma el avance', () => {
    const e = makeEngine();
    e.lanes = []; // sin entidades para aislar el salto
    e.setInput('up', true);
    e.update(0.001); // inicia la animación de salto
    expect(e.frog.animating).toBe(true);
    e.update(0.2); // completa el salto (> HOP_MS)
    expect(e.frog.row).toBe(ROW_START - 1);
    expect(e.score).toBe(SCORE_ADVANCE);
  });
  it('no se sale por el borde lateral (salto ignorado en col 0)', () => {
    const e = makeEngine();
    e.lanes = [];
    e.frog.col = 0;
    e.setInput('left', true);
    e.update(0.001);
    expect(e.frog.animating).toBe(false);
    expect(e.frog.col).toBe(0);
  });
});
describe('frogger-engine · carretera y río', () => {
  it('un vehículo que solapa a la rana la mata (resta vida, reposiciona)', () => {
    const e = makeEngine();
    e.frog.row = 12;
    e.frog.col = 5;
    e.lanes = [mkLane({ row: 12, kind: 'road', entities: [ent(5, 1, 'car')] })];
    e.lives = 3;
    e.update(0.001);
    expect(e.lives).toBe(2);
    expect(e.frog.row).toBe(ROW_START); // reposicionada en la base
  });
  it('en el río sin soporte la rana cae al agua y muere', () => {
    const e = makeEngine();
    e.frog.row = 3;
    e.frog.col = 5;
    e.lanes = [mkLane({ row: 3, kind: 'river', entities: [] })];
    e.lives = 3;
    e.update(0.001);
    expect(e.lives).toBe(2);
  });
  it('sobre un tronco sobrevive y deriva con él', () => {
    const e = makeEngine();
    e.frog.row = 3;
    e.frog.col = 5;
    e.lanes = [mkLane({ row: 3, kind: 'river', dir: 1, speed: 2, entities: [ent(4, 3, 'log')] })];
    e.lives = 3;
    e.update(0.1);
    expect(e.lives).toBe(3);
    expect(e.frog.col).toBeCloseTo(5.2, 5);
  });
  it('si la tortuga que la sostiene está sumergida, muere', () => {
    const e = makeEngine();
    e.frog.row = 5;
    e.frog.col = 5;
    e.lanes = [
      mkLane({
        row: 5,
        kind: 'river',
        speed: 1,
        entities: [ent(4, 3, 'turtle')],
        submergible: true,
        submerged: true,
      }),
    ];
    e.lives = 3;
    e.update(0.001);
    expect(e.lives).toBe(2);
  });
});
describe('frogger-engine · bocas y ronda', () => {
  it('llegar a una boca libre la ocupa, puntúa y reposiciona', () => {
    const e = makeEngine();
    e.lanes = [];
    e.frog.row = 1;
    e.frog.col = GOAL_COLS[0];
    e.timeLeft = 10;
    e.score = 0;
    e.occupied = [false, false, false, false, false];
    e.setInput('up', true);
    e.update(0.001); // inicia el salto a la fila de bocas
    e.update(0.2); // completa → resuelve la boca
    expect(e.occupied[0]).toBe(true);
    expect(e.score).toBeGreaterThanOrEqual(SCORE_GOAL);
    expect(e.frog.row).toBe(ROW_START);
  });
  it('llegar a una posición que no es boca mata', () => {
    const e = makeEngine();
    e.lanes = [];
    e.frog.row = 1;
    e.frog.col = 0; // col 0 no pertenece a ninguna boca
    e.lives = 3;
    e.setInput('up', true);
    e.update(0.001);
    e.update(0.2);
    expect(e.lives).toBe(2);
  });
  it('ocupar la 5.ª boca completa la ronda: sube nivel y resetea bocas', () => {
    const e = makeEngine();
    e.lanes = [];
    e.occupied = [true, true, true, true, false];
    e.frog.row = 1;
    e.frog.col = GOAL_COLS[4];
    e.level = 1;
    e.setInput('up', true);
    e.update(0.001);
    e.update(0.2);
    expect(e.level).toBe(2);
    expect(e.occupied.every((v) => v === false)).toBe(true);
  });
});
describe('frogger-engine · tiempo, vidas y nivel', () => {
  it('agotar el temporizador mata', () => {
    const e = makeEngine();
    e.timeLeft = 0.005;
    e.lives = 3;
    e.update(0.01);
    expect(e.lives).toBe(2);
  });
  it('a 0 vidas → gameover', () => {
    const e = makeEngine();
    e.lives = 1;
    e.frog.row = 3;
    e.frog.col = 5;
    e.lanes = [mkLane({ row: 3, kind: 'river', entities: [] })];
    e.update(0.001);
    expect(e.lives).toBe(0);
    expect(e.phase).toBe('gameover');
  });
  it('cada nivel acelera los carriles', () => {
    const e = makeEngine();
    const l1 = e.buildLanes(1);
    const l2 = e.buildLanes(2);
    expect(l2[0].speed).toBeCloseTo(l1[0].speed * SPEED_GROWTH, 5);
  });
  it('ESPACIO en gameover reinicia la partida', () => {
    const e = makeEngine();
    e.phase = 'gameover';
    e.score = 500;
    (e as unknown as { spaceLatched: boolean }).spaceLatched = true;
    e.update(0.016);
    expect(e.phase).toBe('playing');
    expect(e.score).toBe(0);
    expect(e.lives).toBe(LIVES_START);
  });
});
