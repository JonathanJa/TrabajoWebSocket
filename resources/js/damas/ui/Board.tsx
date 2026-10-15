import { Crown } from 'lucide-react';
import { colOf, isPlayable, rowOf, squareName } from '../engine/board';
import type { AnimationFrame } from '../game/animation';
import type { Board as BoardModel, Move, Piece } from '../engine/types';
import { DEFAULT_VARIANT, rulesFor, type VariantId } from '../engine/variants';

interface BoardProps {
    board: BoardModel;
    animation: AnimationFrame | null;
    selection: number | null;
    targets: Map<number, Move>;
    lastMove: Move | null;
    onSquare: (index: number) => void;
    interactive: boolean;
    variant?: VariantId;
    flipped?: boolean;
}

const toDisplay = (index: number, flipped: boolean, size: number): number =>
    flipped ? size * size - 1 - index : index;

const discClass = (side: Piece['side']): string =>
    side === 'operador' ? 'd-disc--us' : 'd-disc--them';

const PieceDisc = ({ piece, crowned }: { piece: Piece; crowned: boolean }) => {
    const isKing = piece.kind === 'king' || crowned;

    return (
        <span
            className={`d-disc ${discClass(piece.side)} ${isKing ? 'd-disc--king' : ''}`}
        >
            {isKing ? (
                <Crown className="d-disc__mark" strokeWidth={2.6} />
            ) : null}
        </span>
    );
};

const pieceLabel = (piece: Piece | null): string => {
    if (piece === null) {
        return '';
    }

    const side = piece.side === 'operador' ? 'nos' : 'ellos';

    return `, ${side}${piece.kind === 'king' ? ' dama' : ''}`;
};

export const Board = ({
    board,
    animation,
    selection,
    targets,
    lastMove,
    onSquare,
    interactive,
    variant = DEFAULT_VARIANT,
    flipped = false,
}: BoardProps) => {
    const size = rulesFor(variant).boardSize;
    const playablePattern = rulesFor(variant).playable;
    const cellPercent = 100 / size;
    const captured = new Set(animation?.captured ?? []);
    const movable = new Set<number>();

    targets.forEach((move) => {
        move.captures.forEach((index) => movable.add(index));
    });

    const center = (index: number): { x: number; y: number } => {
        const square = toDisplay(index, flipped, size);

        return { x: colOf(square, size) + 0.5, y: rowOf(square, size) + 0.5 };
    };

    const moverPiece = animation === null ? null : board[animation.from];
    const beamTo =
        animation !== null && animation.capturedNow !== null
            ? center(animation.capturedNow)
            : null;
    const beamFrom = animation === null ? null : center(animation.mover);

    return (
        <div
            className={`d-board ${
                playablePattern === 'light' ? 'd-board--light-squares' : ''
            } ${playablePattern === 'all' ? 'd-board--all-squares' : ''}`}
        >
            <div
                className="d-board__grid"
                style={{
                    gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
                }}
            >
                {Array.from({ length: size * size }, (_, cell) => {
                    const index = flipped ? size * size - 1 - cell : cell;
                    const row = rowOf(index, size);
                    const col = colOf(index, size);

                    if (!isPlayable(row, col, variant)) {
                        return <div key={index} className="d-sq d-sq--void" />;
                    }

                    const isSelected = selection === index;
                    const isTarget = targets.has(index);
                    const isLast =
                        lastMove !== null &&
                        (lastMove.from === index || lastMove.to === index);
                    const isCapturable = movable.has(index);

                    return (
                        <button
                            key={index}
                            type="button"
                            className={[
                                'd-sq',
                                'd-sq--field',
                                isSelected ? 'd-sq--sel' : '',
                                isTarget ? 'd-sq--dest' : '',
                                isLast ? 'd-sq--last' : '',
                                isCapturable ? 'd-sq--capturable' : '',
                            ]
                                .filter((value) => value !== '')
                                .join(' ')}
                            onClick={() => onSquare(index)}
                            disabled={!interactive}
                            aria-label={`${squareName(index, variant)}${pieceLabel(board[index])}`}
                        >
                            {null}
                        </button>
                    );
                })}
            </div>

            {animation === null ||
            beamFrom === null ||
            beamTo === null ? null : (
                <svg
                    className="d-beams"
                    viewBox={`0 0 ${size} ${size}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    <polyline
                        className="d-trail"
                        points={animation.trail
                            .map((index) => {
                                const point = center(index);

                                return `${point.x},${point.y}`;
                            })
                            .join(' ')}
                    />
                    <line
                        className="d-beam d-beam--abduct"
                        x1={beamFrom.x}
                        y1={beamFrom.y}
                        x2={beamTo.x}
                        y2={beamTo.y}
                    />
                </svg>
            )}

            <div className="d-pieces">
                {board.map((piece, index) => {
                    if (piece === null) {
                        return null;
                    }

                    if (animation !== null && index === animation.from) {
                        return null;
                    }

                    const square = toDisplay(index, flipped, size);
                    const beaten = captured.has(index);

                    return (
                        <div
                            key={index}
                            className={`d-piece ${beaten ? 'd-piece--beat' : ''}`}
                            style={{
                                left: `${colOf(square, size) * cellPercent}%`,
                                top: `${rowOf(square, size) * cellPercent}%`,
                                width: `${cellPercent}%`,
                                height: `${cellPercent}%`,
                            }}
                        >
                            <PieceDisc piece={piece} crowned={false} />
                        </div>
                    );
                })}

                {animation === null || moverPiece === null ? null : (
                    <div
                        key="mover"
                        className="d-piece"
                        style={{
                            left: `${colOf(toDisplay(animation.mover, flipped, size), size) * cellPercent}%`,
                            top: `${rowOf(toDisplay(animation.mover, flipped, size), size) * cellPercent}%`,
                            width: `${cellPercent}%`,
                            height: `${cellPercent}%`,
                        }}
                    >
                        <PieceDisc
                            piece={moverPiece}
                            crowned={animation.crowned}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
