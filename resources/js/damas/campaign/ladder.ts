import { AI_PROFILES, type AiProfile } from '../ai/profiles';

const STORAGE_KEY = 'senal.damas.escalera.v1';

export interface LadderRecord {
    wins: number;
    losses: number;
}

export interface LadderState {
    /** Contacto más alto alcanzado: índice dentro de AI_PROFILES. */
    level: number;
    /** Historial por contacto. */
    records: Record<string, LadderRecord>;
}

export interface LadderTotals {
    wins: number;
    losses: number;
    cleared: number;
    /** Puntaje acumulado: cada victoria vale el rating del contacto vencido. */
    points: number;
}

export const MAX_LEVEL = AI_PROFILES.length - 1;

export const emptyLadder = (): LadderState => ({ level: 0, records: {} });

export const profileIndex = (profileId: string): number =>
    AI_PROFILES.findIndex((profile) => profile.id === profileId);

export const recordOf = (state: LadderState, profileId: string): LadderRecord =>
    state.records[profileId] ?? { wins: 0, losses: 0 };

export const ladderTotals = (state: LadderState): LadderTotals => {
    let wins = 0;
    let losses = 0;
    let cleared = 0;
    let points = 0;

    for (const profile of AI_PROFILES) {
        const record = recordOf(state, profile.id);

        wins += record.wins;
        losses += record.losses;

        if (record.wins > 0) {
            cleared += 1;
            points += profile.rating * record.wins;
        }
    }

    return { wins, losses, cleared, points };
};

/** Anota un duelo contra la IA y sube de nivel al ganar. */
export const registerLadderDuel = (
    state: LadderState,
    profileId: string,
    won: boolean,
): LadderState => {
    const record = recordOf(state, profileId);
    const index = profileIndex(profileId);
    const next =
        won && index >= 0
            ? Math.max(state.level, Math.min(index + 1, MAX_LEVEL))
            : state.level;

    return {
        level: Math.min(Math.max(next, 0), MAX_LEVEL),
        records: {
            ...state.records,
            [profileId]: {
                wins: record.wins + (won ? 1 : 0),
                losses: record.losses + (won ? 0 : 1),
            },
        },
    };
};

/** Contacto siguiente al indicado; null si ya es el último. */
export const nextProfile = (profileId: string): AiProfile | null => {
    const index = profileIndex(profileId);

    if (index < 0 || index >= MAX_LEVEL) {
        return null;
    }

    return AI_PROFILES[index + 1];
};

export const loadLadder = (): LadderState => {
    const base = emptyLadder();

    if (typeof window === 'undefined') {
        return base;
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);

        if (raw === null) {
            return base;
        }

        const parsed = JSON.parse(raw) as Partial<LadderState>;
        const records: Record<string, LadderRecord> = {};

        for (const profile of AI_PROFILES) {
            const record = parsed.records?.[profile.id];

            if (record === undefined) {
                continue;
            }

            records[profile.id] = {
                wins: Number.isFinite(record.wins) ? Number(record.wins) : 0,
                losses: Number.isFinite(record.losses)
                    ? Number(record.losses)
                    : 0,
            };
        }

        const level = Number.isFinite(parsed.level) ? Number(parsed.level) : 0;

        return {
            level: Math.min(Math.max(level, 0), MAX_LEVEL),
            records,
        };
    } catch {
        return base;
    }
};

export const saveLadder = (state: LadderState): void => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Sin almacenamiento disponible: el progreso queda solo en memoria.
    }
};
