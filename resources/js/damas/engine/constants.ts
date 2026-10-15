import type { Side } from './types';

export const BOARD_SIZE = 8;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const MAX_CELL_COUNT = 100;

/** Valor material usado por la evaluación. */
export const MAN_VALUE = 100;
export const KING_VALUE = 178;

/** La dama (rey corto) se mueve una casilla en cualquier diagonal. */
export const DIRS: ReadonlyArray<readonly [number, number]> = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
];

/** Filas de coronación por bando. */
export const PROMOTION_ROW: Record<Side, number> = {
    operador: 0,
    entidad: 7,
};

/** Avance de las piezas simples (las damas ignoran esto). */
export const FORWARD_ROW: Record<Side, number> = {
    operador: -1,
    entidad: 1,
};

export const OPPONENT: Record<Side, Side> = {
    operador: 'entidad',
    entidad: 'operador',
};

/** Partidas sin captura ni coronación: tablas. */
export const DRAW_PLIES_LIMIT = 50;

/** Repeticiones de la misma posición: tablas. */
export const REPETITION_LIMIT = 3;
