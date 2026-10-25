import { generateMoves } from '../engine/movegen';
import {
    createContext,
    rankRootMoves,
    search,
    type SearchOutcome,
} from './search';
import type { AiSearchConfig } from './profiles';
import type { Board, Move, Side } from '../engine/types';
import { DEFAULT_VARIANT, type VariantId } from '../engine/variants';

export interface Advice {
    move: Move | null;
    outcome: SearchOutcome;
    /** Puntuacion de la jugada elegida segun su propio ranking. */
    chosenScore: number;
    blundered: boolean;
    /** Cuantas jugadas entraron al ranking (0 si fue decision directa). */
    rankedCount: number;
}

const pickRandom = <T>(items: readonly T[]): T =>
    items[Math.floor(Math.random() * items.length)] as T;

const instant = (move: Move): SearchOutcome => ({
    best: move,
    score: 0,
    depth: 0,
    nodes: 0,
    elapsedMs: 0,
});

/**
 * Elige jugada para una IA.
 *
 * Niveles altos: busqueda profunda directa.
 * Niveles bajos: ranking superficial + banda de ruido + pifias ocasionales.
 */
export const chooseMove = (
    board: Board,
    side: Side,
    config: AiSearchConfig,
    variant: VariantId = DEFAULT_VARIANT,
): Advice => {
    const legal = generateMoves(board, side, {}, variant);
    const ctx = createContext(config.timeMs);

    if (legal.length === 0) {
        return {
            move: null,
            outcome: search(
                board,
                side,
                {
                    maxDepth: 1,
                    timeMs: config.timeMs,
                    extensions: config.extensions,
                },
                ctx,
                variant,
            ),
            chosenScore: 0,
            blundered: false,
            rankedCount: 0,
        };
    }

    if (legal.length === 1) {
        return {
            move: legal[0],
            outcome: instant(legal[0]),
            chosenScore: 0,
            blundered: false,
            rankedCount: 1,
        };
    }

    const outcome = search(
        board,
        side,
        {
            maxDepth: config.maxDepth,
            timeMs: config.timeMs,
            extensions: config.extensions,
        },
        ctx,
        variant,
    );

    const anchor = outcome.best ?? legal[0];

    if (config.noise <= 0 && config.blunderChance <= 0) {
        return {
            move: anchor,
            outcome,
            chosenScore: outcome.score,
            blundered: false,
            rankedCount: 1,
        };
    }

    const ranked = rankRootMoves(
        ctx,
        board,
        side,
        legal,
        config.rankDepth,
        config.extensions,
        variant,
    );

    if (ranked.length === 0 || !Number.isFinite(ranked[0].score)) {
        return {
            move: anchor,
            outcome,
            chosenScore: outcome.score,
            blundered: false,
            rankedCount: ranked.length,
        };
    }

    if (config.blunderChance > 0 && Math.random() < config.blunderChance) {
        const pool = ranked
            .slice(1, 1 + config.blunderPool)
            .filter((entry) => Number.isFinite(entry.score));

        if (pool.length > 0) {
            const pick = pickRandom(pool);

            return {
                move: pick.move,
                outcome,
                chosenScore: pick.score,
                blundered: true,
                rankedCount: ranked.length,
            };
        }
    }

    const top = ranked[0].score;
    const band = ranked.filter(
        (entry) =>
            Number.isFinite(entry.score) && top - entry.score <= config.noise,
    );
    const pick = pickRandom(band.length > 0 ? band : [ranked[0]]);

    return {
        move: pick.move,
        outcome,
        chosenScore: pick.score,
        blundered: false,
        rankedCount: ranked.length,
    };
};
