import type { Move } from '../engine/types';

export type HistoryTable = Map<number, number>;

const CAPTURE_WEIGHT = 1000;
const PROMOTION_WEIGHT = 400;
const TT_WEIGHT = 100000;

export const historyKey = (move: Move): number => move.from * 64 + move.to;

export const moveOrderScore = (
    move: Move,
    ttFrom: number,
    ttTo: number,
    history: HistoryTable,
): number => {
    let score = move.captures.length * CAPTURE_WEIGHT;

    if (move.promotion) {
        score += PROMOTION_WEIGHT;
    }

    if (move.from === ttFrom && move.to === ttTo) {
        score += TT_WEIGHT;
    }

    return score + (history.get(historyKey(move)) ?? 0);
};

/** Ordena jugadas: primero lo que da ventaja táctica inmediata. */
export const orderMoves = (
    moves: Move[],
    ttFrom: number,
    ttTo: number,
    history: HistoryTable,
): Move[] =>
    moves
        .map((move) => ({
            move,
            score: moveOrderScore(move, ttFrom, ttTo, history),
        }))
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.move);

export const bumpHistory = (
    history: HistoryTable,
    move: Move,
    depth: number,
): void => {
    const key = historyKey(move);
    history.set(key, (history.get(key) ?? 0) + depth * depth);
};
