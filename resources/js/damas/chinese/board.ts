/**
 * Tablero de damas chinas: estrella de 121 huecos.
 *
 * Cada hueco se ubica en una retícula triangular. Para evitar decimales se
 * guarda `x2` (el doble de la coordenada horizontal) y la fila. Las seis
 * direcciones son: este, sudeste, sudoeste, oeste, noroeste y noreste.
 */
export const CHINESE_ROW_LENGTHS = [
    1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1,
] as const;

export const CHINESE_ROW_HEIGHT = Math.sqrt(3) / 2;

/** [dx2, dfila] de las seis direcciones de la retícula. */
export const CHINESE_DIRECTIONS = [
    [2, 0],
    [1, 1],
    [-1, 1],
    [-2, 0],
    [-1, -1],
    [1, -1],
] as const;

export interface ChineseHole {
    id: number;
    row: number;
    index: number;
    x2: number;
}

export interface ChineseBoard {
    holes: ChineseHole[];
    /** Vecino inmediato por dirección, o null si no existe. */
    neighbors: (number | null)[][];
    /** Hueco al otro lado de un vecino, para los saltos. */
    jumps: (number | null)[][];
    /** Triángulo superior (10 huecos). */
    top: number[];
    /** Triángulo inferior (10 huecos). */
    bottom: number[];
    view: {
        width: number;
        height: number;
        minX: number;
        margin: number;
    };
}

const buildBoard = (): ChineseBoard => {
    const holes: ChineseHole[] = [];
    const byKey = new Map<string, number>();
    const keyOf = (row: number, x2: number): string => `${row}:${x2}`;

    CHINESE_ROW_LENGTHS.forEach((length, row) => {
        // Todos los centros están en x2 = 16 (x = 8).
        const left2 = 16 - (length - 1);

        for (let index = 0; index < length; index += 1) {
            const x2 = left2 + index * 2;
            const id = holes.length;

            holes.push({ id, row, index, x2 });
            byKey.set(keyOf(row, x2), id);
        }
    });

    const neighbors: (number | null)[][] = [];
    const jumps: (number | null)[][] = [];

    for (const hole of holes) {
        const rowNeighbors: (number | null)[] = [];
        const rowJumps: (number | null)[] = [];

        for (const [dx2, dRow] of CHINESE_DIRECTIONS) {
            rowNeighbors.push(
                byKey.get(keyOf(hole.row + dRow, hole.x2 + dx2)) ?? null,
            );
            rowJumps.push(
                byKey.get(keyOf(hole.row + dRow * 2, hole.x2 + dx2 * 2)) ??
                    null,
            );
        }

        neighbors.push(rowNeighbors);
        jumps.push(rowJumps);
    }

    const top = holes.filter((hole) => hole.row <= 3).map((hole) => hole.id);
    const bottom = holes
        .filter((hole) => hole.row >= 13)
        .map((hole) => hole.id);

    const minX = 2;
    const maxX = 14;
    const maxY = 16 * CHINESE_ROW_HEIGHT;
    const margin = 0.9;

    return {
        holes,
        neighbors,
        jumps,
        top,
        bottom,
        view: {
            width: maxX - minX + margin * 2,
            height: maxY + margin * 2,
            minX,
            margin,
        },
    };
};

export const CHINESE_BOARD = buildBoard();

/** Coordenada visual (unidades del SVG) de un hueco. */
export const holePoint = (id: number): { x: number; y: number } => {
    const hole = CHINESE_BOARD.holes[id];

    return {
        x: hole.x2 / 2 - CHINESE_BOARD.view.minX + CHINESE_BOARD.view.margin,
        y: hole.row * CHINESE_ROW_HEIGHT + CHINESE_BOARD.view.margin,
    };
};

/** Porcentajes para posicionar los botones HTML sobre el SVG. */
export const holePercent = (id: number): { left: number; top: number } => {
    const point = holePoint(id);

    return {
        left: (point.x / CHINESE_BOARD.view.width) * 100,
        top: (point.y / CHINESE_BOARD.view.height) * 100,
    };
};

export const holeName = (id: number): string => {
    const hole = CHINESE_BOARD.holes[id];

    return `F${hole.row + 1}·P${hole.index + 1}`;
};

export const holeSpokenName = (id: number): string => {
    const hole = CHINESE_BOARD.holes[id];

    return `fila ${hole.row + 1}, posición ${hole.index + 1}`;
};

/**
 * Contorno aproximado de la estrella para el fondo del tablero.
 * Las coordenadas ya están en el sistema visual del SVG.
 */
export const CHINESE_STAR_POINTS = (() => {
    const point = (x: number, row: number): string => {
        const px = x - CHINESE_BOARD.view.minX + CHINESE_BOARD.view.margin;
        const py = row * CHINESE_ROW_HEIGHT + CHINESE_BOARD.view.margin;

        return `${px.toFixed(3)},${py.toFixed(3)}`;
    };

    return [
        point(8, -0.45),
        point(10.6, 3),
        point(14.45, 4),
        point(10.6, 8),
        point(14.45, 12),
        point(10.6, 13),
        point(8, 16.45),
        point(5.4, 13),
        point(1.55, 12),
        point(5.4, 8),
        point(1.55, 4),
        point(5.4, 3),
    ].join(' ');
})();
