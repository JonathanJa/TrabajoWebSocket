/** Puntuación de mate: queda fuera del rango de la evaluación estática. */
export const MATE_SCORE = 1_000_000;

/** Tope de entradas de la tabla de transposición (memoria acotada). */
export const TT_TABLE_LIMIT = 200_000;

/** Umbral por debajo del cual consideramos la partida ganada por mate. */
export const MATE_THRESHOLD = MATE_SCORE - 1_000;
