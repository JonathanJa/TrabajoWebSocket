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

/** Tabla de transposicion con tope de memoria: se vacia al desbordar. */
export class TranspositionTable {
    private readonly entries = new Map<number, TTEntry>();

    public read(a: number, b: number): TTEntry | undefined {
        return this.entries.get(packKey(a, b));
    }

    public write(a: number, b: number, entry: TTEntry): void {
        if (this.entries.size >= MAX_ENTRIES) {
            this.entries.clear();
        }

        this.entries.set(packKey(a, b), entry);
    }

    public get size(): number {
        return this.entries.size;
    }
}
