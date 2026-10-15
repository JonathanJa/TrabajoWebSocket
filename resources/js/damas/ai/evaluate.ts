import { KING_VALUE, MAN_VALUE } from '../engine/constants';
import { colOf, indexOf, isInside, opposite, rowOf } from '../engine/board';
import type { Board, Side } from '../engine/types';
import {
    allDirections,
    DEFAULT_VARIANT,
    manCaptureDirections,
    rulesFor,
    type Direction,
    type VariantId,
} from '../engine/variants';

const EDGE_BONUS = 3;
const BACK_ROW_BONUS = 7;
const ADVANCE_BONUS = 2;
const EN_PRISE_PENALTY = 15;
const KING_EDGE_PENALTY = 5;
const KING_CENTER_MULTIPLIER = 2;

const uniqueDirections = (directions: Direction[]): Direction[] =>
    directions.filter(
        (direction, index) =>
            directions.findIndex(
                (candidate) =>
                    candidate[0] === direction[0] &&
                    candidate[1] === direction[1],
            ) === index,
    );

const isThreatened = (
    board: Board,
    index: number,
    side: Side,
    variant: VariantId,
): boolean => {
    const rules = rulesFor(variant);
    const size = rules.boardSize;
    const row = rowOf(index, size);
    const col = colOf(index, size);
    const enemy = opposite(side);
    const directions = uniqueDirections([
        ...manCaptureDirections(enemy, rules),
        ...allDirections(rules.kingMovement),
    ]);

    for (const [dr, dc] of directions) {
        const hunterRow = row - dr;
        const hunterCol = col - dc;
        const landingRow = row + dr;
        const landingCol = col + dc;

        if (
            !isInside(hunterRow, hunterCol, size) ||
            !isInside(landingRow, landingCol, size)
        ) {
            continue;
        }

        const hunter = board[indexOf(hunterRow, hunterCol, size)];
        const landing = board[indexOf(landingRow, landingCol, size)];

        if (hunter?.side === enemy && landing === null) {
            return true;
        }
    }

    return false;
};

/** Evaluación estática desde la perspectiva de `side` (centipeones). */
export const evaluate = (
    board: Board,
    side: Side,
    variant: VariantId = DEFAULT_VARIANT,
): number => {
    const size = rulesFor(variant).boardSize;
    const center = (size - 1) / 2;
    let score = 0;

    for (let index = 0; index < board.length; index += 1) {
        const cell = board[index];

        if (cell === null) {
            continue;
        }

        const mine = cell.side === side;
        const row = rowOf(index, size);
        const col = colOf(index, size);
        const onEdge = col === 0 || col === size - 1;
        const centerValue = Math.max(
            0,
            size - Math.round(Math.abs(row - center) + Math.abs(col - center)),
        );
        let value = cell.kind === 'king' ? KING_VALUE : MAN_VALUE;

        if (cell.kind === 'king') {
            value += centerValue * KING_CENTER_MULTIPLIER;
            value -= onEdge ? KING_EDGE_PENALTY : 0;
        } else {
            const advance = cell.side === 'operador' ? size - 1 - row : row;
            const homeRow = cell.side === 'operador' ? size - 1 : 0;

            value += advance * ADVANCE_BONUS;
            value += centerValue;
            value += onEdge ? EDGE_BONUS : 0;
            value += row === homeRow ? BACK_ROW_BONUS : 0;
        }

        if (mine) {
            value -= isThreatened(board, index, side, variant)
                ? EN_PRISE_PENALTY
                : 0;
            score += value;
        } else {
            score -= value;
        }
    }

    return score;
};
