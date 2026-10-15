import { FORWARD_ROW } from './constants';
import { indexOf, isInside, isPromotionRow, rowOf, colOf } from './board';
import type { Board, Cell, Move, MoveStep, Side } from './types';
import {
    allDirections,
    DEFAULT_VARIANT,
    manCaptureDirections,
    rulesFor,
    type Direction,
    type VariantId,
    type VariantRules,
} from './variants';

const NO_VALUES: number[] = [];

interface Options {
    /** El motor de búsqueda no necesita `path` ni `steps`: ahorra memoria. */
    light?: boolean;
}

interface Jump {
    to: number;
    captured: number;
    direction: Direction;
}

interface ChainState {
    board: Board;
    side: Side;
    mover: Cell;
    light: boolean;
    rules: VariantRules;
    from: number;
    path: number[];
    captures: number[];
    captured: Set<number>;
    steps: MoveStep[];
    previousDirection: Direction | null;
    results: Move[];
}

const jumpOptions = (state: ChainState, index: number): Jump[] => {
    const { board, side, mover, rules, captured } = state;
    const size = rules.boardSize;
    const row = rowOf(index, size);
    const col = colOf(index, size);
    const jumps: Jump[] = [];

    if (mover?.kind === 'king' && rules.flyingKings) {
        for (const direction of allDirections(rules.kingMovement)) {
            let distance = 1;
            let victimIndex: number | null = null;

            while (
                isInside(
                    row + direction[0] * distance,
                    col + direction[1] * distance,
                    size,
                )
            ) {
                const target = indexOf(
                    row + direction[0] * distance,
                    col + direction[1] * distance,
                    size,
                );
                const piece = board[target];

                if (piece !== null) {
                    if (
                        victimIndex !== null ||
                        piece.side === side ||
                        captured.has(target)
                    ) {
                        break;
                    }

                    victimIndex = target;
                } else if (victimIndex !== null) {
                    jumps.push({
                        to: target,
                        captured: victimIndex,
                        direction,
                    });
                }

                distance += 1;
            }
        }

        return jumps;
    }

    const directions =
        mover?.kind === 'king'
            ? allDirections(rules.kingMovement)
            : manCaptureDirections(side, rules);

    for (const direction of directions) {
        const victimRow = row + direction[0];
        const victimCol = col + direction[1];
        const landRow = row + direction[0] * 2;
        const landCol = col + direction[1] * 2;

        if (!isInside(landRow, landCol, size)) {
            continue;
        }

        const victimIndex = indexOf(victimRow, victimCol, size);
        const victim = board[victimIndex];

        if (
            victim === null ||
            victim.side === side ||
            captured.has(victimIndex)
        ) {
            continue;
        }

        const landing = indexOf(landRow, landCol, size);

        if (board[landing] !== null) {
            continue;
        }

        jumps.push({ to: landing, captured: victimIndex, direction });
    }

    return jumps;
};

const closeChain = (state: ChainState): void => {
    const size = state.rules.boardSize;
    const to = state.path[state.path.length - 1] ?? state.from;

    state.results.push({
        from: state.from,
        to,
        path: state.light ? NO_VALUES : [...state.path],
        captures: [...state.captures],
        steps: state.light ? [] : [...state.steps],
        promotion:
            state.mover !== null &&
            state.mover.kind === 'man' &&
            isPromotionRow(state.side, rowOf(to, size), state.rules.id),
    });
};

const exploreChain = (state: ChainState, index: number): void => {
    const jumps = jumpOptions(state, index);

    if (jumps.length === 0) {
        if (state.captures.length > 0) {
            closeChain(state);
        }

        return;
    }

    for (const jump of jumps) {
        const { board, rules, mover } = state;

        if (
            rules.forbidKingReverseCapture &&
            mover?.kind === 'king' &&
            state.previousDirection !== null &&
            jump.direction[0] === -state.previousDirection[0] &&
            jump.direction[1] === -state.previousDirection[1]
        ) {
            continue;
        }

        const victim = board[jump.captured];
        const wasRemoved = rules.capturedPiecesRemovedImmediately;

        board[index] = null;
        if (wasRemoved) {
            board[jump.captured] = null;
        }
        board[jump.to] = mover;

        state.path.push(jump.to);
        state.captures.push(jump.captured);
        state.captured.add(jump.captured);
        state.steps.push({ from: index, to: jump.to, captured: jump.captured });
        const previousDirection = state.previousDirection;
        state.previousDirection = jump.direction;

        const endsAtPromotion =
            mover?.kind === 'man' &&
            isPromotionRow(
                state.side,
                rowOf(jump.to, rules.boardSize),
                rules.id,
            );

        if (endsAtPromotion && rules.promotionStopsCapture) {
            closeChain(state);
        } else {
            exploreChain(state, jump.to);
        }

        state.previousDirection = previousDirection;
        state.steps.pop();
        state.captured.delete(jump.captured);
        state.captures.pop();
        state.path.pop();

        board[jump.to] = null;
        if (wasRemoved) {
            board[jump.captured] = victim;
        }
        board[index] = mover;
    }
};

