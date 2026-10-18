export type GameColor = 'cyan' | 'magenta' | 'yellow' | 'green';
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: GameColor;
  best: number;
  plays: string;
  /** true solo en juegos reales jugables; ausente/false ⇒ badge "PRÓXIMAMENTE" (no bloquea). */
  playable?: boolean;
}
export const CATS = ['TODOS', 'ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS'];
/**
 * Artefacto de referencia/siembra. El runtime lee el catálogo de Supabase
 * (tabla `games`). Desde SPEC 09 el catálogo solo contiene juegos implementados:
 * los placeholders no implementados se retiraron, y cada juego se crea en la BD al
 * implementarlo. Mantener esta lista en sincronía con las filas reales.
 */
export const GAMES: Game[] = [
  {
    id: 'asteroides',
    title: 'ASTEROIDES',
    short: 'Rota, propulsa y pulveriza la lluvia de rocas.',
    long: 'Tu nave vectorial flota en un campo de asteroides de espacio toroidal. Rota, propulsa y dispara para partir cada roca grande en fragmentos cada vez más veloces. Atrapa el power-up de triple disparo y sobrevive oleada tras oleada.',
    cat: 'SHOOTER',
    cover: 'cover-asteroides',
    color: 'cyan',
    best: 0,
    plays: '—',
    playable: true,
  },
  {
    id: 'bloque-buster',
    title: 'BLOQUE BUSTER',
    short: 'Rebota la pelota y destruye muros de neón.',
    long: 'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?',
    cat: 'ARCADE',
    cover: 'cover-bricks',
    color: 'cyan',
    best: 28450,
    plays: '12.4K',
    playable: true,
  },
  {
    id: 'caida',
    title: 'CAÍDA',
    short: 'Encaja las piezas antes de que el techo te aplaste.',
    long: 'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.',
    cat: 'PUZZLE',
    cover: 'cover-tetro',
    color: 'magenta',
    best: 184220,
    plays: '31.8K',
    playable: true,
  },
  {
    id: 'snake',
    title: 'SNAKE',
    short: 'Crece comiendo fruta sin morderte la cola.',
    long: 'Una serpiente de luz recorre una grilla toroidal devorando fruta. Cada bocado la alarga y la acelera; atraviesa los bordes y reaparece en el lado opuesto. El único peligro es ella misma.',
    cat: 'ARCADE',
    cover: 'cover-snake',
    color: 'green',
    best: 0,
    plays: '—',
    playable: true,
  },
];
