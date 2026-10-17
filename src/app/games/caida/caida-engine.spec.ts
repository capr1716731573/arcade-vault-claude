import { CaidaEngine, COLS, LINE_SCORES, PIECES, ROWS, rotateCW } from './caida-engine';
// La lógica del motor no toca `ctx`: `update(dt)` y los métodos de reglas
// (collide/clearLines/hardDrop/spawn) operan sobre `board`/`current`, así que se
// testea sin `getContext`.
const makeEngine = () => new CaidaEngine(document.createElement('canvas'));
const fullRow = () => new Array(COLS).fill(1);
const countFilled = (shape: number[][]) => shape.flat().filter((v) => v !== 0).length;
describe('caida-engine · piezas y utilidades', () => {
  it('hay 8 piezas, incluida la tuerca (índice 8, anillo 3×3 = 8 celdas)', () => {
    expect(PIECES.length).toBe(9); // índice 0 = null + 8 piezas
    expect(countFilled(PIECES[8]!)).toBe(8);
  });
  it('rotateCW deja la O igual y conserva las celdas llenas de la I', () => {
    expect(rotateCW(PIECES[2]!)).toEqual(PIECES[2]); // O 2×2 es invariante a la rotación
    const i0 = PIECES[1]!;
    const i1 = rotateCW(i0);
    expect(countFilled(i1)).toBe(countFilled(i0)); // 4 celdas antes y después
    expect(i1).not.toEqual(i0); // pero cambia de orientación
  });
});
describe('caida-engine · simulación', () => {
  it('arranca jugable: score 0, líneas 0, nivel 1', () => {
    const e = makeEngine();
    expect(e.getState()).toEqual({ score: 0, lines: 0, level: 1, phase: 'playing' });
    expect(e.board.length).toBe(ROWS);
    expect(e.board[0].length).toBe(COLS);
  });
  it('collide detecta bordes y celdas ocupadas', () => {
    const e = makeEngine();
    const o = PIECES[2]!;
    expect(e.collide(o, -1, 0)).toBe(true); // fuera por la izquierda
    expect(e.collide(o, COLS - 1, 0)).toBe(true); // fuera por la derecha (O mide 2)
    expect(e.collide(o, 0, 0)).toBe(false); // cabe
    e.board[1][0] = 1;
    expect(e.collide(o, 0, 0)).toBe(true); // choca con celda ocupada
  });
  it('clearLines: 1 línea suma 100×nivel y consume la fila', () => {
    const e = makeEngine();
    e.board[ROWS - 1] = fullRow();
    expect(e.clearLines()).toBe(1);
    expect(e.lines).toBe(1);
    expect(e.score).toBe(LINE_SCORES[1]); // 100 × nivel 1
    expect(e.board[ROWS - 1].every((v) => v === 0)).toBe(true);
  });
  it('clearLines: 4 líneas (tetris) suma 800×nivel', () => {
    const e = makeEngine();
    for (let r = ROWS - 4; r < ROWS; r++) e.board[r] = fullRow();
    expect(e.clearLines()).toBe(4);
    expect(e.lines).toBe(4);
    expect(e.score).toBe(LINE_SCORES[4]); // 800
  });
  it('cada 10 líneas sube el nivel', () => {
    const e = makeEngine();
    e.lines = 9;
    e.board[ROWS - 1] = fullRow();
    e.clearLines();
    expect(e.lines).toBe(10);
    expect(e.level).toBe(2);
  });
  it('hardDrop suma 2 puntos por celda caída y fija la pieza', () => {
    const e = makeEngine();
    e.current = { type: 2, shape: PIECES[2]!.map((r) => [...r]), x: 0, y: 0 };
    e.score = 0;
    e.hardDrop();
    // O 2×2 sobre tablero vacío cae de y=0 a y=18 → 18 celdas × 2 = 36
    expect(e.score).toBe(36);
    expect(e.board[ROWS - 1][0]).toBe(2);
    expect(e.board[ROWS - 2][0]).toBe(2);
  });
  it('una sola vida: si la nueva pieza no cabe → gameover', () => {
    const e = makeEngine();
    e.board[0] = fullRow();
    e.board[1] = fullRow();
    e.spawn();
    expect(e.phase).toBe('gameover');
    expect(e.getState().phase).toBe('gameover');
  });
  it('ESPACIO en gameover reinicia la partida', () => {
    const e = makeEngine();
    e.board[0] = fullRow();
    e.board[1] = fullRow();
    e.spawn();
    expect(e.phase).toBe('gameover');
    e.setInput('hard', true); // 'hard' → tecla Space
    e.update(0.016);
    expect(e.phase).toBe('playing');
    expect(e.score).toBe(0);
    expect(e.lines).toBe(0);
  });
  it('setInput mueve la pieza a la izquierda', () => {
    const e = makeEngine();
    e.current = { type: 2, shape: PIECES[2]!.map((r) => [...r]), x: 5, y: 0 };
    e.setInput('left', true);
    e.update(0.016);
    expect(e.current.x).toBe(4);
  });
});
