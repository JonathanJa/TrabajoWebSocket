import { evaluate } from './evaluate';
import {
    bumpHistory,
    historyKey,
    orderMoves,
    type HistoryTable,
} from './ordering';
import { MATE_SCORE } from './limits';
import {
    pieceCode,
    SIDE_KEY_A,
    SIDE_KEY_B,
    xorPieceA,
    xorPieceB,
} from './zobrist';
import type { TTFlag, TranspositionTable } from './tt';
import { opposite } from '../engine/board';
import { applyMove } from '../engine/rules';
import { generateMoves } from '../engine/movegen';
import type { Board, Side } from '../engine/types';
import { DEFAULT_VARIANT, type VariantId } from '../engine/variants';

export interface SearchContext {
    nodes: number;
    deadline: number;
    aborted: boolean;
    tt: TranspositionTable;
    history: HistoryTable;
    /** Dos jugadas "asesinas" por ply: cortan bien y no son capturas. */
    killers: number[][];
}

const TIME_CHECK_MASK = 511;
const NO_KILLERS: readonly number[] = [];

/**
 * Negamax con alpha-beta, tabla de transposición, extensión de capturas,
 * reducción de jugadas tardías (LMR) y heurística de killers.
 * Devuelve la puntuación desde la perspectiva de `side`.
 */
export const negamax = (
    ctx: SearchContext,
    board: Board,
    side: Side,
    depth: number,
    alphaIn: number,
    beta: number,
    ply: number,
    keyA: number,
    keyB: number,
    extensionsLeft: number,
    variant: VariantId = DEFAULT_VARIANT,
): number => {
    ctx.nodes += 1;

    if (
        (ctx.nodes & TIME_CHECK_MASK) === 0 &&
        performance.now() >= ctx.deadline
    ) {
        ctx.aborted = true;
    }

    if (ctx.aborted) {
        return 0;
    }

    let alpha = alphaIn;
    const entry = ctx.tt.read(keyA, keyB);

    if (entry !== undefined && entry.depth >= depth) {
        if (entry.flag === 'exact') {
            return entry.value;
        }

        if (entry.flag === 'lower' && entry.value > alpha) {
            alpha = entry.value;
        }

        if (entry.flag === 'upper' && entry.value < beta) {
            beta = entry.value;
        }

        if (alpha >= beta) {
            return entry.value;
        }
    }

    const moves = generateMoves(board, side, { light: true }, variant);

    if (moves.length === 0) {
        return -MATE_SCORE + ply;
    }

    const forced = moves[0].captures.length > 0;

    if (depth <= 0 && (!forced || extensionsLeft <= 0)) {
        return evaluate(board, side, variant);
    }

    const ordered = orderMoves(
        moves,
        entry?.from ?? -1,
        entry?.to ?? -1,
        ctx.history,
        ctx.killers[ply] ?? NO_KILLERS,
    );
    const childSide = opposite(side);
    const extend = forced && extensionsLeft > 0;
    const childDepth = extend ? depth : depth - 1;
    const childExtensions = extend ? extensionsLeft - 1 : extensionsLeft;

    let best = -Infinity;
    let bestFrom = -1;
    let bestTo = -1;

    for (let index = 0; index < ordered.length; index += 1) {
        const move = ordered[index];
        const mover = board[move.from];
        const child = applyMove(board, move, variant);
        const placed = child[move.to];

        if (mover === null || placed === null) {
            continue;
        }

        let childKeyA = keyA ^ SIDE_KEY_A;
        let childKeyB = keyB ^ SIDE_KEY_B;

        childKeyA = xorPieceA(childKeyA, move.from, pieceCode(mover));
        childKeyB = xorPieceB(childKeyB, move.from, pieceCode(mover));
        childKeyA = xorPieceA(childKeyA, move.to, pieceCode(placed));
        childKeyB = xorPieceB(childKeyB, move.to, pieceCode(placed));

        for (const captured of move.captures) {
            const victim = board[captured];

            if (victim === null) {
                continue;
            }

            childKeyA = xorPieceA(childKeyA, captured, pieceCode(victim));
            childKeyB = xorPieceB(childKeyB, captured, pieceCode(victim));
        }

        const run = (reduce: number, window: 'full' | 'zero'): number =>
            -negamax(
                ctx,
                child,
                childSide,
                childDepth - reduce,
                window === 'full' ? -beta : -alpha - 1,
                -alpha,
                ply + 1,
                childKeyA,
                childKeyB,
                childExtensions,
                variant,
            );

        const quiet = move.captures.length === 0 && !move.promotion;
        let score: number;

        if (index === 0 || alpha === -Infinity) {
            score = run(0, 'full');
        } else if (quiet && !extend && childDepth >= 3 && index >= 3) {
            // Las jugadas tranquilas que quedan al final se prueban con menos
            // profundidad; si superan alpha, se repiten a profundidad completa.
            const reduce = index >= 7 && childDepth >= 4 ? 2 : 1;

            score = run(reduce, 'zero');

            if (score > alpha) {
                score = run(0, 'full');
            }
        } else {
            // PVS: ventana nula para el resto y re-búsqueda si mejora alpha.
            score = run(0, 'zero');

            if (score > alpha && score < beta) {
                score = run(0, 'full');
            }
        }

        if (ctx.aborted) {
            return 0;
        }

        if (score > best) {
            best = score;
            bestFrom = move.from;
            bestTo = move.to;
        }

        if (best > alpha) {
            alpha = best;
        }

        if (alpha >= beta) {
            bumpHistory(ctx.history, move, depth);

            if (quiet) {
                const key = historyKey(move);
                const slots = ctx.killers[ply] ?? (ctx.killers[ply] = []);

                if (slots[0] !== key) {
                    slots[1] = slots[0] ?? -1;
                    slots[0] = key;
                }
            }

            break;
        }
    }

    const flag: TTFlag =
        best <= alphaIn ? 'upper' : best >= beta ? 'lower' : 'exact';

    ctx.tt.write(keyA, keyB, {
        depth,
        value: best,
        flag,
        from: bestFrom,
        to: bestTo,
        validMove: bestFrom >= 0,
    });

    return best;
};

export const readTtMove = (
    tt: TranspositionTable,
    keyA: number,
    keyB: number,
): { from: number; to: number } | null => {
    const entry = tt.read(keyA, keyB);

    if (entry === undefined || !entry.validMove) {
        return null;
    }

    return { from: entry.from, to: entry.to };
};
