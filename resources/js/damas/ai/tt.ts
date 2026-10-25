import { TT_TABLE_LIMIT } from './limits';
import { packKey } from './zobrist';

export type TTFlag = 'exact' | 'lower' | 'upper';

export interface TTEntry {
    depth: number;
    value: number;
    flag: TTFlag;
    from: number;
    to: number;
    validMove: boolean;
}

const MAX_ENTRIES = TT_TABLE_LIMIT;
/** Al desbordar se descarta la cuarta parte más antigua (no toda la tabla). */
const EVICT_SHARE = 4;

/** Tabla de transposición con tope de memoria y reemplazo por profundidad. */
export class TranspositionTable {
    private readonly entries = new Map<number, TTEntry>();

    public read(a: number, b: number): TTEntry | undefined {
        return this.entries.get(packKey(a, b));
    }

    public write(a: number, b: number, entry: TTEntry): void {
        const key = packKey(a, b);
        const current = this.entries.get(key);

        // Nunca se pierde una entrada más profunda a manos de una más pobre.
        if (current !== undefined && current.depth > entry.depth) {
            return;
        }

        if (current === undefined && this.entries.size >= MAX_ENTRIES) {
            this.evictOldest();
        }

        this.entries.set(key, entry);
    }

    private evictOldest(): void {
        const goal = Math.ceil(MAX_ENTRIES / EVICT_SHARE);

        for (const key of this.entries.keys()) {
            this.entries.delete(key);

            if (this.entries.size <= MAX_ENTRIES - goal) {
                break;
            }
        }
    }

    public get size(): number {
        return this.entries.size;
    }
}
