import type { Side } from '../engine/types';
import type { VariantId } from '../engine/variants';
import { resolveLocalNames, type LocalNames } from './localNames';

export type ScoreMode = 'ai' | 'campaign' | 'local' | 'remote' | 'chinese';
export type ScoreOutcome = 'win' | 'loss' | 'draw';

export interface ScorePayload {
    name: string;
    mode: ScoreMode;
    result: ScoreOutcome;
    variant?: VariantId | null;
    opponent?: string;
    detail?: string;
}

export interface RankingPlayer {
    name: string;
    points: number;
    wins: number;
    losses: number;
    draws: number;
    games: number;
    last_played_at: string | null;
}

const csrfToken = (): string | undefined =>
    document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;

/**
 * Informa un resultado al ranking global. Es best-effort: si la red o la base
 * de datos fallan, la partida sigue funcionando.
 */
export const reportScore = async (payload: ScorePayload): Promise<boolean> => {
    const token = csrfToken();

    try {
        const response = await fetch('/damas/resultados', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...(token === undefined ? {} : { 'X-CSRF-TOKEN': token }),
            },
            body: JSON.stringify(payload),
            keepalive: true,
        });

        return response.ok;
    } catch {
        return false;
    }
};

export const fetchRanking = async (): Promise<RankingPlayer[]> => {
    const response = await fetch('/damas/ranking', {
        headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as { players?: RankingPlayer[] };

    return Array.isArray(data.players) ? data.players : [];
};

const outcomeFor = (side: Side, winner: Side | null): ScoreOutcome => {
    if (winner === null) {
        return 'draw';
    }

    return winner === side ? 'win' : 'loss';
};

/** Registra a los dos participantes de un duelo local. */
export const reportLocalScore = (
    names: LocalNames,
    fallback: string,
    winner: Side | null,
    mode: 'local' | 'chinese',
    variant: VariantId | null,
    detail: string,
): Promise<boolean[]> => {
    const resolved = resolveLocalNames(names, fallback);

    return Promise.all([
        reportScore({
            name: resolved.operador,
            mode,
            result: outcomeFor('operador', winner),
            variant,
            opponent: resolved.entidad,
            detail,
        }),
        reportScore({
            name: resolved.entidad,
            mode,
            result: outcomeFor('entidad', winner),
            variant,
            opponent: resolved.operador,
            detail,
        }),
    ]);
};

export const formatPlayedAt = (value: string | null): string => {
    if (value === null) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleDateString('es', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};