export const generateCaptures = (
    board: Board,
    side: Side,
    options: Options = {},
    variant: VariantId = DEFAULT_VARIANT,
): Move[] => {
    const rules = rulesFor(variant);
    const results: Move[] = [];

    for (let index = 0; index < board.length; index += 1) {
        const mover = board[index];

        if (mover === null || mover.side !== side) {
            continue;
        }

        exploreChain(
            {
                board,
                side,
                mover,
                light: options.light === true,
                rules,
                from: index,
                path: [index],
                captures: [],
                captured: new Set(),
                steps: [],
                previousDirection: null,
                results,
            },
            index,
        );
    }

    return results;
};

const capturedKings = (board: Board, move: Move): number =>
    move.captures.reduce(
        (count, index) => count + (board[index]?.kind === 'king' ? 1 : 0),
        0,
    );

export const filterMaxCaptures = (
    board: Board,
    moves: Move[],
    rules: VariantRules,
): Move[] => {
    let maxPieces = 0;

    for (const move of moves) {
        maxPieces = Math.max(maxPieces, move.captures.length);
    }

    let filtered = moves.filter((move) => move.captures.length === maxPieces);

    if (rules.kingCapturePriority && filtered.length > 1) {
        const maxKings = Math.max(
            ...filtered.map((move) => capturedKings(board, move)),
        );
        filtered = filtered.filter(
            (move) => capturedKings(board, move) === maxKings,
        );
    }

    return filtered;
};

const quietTargets = (
    board: Board,
    side: Side,
    index: number,
    variant: VariantId,
): number[] => {
    const rules = rulesFor(variant);
    const size = rules.boardSize;
    const row = rowOf(index, size);
    const col = colOf(index, size);
    const mover = board[index];
    const targets: number[] = [];
    const directions =
        mover?.kind === 'king'
            ? allDirections(rules.kingMovement)
            : allDirections(rules.manMovement).filter(
                  ([dr]) =>
                      dr === FORWARD_ROW[side] ||
                      (rules.manMovement === 'orthogonal' && dr === 0),
              );

    for (const [dr, dc] of directions) {
        let distance = 1;

        while (isInside(row + dr * distance, col + dc * distance, size)) {
            const target = indexOf(
                row + dr * distance,
                col + dc * distance,
                size,
            );

            if (board[target] !== null) {
                break;
            }

            targets.push(target);

            if (mover?.kind !== 'king' || !rules.flyingKings) {
                break;
            }

            distance += 1;
        }
    }

    return targets;
};

export const generateQuietMoves = (
    board: Board,
    side: Side,
    variant: VariantId = DEFAULT_VARIANT,
): Move[] => {
    const rules = rulesFor(variant);
    const moves: Move[] = [];

    for (let index = 0; index < board.length; index += 1) {
        const mover = board[index];

        if (mover === null || mover.side !== side) {
            continue;
        }

        for (const to of quietTargets(board, side, index, variant)) {
            moves.push({
                from: index,
                to,
                path: [index, to],
                captures: NO_VALUES,
                steps: [],
                promotion:
                    mover.kind === 'man' &&
                    isPromotionRow(side, rowOf(to, rules.boardSize), variant),
            });
        }
    }

    return moves;
};

export const generateMoves = (
    board: Board,
    side: Side,
    options: Options = {},
    variant: VariantId = DEFAULT_VARIANT,
): Move[] => {
    const rules = rulesFor(variant);
    const captures = generateCaptures(board, side, options, variant);

    if (captures.length > 0) {
        return filterMaxCaptures(board, captures, rules);
    }

    return generateQuietMoves(board, side, variant);
};

export const legalMovesFrom = (
    board: Board,
    side: Side,
    from: number,
    variant: VariantId = DEFAULT_VARIANT,
): Move[] =>
    generateMoves(board, side, {}, variant).filter(
        (move) => move.from === from,
    );
