const STORAGE_KEY = 'senal.damas.duelos.v1';

export interface DuelRecord {
    wins: number;
    losses: number;
}

/** Historial cara a cara por nombre de rival (en mayúsculas). */
export type DuelMap = Record<string, DuelRecord>;

export const duelOf = (map: DuelMap, rival: string): DuelRecord => {
    const key = rival.trim().toUpperCase();

    return map[key] ?? { wins: 0, losses: 0 };
};

export const registerRivalDuel = (
    map: DuelMap,
    rival: string,
    won: boolean,
): DuelMap => {
    const key = rival.trim().toUpperCase();

    if (key === '') {
        return map;
    }

    const record = duelOf(map, key);

    return {
        ...map,
        [key]: {
            wins: record.wins + (won ? 1 : 0),
            losses: record.losses + (won ? 0 : 1),
        },
    };
};

/** Totales de todos los rivales registrados. */
export const duelTotals = (map: DuelMap): DuelRecord => {
    let wins = 0;
    let losses = 0;

    for (const record of Object.values(map)) {
        wins += record.wins;
        losses += record.losses;
    }

    return { wins, losses };
};

export const loadDuels = (): DuelMap => {
    if (typeof window === 'undefined') {
        return {};
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);

        if (raw === null) {
            return {};
        }

        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const map: DuelMap = {};

        for (const [key, value] of Object.entries(parsed)) {
            const record = value as Partial<DuelRecord>;

            if (record === null || typeof record !== 'object') {
                continue;
            }

            map[key.toUpperCase()] = {
                wins: Number.isFinite(record.wins) ? Number(record.wins) : 0,
                losses: Number.isFinite(record.losses)
                    ? Number(record.losses)
                    : 0,
            };
        }

        return map;
    } catch {
        return {};
    }
};

export const saveDuels = (map: DuelMap): void => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        // Sin almacenamiento disponible: el historial queda solo en memoria.
    }
};
