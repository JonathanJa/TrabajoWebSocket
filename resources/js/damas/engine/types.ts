/**
 * Modelo de datos del motor de damas.
 *
 * Bandos: `operador` juega desde abajo y sube; `entidad` juega desde arriba y baja.
 */
export type Side = 'operador' | 'entidad';

export type PieceKind = 'man' | 'king';

export interface Piece {
    side: Side;
    kind: PieceKind;
}

/** Casilla del tablero: pieza o vacío. */
export type Cell = Piece | null;

/** Tablero cuadrado; el tamaño depende de la variante. */
export type Board = Cell[];

export interface MoveStep {
    from: number;
    to: number;
    captured: number | null;
}

/** Movimiento legal completo (una cadena de saltos = un movimiento). */
export interface Move {
    from: number;
    to: number;
    /** Casillas intermedias y final, empezando por `from`. */
    path: number[];
    /** Índices de las piezas capturadas, en orden. */
    captures: number[];
    /** Pasos individuales con la pieza capturada de cada uno. */
    steps: MoveStep[];
    /** El movimiento termina coronando. */
    promotion: boolean;
}

export type ResultReason =
    | 'sin-piezas'
    | 'bloqueado'
    | 'tablas-repeticion'
    | 'tablas-material'
    | 'abandono';

export interface GameResult {
    winner: Side | null;
    reason: ResultReason;
}

export type GamePhase = 'jugando' | 'terminado';
