import type { Move } from '../engine/types';

export type HistoryTable = Map<number, number>;

const CAPTURE_WEIGHT = 1000;
const PROMOTION_WEIGHT = 400;
const TT_WEIGHT = 100000;
const KILLER_WEIGHT = 900;
const KILLER_WEIGHT_2 = 780;

/** Clave estable de una jugada (los tableros llegan hasta 10×10). */
export const historyKey = (move: Move): number => move.from * 128 + move.to;

export const moveOrderScore = (
    move: Move,
    ttFrom: number,
    ttTo: number,
    history: HistoryTable,
    killers: readonly number[] = [],
): number => {
    let score = move.captures.length * CAPTURE_WEIGHT;

    if (move.promotion) {
        score += PROMOTION_WEIGHT;
    }

    if (move.from === ttFrom && move.to === ttTo) {
        score += TT_WEIGHT;
    }

    const key = historyKey(move);

    if (killers[0] === key) {
        score += KILLER_WEIGHT;
    } else if (killers[1] === key) {
        score += KILLER_WEIGHT_2;
    }

    return score + (history.get(key) ?? 0);
};

/** Ordena jugadas: TT, capturas, promociones, killers y experiencia. */
export const orderMoves = (
    moves: Move[],
    ttFrom: number,
    ttTo: number,
    history: HistoryTable,
    killers: readonly number[] = [],
): Move[] =>
    moves
        .map((move) => ({
            move,
            score: moveOrderScore(move, ttFrom, ttTo, history, killers),
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
