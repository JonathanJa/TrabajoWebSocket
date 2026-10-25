import { opposite } from '../engine/board';
import { applyMove } from '../engine/rules';
import { generateMoves } from '../engine/movegen';
import { keyOf } from './zobrist';
import { MATE_SCORE, MATE_THRESHOLD } from './limits';
import { negamax, type SearchContext } from './negamax';
import { orderMoves } from './ordering';
import { TranspositionTable } from './tt';
import type { Board, Move, Side } from '../engine/types';
import { DEFAULT_VARIANT, type VariantId } from '../engine/variants';

export interface SearchLimits {
    maxDepth: number;
    /** Tope de tiempo en milisegundos para la jugada completa. */
    timeMs: number;
    /** Plies extra de búsqueda cuando hay capturas obligatorias. */
    extensions: number;
}

export interface RankedMove {
    move: Move;
    score: number;
}

export interface SearchOutcome {
    best: Move | null;
    score: number;
    depth: number;
    nodes: number;
    elapsedMs: number;
}

export const createContext = (timeMs: number): SearchContext => ({
    nodes: 0,
    deadline: performance.now() + timeMs,
    aborted: false,
    tt: new TranspositionTable(),
    history: new Map<number, number>(),
    killers: [],
});

const orderRoot = (
    moves: Move[],
    best: Move | null,
    ctx: SearchContext,
): Move[] =>
    orderMoves(
        moves,
        best === null ? -1 : best.from,
        best === null ? -1 : best.to,
        ctx.history,
    );

/** Profundización iterativa desde la raíz. Devuelve la mejor jugada completa. */
export const search = (
    board: Board,
    side: Side,
    limits: SearchLimits,
    existing?: SearchContext,
    variant: VariantId = DEFAULT_VARIANT,
): SearchOutcome => {
    const startedAt = performance.now();
    const ctx = existing ?? createContext(limits.timeMs);
    const rootMoves = generateMoves(board, side, {}, variant);

    if (rootMoves.length === 0) {
        return {
            best: null,
            score: -MATE_SCORE,
            depth: 0,
            nodes: ctx.nodes,
            elapsedMs: performance.now() - startedAt,
        };
    }

    const childSide = opposite(side);
    let best: Move = rootMoves[0];
    let bestScore = 0;
    let completedDepth = 0;

    for (let depth = 1; depth <= limits.maxDepth; depth += 1) {
        const ordered = orderRoot(
            rootMoves,
            completedDepth > 0 ? best : null,
            ctx,
        );
        let iterBest: Move | null = null;
        let iterScore = -Infinity;
        let alpha = -Infinity;

        for (let i = 0; i < ordered.length; i += 1) {
            const move = ordered[i];
            const child = applyMove(board, move, variant);
            const childKey = keyOf(child, childSide);
            const run = (window: 'full' | 'zero'): number =>
                -negamax(
                    ctx,
                    child,
                    childSide,
                    depth - 1,
                    window === 'full' ? -Infinity : -alpha - 1,
                    -alpha,
                    1,
                    childKey.a,
                    childKey.b,
                    limits.extensions,
                    variant,
                );

            let score =
                i === 0 || alpha === -Infinity ? run('full') : run('zero');

            if (i > 0 && score > alpha) {
                score = run('full');
            }

            if (ctx.aborted) {
                break;
            }

            if (score > iterScore) {
                iterScore = score;
                iterBest = move;
            }

            if (iterScore > alpha) {
                alpha = iterScore;
            }

            if (iterScore >= MATE_THRESHOLD) {
                break;
            }
        }

        if (ctx.aborted) {
            break;
        }

        if (iterBest !== null) {
            best = iterBest;
            bestScore = iterScore;
            completedDepth = depth;
        }

        if (bestScore >= MATE_THRESHOLD) {
            break;
        }
    }

    return {
        best,
        score: bestScore,
        depth: completedDepth,
        nodes: ctx.nodes,
        elapsedMs: performance.now() - startedAt,
    };
};

/** Puntúa TODAS las jugadas legales con ventana completa (para niveles con ruido). */
export const rankRootMoves = (
    ctx: SearchContext,
    board: Board,
    side: Side,
    moves: Move[],
    depth: number,
    extensions: number,
    variant: VariantId = DEFAULT_VARIANT,
): RankedMove[] => {
    const childSide = opposite(side);
    const ranked: RankedMove[] = [];

    for (const move of moves) {
        if (ctx.aborted) {
            break;
        }

        const child = applyMove(board, move, variant);
        const childKey = keyOf(child, childSide);
        const score = -negamax(
            ctx,
            child,
            childSide,
            Math.max(0, depth - 1),
            -Infinity,
            Infinity,
            1,
            childKey.a,
            childKey.b,
            extensions,
            variant,
        );

        if (ctx.aborted) {
            break;
        }

        ranked.push({ move, score });
    }

    return ranked.sort((a, b) => b.score - a.score);
};
