import { CHINESE_BOARD, CHINESE_DIRECTIONS } from './board';

export type ChinesePlayer = 0 | 1;
export type ChineseCell = ChinesePlayer | null;

export interface ChineseMove {
    from: number;
    to: number;
    path: number[];
    player: ChinesePlayer;
    kind: 'step' | 'jump';
}

export const otherPlayer = (player: ChinesePlayer): ChinesePlayer =>
    player === 0 ? 1 : 0;

/** Posición inicial: oscuro arriba, claro abajo. */
export const createChineseBoard = (): ChineseCell[] => {
    const board: ChineseCell[] = Array.from(
        { length: CHINESE_BOARD.holes.length },
        () => null,
    );

    for (const hole of CHINESE_BOARD.top) {
        board[hole] = 1;
    }

    for (const hole of CHINESE_BOARD.bottom) {
        board[hole] = 0;
    }

    return board;
};

export const targetFor = (player: ChinesePlayer): number[] =>
    player === 0 ? CHINESE_BOARD.top : CHINESE_BOARD.bottom;

export const homeFor = (player: ChinesePlayer): number[] =>
    player === 0 ? CHINESE_BOARD.bottom : CHINESE_BOARD.top;

/**
 * Movimientos legales de una canica: un paso a un hueco vecino o una cadena
 * de saltos. En los saltos la canica saltada no se retira.
 */
export const movesForHole = (
    board: ChineseCell[],
    holeId: number,
    player: ChinesePlayer,
): ChineseMove[] => {
    if (board[holeId] !== player) {
        return [];
    }

    const found = new Map<number, number[]>();
    const stepDestinations = new Set<number>();
    const visited = new Set<number>([holeId]);
    const queue: Array<{ at: number; path: number[] }> = [];

    // Pasos simples.
    CHINESE_DIRECTIONS.forEach((_, direction) => {
        const neighbor = CHINESE_BOARD.neighbors[holeId][direction];

        if (neighbor !== null && board[neighbor] === null) {
            found.set(neighbor, [neighbor]);
            stepDestinations.add(neighbor);
        }
    });

    // Saltos encadenados.
    CHINESE_DIRECTIONS.forEach((_, direction) => {
        const over = CHINESE_BOARD.neighbors[holeId][direction];
        const land = CHINESE_BOARD.jumps[holeId][direction];

        if (
            over !== null &&
            land !== null &&
            board[over] !== null &&
            board[land] === null &&
            !visited.has(land)
        ) {
            visited.add(land);
            const path = [land];
            if (!found.has(land)) {
                found.set(land, path);
            }
            queue.push({ at: land, path });
        }
    });

    while (queue.length > 0) {
        const current = queue.shift();

        if (current === undefined) {
            break;
        }

        CHINESE_DIRECTIONS.forEach((_, direction) => {
            const over = CHINESE_BOARD.neighbors[current.at][direction];
            const land = CHINESE_BOARD.jumps[current.at][direction];

            if (
                over === null ||
                land === null ||
                board[over] === null ||
                board[land] !== null
            ) {
                return;
            }

            const path = [...current.path, land];

            if (!found.has(land)) {
                found.set(land, path);
            }

            if (!visited.has(land)) {
                visited.add(land);
                queue.push({ at: land, path });
            }
        });
    }

    return [...found.entries()]
        .map(([to, path]): ChineseMove => ({
            from: holeId,
            to,
            path,
            player,
            kind: stepDestinations.has(to) ? 'step' : 'jump',
        }))
        .sort((left, right) => {
            const leftHole = CHINESE_BOARD.holes[left.to];
            const rightHole = CHINESE_BOARD.holes[right.to];

            return leftHole.row - rightHole.row || leftHole.x2 - rightHole.x2;
        });
};

export const movesForPlayer = (
    board: ChineseCell[],
    player: ChinesePlayer,
): ChineseMove[] => {
    const moves: ChineseMove[] = [];

    board.forEach((cell, holeId) => {
        if (cell === player) {
            moves.push(...movesForHole(board, holeId, player));
        }
    });

    return moves;
};

export const hasAnyMove = (
    board: ChineseCell[],
    player: ChinesePlayer,
): boolean =>
    board.some(
        (cell, holeId) =>
            cell === player && movesForHole(board, holeId, player).length > 0,
    );

/** Cantidad de canicas propias dentro del triángulo objetivo. */
export const targetProgress = (
    board: ChineseCell[],
    player: ChinesePlayer,
): number =>
    targetFor(player).filter((holeId) => board[holeId] === player).length;

/** Gana quien ocupa por completo el triángulo opuesto. */
export const hasWon = (board: ChineseCell[], player: ChinesePlayer): boolean =>
    targetFor(player).every((holeId) => board[holeId] === player);

/** Aplica un movimiento sin mutar el tablero original. */
export const applyChineseMove = (
    board: ChineseCell[],
    move: ChineseMove,
): ChineseCell[] => {
    const next = [...board];

    next[move.from] = null;
    next[move.to] = move.player;

    return next;
};
