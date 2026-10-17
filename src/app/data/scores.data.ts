/** Fila de puntuación tal como la consume la UI (ranking ya calculado). */
export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}
