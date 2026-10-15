import { BOARD_SIZE } from './constants';
import type { Board, Cell, Piece, Side } from './types';
import { DEFAULT_VARIANT, rulesFor, type VariantId } from './variants';

export const rowOf = (index: number, size = BOARD_SIZE): number =>
    Math.floor(index / size);
export const colOf = (index: number, size = BOARD_SIZE): number => index % size;

export const indexOf = (row: number, col: number, size = BOARD_SIZE): number =>
    row * size + col;

export const isInside = (
    row: number,
    col: number,
    size = BOARD_SIZE,
): boolean => row >= 0 && row < size && col >= 0 && col < size;

export const isPlayable = (
    row: number,
    col: number,
    variant: VariantId = DEFAULT_VARIANT,
): boolean => {
    const playable = rulesFor(variant).playable;

    return (
        playable === 'all' ||
        (playable === 'light' && (row + col) % 2 === 0) ||
        (playable === 'dark' && (row + col) % 2 === 1)
    );
};

export const isPromotionRow = (
    side: Side,
    row: number,
    variant: VariantId = DEFAULT_VARIANT,
): boolean =>
    row === (side === 'operador' ? 0 : rulesFor(variant).boardSize - 1);

export const emptyBoard = (variant: VariantId = DEFAULT_VARIANT): Board => {
    const size = rulesFor(variant).boardSize;

    return Array.from({ length: size * size }, (): Cell => null);
};

export const createInitialBoard = (
    variant: VariantId = DEFAULT_VARIANT,
): Board => {
    const rules = rulesFor(variant);
    const board = emptyBoard(variant);

    (['entidad', 'operador'] as const).forEach((side) => {
        for (let line = 0; line < rules.startingRows; line += 1) {
            const row =
                side === 'entidad'
                    ? variant === 'turkish'
                        ? line + 1
                        : line
                    : variant === 'turkish'
                      ? rules.boardSize - 2 - line
                      : rules.boardSize - 1 - line;

            for (let col = 0; col < rules.boardSize; col += 1) {
                if (isPlayable(row, col, variant)) {
                    board[indexOf(row, col, rules.boardSize)] = {
                        side,
                        kind: 'man',
                    };
                }
            }
        }
    });

    return board;
};

/** Copia de trabajo: el motor muta tableros clonados por rendimiento. */
export const cloneBoard = (board: Board): Board => board.slice();

export const place = (board: Board, index: number, piece: Piece): void => {
    board[index] = piece;
};

export const clear = (board: Board, index: number): void => {
    board[index] = null;
};

export const pieceAt = (board: Board, index: number): Cell =>
    board[index] ?? null;

/** Clave única de posición (tablero + bando a mover), para repeticiones y TT. */
export const positionKey = (
    board: Board,
    side: Side,
    variant: VariantId = DEFAULT_VARIANT,
): string => {
    let key = '';
    for (let i = 0; i < board.length; i += 1) {
        const cell = board[i];
        if (cell === null) {
            key += '.';
        } else if (cell.kind === 'king') {
            key += cell.side === 'operador' ? 'O' : 'E';
        } else {
            key += cell.side === 'operador' ? 'o' : 'e';
        }
    }
    return `${variant}:${key}${side === 'operador' ? '1' : '2'}`;
};

export const squareName = (
    index: number,
    variant: VariantId = DEFAULT_VARIANT,
): string => {
    const size = rulesFor(variant).boardSize;
    const col = String.fromCharCode(65 + colOf(index, size));

    return `${col}${size - rowOf(index, size)}`;
};

export const toLetter = (
    index: number,
    variant: VariantId = DEFAULT_VARIANT,
): string => squareName(index, variant);

export const sideLabel = (side: Side): string =>
    side === 'operador' ? 'NOS' : 'ELLOS';

export const opposite = (side: Side): Side =>
    side === 'operador' ? 'entidad' : 'operador';
