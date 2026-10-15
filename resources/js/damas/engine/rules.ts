import { KING_VALUE, MAN_VALUE } from './constants';
import { cloneBoard, opposite, rowOf } from './board';
import { generateMoves } from './movegen';
import type { Board, GameResult, Move, Side } from './types';
import { DEFAULT_VARIANT, rulesFor, type VariantId } from './variants';

/** Aplica un movimiento y devuelve un tablero nuevo (el original no se toca). */
export const applyMove = (
    board: Board,
    move: Move,
    variant: VariantId = DEFAULT_VARIANT,
): Board => {
    const next = cloneBoard(board);
    const mover = next[move.from];

    if (mover === null) {
        return next;
    }

    next[move.from] = null;

    for (const captured of move.captures) {
        next[captured] = null;
    }

    const rules = rulesFor(variant);
    const crowns =
        mover.kind === 'man' &&
        rowOf(move.to, rules.boardSize) ===
            (mover.side === 'operador' ? 0 : rules.boardSize - 1);
    next[move.to] = crowns ? { side: mover.side, kind: 'king' } : mover;

    return next;
};

export const piecesOf = (board: Board, side: Side): number[] => {
    const found: number[] = [];

    for (let index = 0; index < board.length; index += 1) {
        if (board[index]?.side === side) {
            found.push(index);
        }
    }

    return found;
};

export const countPieces = (board: Board, side: Side): number =>
    piecesOf(board, side).length;

export const countKings = (board: Board, side: Side): number =>
    piecesOf(board, side).filter((index) => board[index]?.kind === 'king')
        .length;

/** Material total del bando (piezas simples + damas). */
export const materialOf = (board: Board, side: Side): number => {
    let total = 0;

    for (const index of piecesOf(board, side)) {
        total += board[index]?.kind === 'king' ? KING_VALUE : MAN_VALUE;
    }

    return total;
};

export const hasMoves = (
    board: Board,
    side: Side,
    variant: VariantId = DEFAULT_VARIANT,
): boolean => generateMoves(board, side, { light: true }, variant).length > 0;

/**
 * Fin de partida por material o bloqueo.
 * `sideToMove` es el bando que debe mover: si no puede, pierde.
 */
export const boardOutcome = (
    board: Board,
    sideToMove: Side,
    variant: VariantId = DEFAULT_VARIANT,
): GameResult | null => {
    if (countPieces(board, sideToMove) === 0) {
        return { winner: opposite(sideToMove), reason: 'sin-piezas' };
    }

    if (!hasMoves(board, sideToMove, variant)) {
        return { winner: opposite(sideToMove), reason: 'bloqueado' };
    }

    return null;
};

export interface DrawSignals {
    /** Jugadas consecutivas sin captura ni coronación. */
    pliesWithoutProgress: number;
    /** Repeticiones de la posición actual. */
    repetitions: number;
}

/** Tablas por inacción o por repetición de posición. */
export const detectDraw = (
    signals: DrawSignals,
    limits: { plies: number; repetitions: number },
): GameResult | null => {
    if (signals.repetitions >= limits.repetitions) {
        return { winner: null, reason: 'tablas-repeticion' };
    }

    if (signals.pliesWithoutProgress >= limits.plies) {
        return { winner: null, reason: 'tablas-material' };
    }

    return null;
};

/** Una jugada "progresó" si comió o coronó. */
export const moveMakesProgress = (move: Move): boolean =>
    move.captures.length > 0 || move.promotion;
