import { MAX_CELL_COUNT } from '../engine/constants';
import type { Board, Piece, Side } from '../engine/types';

/** Códigos de pieza usados por las tablas de hash. */
export const OPERADOR_MAN = 0;
export const OPERADOR_KING = 1;
export const ENTIDAD_MAN = 2;
export const ENTIDAD_KING = 3;

const CODES = 4;

export const pieceCode = (piece: Piece): number => {
    if (piece.side === 'operador') {
        return piece.kind === 'king' ? OPERADOR_KING : OPERADOR_MAN;
    }

    return piece.kind === 'king' ? ENTIDAD_KING : ENTIDAD_MAN;
};

/** PRNG determinista: las claves son estables entre sesiones. */
const makeRandom = (seed: number): (() => number) => {
    let state = seed | 0;

    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return (t ^ (t >>> 14)) >>> 0;
    };
};

const buildTables = (): { a: Int32Array; b: Int32Array } => {
    const random = makeRandom(0x5eedc0de);
    const a = new Int32Array(MAX_CELL_COUNT * CODES);
    const b = new Int32Array(MAX_CELL_COUNT * CODES);

    for (let i = 0; i < a.length; i += 1) {
        a[i] = random() | 0;
        b[i] = random() | 0;
    }

    return { a, b };
};

const { a: TABLE_A, b: TABLE_B } = buildTables();

const random = makeRandom(0x1234abcd);
export const SIDE_KEY_A = random() | 0;
export const SIDE_KEY_B = random() | 0;

export const xorPieceA = (key: number, index: number, code: number): number =>
    key ^ TABLE_A[index * CODES + code];

export const xorPieceB = (key: number, index: number, code: number): number =>
    key ^ TABLE_B[index * CODES + code];

/** Clave de 53 bits (segura como entero JS) a partir de las dos palabras. */
export const packKey = (a: number, b: number): number =>
    a * 2097152 + (b >>> 11);

export const keyOf = (board: Board, side: Side): { a: number; b: number } => {
    let a = 0;
    let b = 0;

    for (let index = 0; index < board.length; index += 1) {
        const piece = board[index];

        if (piece !== null) {
            const code = pieceCode(piece);
            a = xorPieceA(a, index, code);
            b = xorPieceB(b, index, code);
        }
    }

    if (side === 'entidad') {
        a ^= SIDE_KEY_A;
        b ^= SIDE_KEY_B;
    }

    return { a, b };
};
