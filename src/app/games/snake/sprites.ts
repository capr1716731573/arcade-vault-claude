/**
 * Atlas de frutas portado de `references/started-games/05-snake-assets/sprites.js`.
 * Las coordenadas son recortes { x, y, w, h } dentro de `fruits.png`
 * (hoja 3790×442; fila usada y=136, alto 160). El binario se sirve desde `public/`
 * en `/games/snake/fruits.png`. No se carga `window.SPRITE_ATLAS` como script global.
 * SPEC 09, paso 2.
 */
/** Ruta web del spritesheet (Angular sirve `public/` en la raíz del sitio). */
export const FRUITS_IMAGE_SRC = '/games/snake/fruits.png';
/** Recorte { x, y, w, h } dentro de `fruits.png`. */
export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Las 22 frutas del atlas. */
export type FruitName =
  | 'banana'
  | 'orange'
  | 'grape'
  | 'garlic'
  | 'eggplant'
  | 'strawberry'
  | 'cherry'
  | 'carrot'
  | 'mushroom'
  | 'broccoli'
  | 'watermelon'
  | 'pepper'
  | 'kiwi'
  | 'lemon'
  | 'peach'
  | 'peanut'
  | 'apple'
  | 'tomato'
  | 'berries'
  | 'grapes2'
  | 'pineapple'
  | 'melon';
/** Coordenadas de recorte por fruta (port fiel de `sprites.js`). */
export const FRUIT_SPRITES: Record<FruitName, SpriteRect> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};
/** Claves del atlas en orden; usada para elegir una fruta al azar. */
export const FRUIT_NAMES: readonly FruitName[] = Object.keys(FRUIT_SPRITES) as FruitName[];
/**
 * Puntos por fruta (balance inicial, SPEC 09, ajustable):
 *  - 10: frutas grandes/comunes.
 *  - 20: frutas medianas.
 *  - 30: frutas pequeñas/raras.
 * Comer siempre alarga la serpiente en 1 segmento, independientemente de los puntos.
 */
export const FRUIT_POINTS: Record<FruitName, number> = {
  // 10
  apple: 10,
  banana: 10,
  orange: 10,
  watermelon: 10,
  melon: 10,
  pineapple: 10,
  pepper: 10,
  tomato: 10,
  // 20
  grape: 20,
  grapes2: 20,
  strawberry: 20,
  peach: 20,
  lemon: 20,
  kiwi: 20,
  carrot: 20,
  eggplant: 20,
  // 30
  cherry: 30,
  berries: 30,
  mushroom: 30,
  broccoli: 30,
  garlic: 30,
  peanut: 30,
};
