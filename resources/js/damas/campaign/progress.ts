import { CASES } from './cases';

const STORAGE_KEY = 'senal.damas.progreso.v1';

export interface CaseRecord {
    cleared: boolean;
    attempts: number;
    /** Menor cantidad de jugadas propias con las que se cerró el caso. */
    bestPlies: number | null;
}

export type ProgressMap = Record<string, CaseRecord>;

export interface CampaignStats {
    cleared: number;
    total: number;
    attempts: number;
    rank: string;
    nextCaseId: string | null;
    percent: number;
}

const emptyRecord = (): CaseRecord => ({
    cleared: false,
    attempts: 0,
    bestPlies: null,
});

const emptyMap = (): ProgressMap => {
    const map: ProgressMap = {};

    for (const caseFile of CASES) {
        map[caseFile.id] = emptyRecord();
    }

    return map;
};

const readStorage = (): ProgressMap => {
    const base = emptyMap();

    if (typeof window === 'undefined') {
        return base;
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);

        if (raw === null) {
            return base;
        }

        const parsed = JSON.parse(raw) as Partial<ProgressMap>;

        for (const caseFile of CASES) {
            const record = parsed[caseFile.id];

            if (record !== undefined) {
                base[caseFile.id] = {
                    cleared: record.cleared === true,
                    attempts: Number.isFinite(record.attempts) ? record.attempts : 0,
                    bestPlies:
                        typeof record.bestPlies === 'number' ? record.bestPlies : null,
                };
            }
        }

        return base;
    } catch {
        return base;
    }
};

const writeStorage = (map: ProgressMap): void => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        /* almacenamiento no disponible: la campaña sigue en memoria */
    }
};

export const loadProgress = (): ProgressMap => readStorage();

export const saveProgress = (map: ProgressMap): void => writeStorage(map);

export const registerAttempt = (map: ProgressMap, caseId: string): ProgressMap => {
    const current = map[caseId] ?? emptyRecord();
    const next: ProgressMap = {
        ...map,
        [caseId]: { ...current, attempts: current.attempts + 1 },
    };

    writeStorage(next);

    return next;
};

export const registerWin = (
    map: ProgressMap,
    caseId: string,
    plies: number,
): ProgressMap => {
    const current = map[caseId] ?? emptyRecord();
    const bestPlies =
        current.bestPlies === null ? plies : Math.min(current.bestPlies, plies);
    const next: ProgressMap = {
        ...map,
        [caseId]: { ...current, cleared: true, bestPlies },
    };

    writeStorage(next);

    return next;
};

export const resetProgress = (): ProgressMap => {
    const next = emptyMap();
    writeStorage(next);

    return next;
};

export const isUnlocked = (map: ProgressMap, index: number): boolean => {
    if (index <= 0) {
        return true;
    }

    const previous = CASES[index - 1];

    return map[previous.id]?.cleared === true;
};

export const campaignStats = (map: ProgressMap): CampaignStats => {
    let cleared = 0;
    let attempts = 0;
    let rank = 'SIN REGISTRO';
    let nextCaseId: string | null = null;

    CASES.forEach((caseFile, index) => {
        const record = map[caseFile.id];

        attempts += record?.attempts ?? 0;

        if (record?.cleared === true) {
            cleared += 1;
            rank = caseFile.reward;
        } else if (nextCaseId === null && isUnlocked(map, index)) {
            nextCaseId = caseFile.id;
        }
    });

    if (cleared === CASES.length) {
        nextCaseId = null;
    }

    return {
        cleared,
        total: CASES.length,
        attempts,
        rank,
        nextCaseId,
        percent: Math.round((cleared / CASES.length) * 100),
    };
};
