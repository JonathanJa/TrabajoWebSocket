import { createInitialBoard, opposite, positionKey } from '../engine/board';
import { DRAW_PLIES_LIMIT, REPETITION_LIMIT } from '../engine/constants';
import { generateMoves } from '../engine/movegen';
import {
    applyMove,
    boardOutcome,
    detectDraw,
    moveMakesProgress,
} from '../engine/rules';
import { moveLabel } from './notation';
import type { Board, GameResult, Move, Side } from '../engine/types';
import { DEFAULT_VARIANT, type VariantId } from '../engine/variants';

export interface MatchLogEntry {
    id: number;
    side: Side;
    label: string;
    captured: number;
    crowned: boolean;
    ply: number;
}

export interface MatchSnapshot {
    variant: VariantId;
    board: Board;
    sideToMove: Side;
    result: GameResult | null;
    /** Piezas abducidas por cada bando. */
    tally: Record<Side, number>;
    plies: number;
    log: MatchLogEntry[];
    lastMove: Move | null;
    repetitions: Record<string, number>;
    quietPlies: number;
}

export const initialSnapshot = (
    variant: VariantId = DEFAULT_VARIANT,
): MatchSnapshot => {
    const board = createInitialBoard(variant);

    return {
        variant,
        board,
        sideToMove: 'operador',
        result: null,
        tally: { operador: 0, entidad: 0 },
        plies: 0,
        log: [],
        lastMove: null,
        repetitions: { [positionKey(board, 'operador', variant)]: 1 },
        quietPlies: 0,
    };
};

/** ¿La jugada sigue siendo legal en este tablero? (valida jugadas de la red). */
export const isLegal = (
    board: Board,
    side: Side,
    move: Move,
    variant: VariantId = DEFAULT_VARIANT,
): boolean =>
    generateMoves(board, side, {}, variant).some(
        (candidate) =>
            candidate.from === move.from &&
            candidate.to === move.to &&
            candidate.promotion === move.promotion &&
            candidate.captures.length === move.captures.length &&
            candidate.captures.every(
                (index, offset) => index === move.captures[offset],
            ),
    );

/** Aplica una jugada y resuelve de una vez si la partida terminó. */
export const advance = (state: MatchSnapshot, move: Move): MatchSnapshot => {
    const side = state.sideToMove;
    const board = applyMove(state.board, move, state.variant);
    const nextSide = opposite(side);
    const key = positionKey(board, nextSide, state.variant);
    const repetitions: Record<string, number> = {
        ...state.repetitions,
        [key]: (state.repetitions[key] ?? 0) + 1,
    };
    const quietPlies = moveMakesProgress(move) ? 0 : state.quietPlies + 1;
    const plies = state.plies + 1;
    const captured = move.captures.length;

    const outcome =
        boardOutcome(board, nextSide, state.variant) ??
        detectDraw(
            {
                pliesWithoutProgress: quietPlies,
                repetitions: repetitions[key] ?? 0,
            },
            { plies: DRAW_PLIES_LIMIT, repetitions: REPETITION_LIMIT },
        );

    return {
        variant: state.variant,
        board,
        sideToMove: nextSide,
        result: outcome,
        tally:
            captured === 0
                ? state.tally
                : { ...state.tally, [side]: state.tally[side] + captured },
        plies,
        log: [
            ...state.log,
            {
                id: plies,
                side,
                label: moveLabel(move, state.variant),
                captured,
                crowned: move.promotion,
                ply: plies,
            },
        ],
        lastMove: move,
        repetitions,
        quietPlies,
    };
};

/** Abandono: gana el bando contrario al que corta la transmisión. */
export const resign = (state: MatchSnapshot, side: Side): MatchSnapshot =>
    state.result === null
        ? {
              ...state,
              result: { winner: opposite(side), reason: 'abandono' },
          }
        : state;
