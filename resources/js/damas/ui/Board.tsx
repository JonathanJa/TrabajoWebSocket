import { Crown } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { colOf, isPlayable, rowOf, squareName } from '../engine/board';
import type { AnimationFrame } from '../game/animation';
import type { Board as BoardModel, Move, Piece, Side } from '../engine/types';
import { DEFAULT_VARIANT, rulesFor, type VariantId } from '../engine/variants';

interface BoardProps {
    board: BoardModel;
    animation: AnimationFrame | null;
    selection: number | null;
    targets: Map<number, Move>;
    lastMove: Move | null;
    onSquare: (index: number) => void;
    /** Cancela la selección actual (tecla Escape). */
    onCancel?: () => void;
    interactive: boolean;
    variant?: VariantId;
    flipped?: boolean;
    /** Bando que mira el tablero; null en duelos locales o como espectador. */
    viewer?: Side | null;
    /** Fichas que pueden moverse ahora; orienta el primer foco del teclado. */
    selectable?: Set<number>;
    /** Fichas resaltadas por corrección: son las que sí pueden moverse. */
    mustMove?: Set<number>;
    /** Ficha rechazada (temblor) y contador para reiniciar el aviso. */
    rejected?: { index: number; pulse: number } | null;
    /** Vista con perspectiva y piezas en relieve. */
    depth?: boolean;
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

const pieceLabel = (piece: Piece | null, viewer: Side | null): string => {
    if (piece === null) {
        return 'casilla vacía';
    }

    const kind = piece.kind === 'king' ? 'dama' : 'ficha';

    if (viewer !== null) {
        return piece.side === viewer ? `tu ${kind}` : `${kind} rival`;
    }

    return `${kind} ${piece.side === 'operador' ? 'clara' : 'oscura'}`;
};

/**
 * En un tablero de damas solo se juega en diagonal. Las flechas recorren esas
 * diagonales: arriba = noroeste, derecha = noreste, abajo = sudeste y
 * izquierda = sudoeste. Así se llega a todas las casillas jugables.
 */
const stepDisplay = (
    display: number,
    rowStep: number,
    colStep: number,
    size: number,
    flipped: boolean,
    variant: VariantId,
): number | null => {
    const row = rowOf(display, size) + rowStep;
    const col = colOf(display, size) + colStep;

    if (row < 0 || col < 0 || row >= size || col >= size) {
        return null;
    }

    const candidate = row * size + col;
    const index = flipped ? size * size - 1 - candidate : candidate;

    return isPlayable(rowOf(index, size), colOf(index, size), variant)
        ? candidate
        : null;
};

export const Board = ({
    board,
    animation,
    selection,
    targets,
    lastMove,
    onSquare,
    onCancel,
    interactive,
    variant = DEFAULT_VARIANT,
    flipped = false,
    viewer = null,
    selectable,
    mustMove,
    rejected = null,
    depth = false,
}: BoardProps) => {
    const rules = rulesFor(variant);
    const size = rules.boardSize;
    const playablePattern = rules.playable;
    const cellPercent = 100 / size;
    const captured = new Set(animation?.captured ?? []);
    const movable = new Set<number>();
    const helpId = useId();
    const gridRef = useRef<HTMLDivElement | null>(null);
    const [focusDisplay, setFocusDisplay] = useState<number | null>(null);

    targets.forEach((move) => {
        move.captures.forEach((index) => movable.add(index));
    });

    let firstPlayable = 0;

    for (let display = 0; display < size * size; display += 1) {
        const index = flipped ? size * size - 1 - display : display;

        if (isPlayable(rowOf(index, size), colOf(index, size), variant)) {
            firstPlayable = display;

            break;
        }
    }

    const focusIndex =
        focusDisplay === null
            ? null
            : flipped
              ? size * size - 1 - focusDisplay
              : focusDisplay;
    const focusPlayable =
        focusDisplay !== null &&
        focusDisplay < size * size &&
        focusIndex !== null &&
        isPlayable(rowOf(focusIndex, size), colOf(focusIndex, size), variant);

    // El primer tabulador del tablero cae sobre una ficha que se puede mover,
    // para que una persona con teclado no tenga que buscar su bando.
    let firstSelectableDisplay: number | null = null;

    if (selectable !== undefined) {
        selectable.forEach((index) => {
            const display = toDisplay(index, flipped, size);

            if (
                firstSelectableDisplay === null ||
                display < firstSelectableDisplay
            ) {
                firstSelectableDisplay = display;
            }
        });
    }

    const tabDisplay = focusPlayable
        ? focusDisplay
        : selection === null
          ? (firstSelectableDisplay ?? firstPlayable)
          : toDisplay(selection, flipped, size);

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

    const focusSquare = (display: number): void => {
        setFocusDisplay(display);
        gridRef.current
            ?.querySelector<HTMLButtonElement>(`[data-display="${display}"]`)
            ?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        const origin = event.target as HTMLElement;
        const raw = origin.dataset.display;

        if (raw === undefined) {
            return;
        }

        if (event.key === 'Escape') {
            if (
                selection !== null ||
                (mustMove !== undefined && mustMove.size > 0)
            ) {
                event.preventDefault();
                onCancel?.();
            }

            return;
        }

        if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            let display =
                event.key === 'Home' ? firstPlayable : size * size - 1;

            if (event.key === 'End') {
                for (let cell = size * size - 1; cell >= 0; cell -= 1) {
                    const index = flipped ? size * size - 1 - cell : cell;

                    if (
                        isPlayable(
                            rowOf(index, size),
                            colOf(index, size),
                            variant,
                        )
                    ) {
                        display = cell;

                        break;
                    }
                }
            }

            focusSquare(display);

            return;
        }

        const steps: Record<string, [number, number]> = {
            ArrowUp: [-1, -1],
            ArrowRight: [-1, 1],
            ArrowDown: [1, 1],
            ArrowLeft: [1, -1],
        };
        const direction = steps[event.key];

        if (direction === undefined) {
            return;
        }

        event.preventDefault();

        const next = stepDisplay(
            Number(raw),
            direction[0],
            direction[1],
            size,
            flipped,
            variant,
        );

        if (next !== null) {
            focusSquare(next);
        }
    };

    const selectedPiece = selection === null ? null : board[selection];
    const destinations = [...targets.entries()].map(
        ([to, move]) =>
            `${squareName(to, variant)}${move.captures.length > 0 ? ' con captura' : ''}`,
    );
    const correction =
        mustMove !== undefined && mustMove.size > 0
            ? `Movimiento no permitido. Fichas que sí pueden moverse: ${[
                  ...mustMove,
              ]
                  .map((index) => squareName(index, variant))
                  .join(', ')}.`
            : '';
    const selectionAnnouncement =
        selection === null
            ? ''
            : `Ficha en ${squareName(selection, variant)} seleccionada${
                  selectedPiece === null
                      ? ''
                      : `, ${pieceLabel(selectedPiece, viewer)}`
              }. ${
                  destinations.length === 0
                      ? 'No tiene movimientos disponibles.'
                      : `${destinations.length} movimiento${
                            destinations.length === 1 ? '' : 's'
                        } posible${
                            destinations.length === 1 ? '' : 's'
                        }: ${destinations.join(', ')}. Usá las flechas hacia el destino y Enter.`
              }`;

    return (
        <div
            className={`d-board ${
                playablePattern === 'light' ? 'd-board--light-squares' : ''
            } ${playablePattern === 'all' ? 'd-board--all-squares' : ''} ${
                depth ? 'd-board--3d' : ''
            }`}
        >
            <p id={helpId} className="sr-only">
                Tablero de {rules.name}, {size} por {size}. Las flechas recorren
                las diagonales: arriba va hacia arriba-izquierda, derecha hacia
                arriba-derecha, abajo hacia abajo-derecha e izquierda hacia
                abajo-izquierda. Enter o espacio para seleccionar una ficha o
                confirmar un movimiento. Escape para cancelar la selección.
            </p>
            <div
                ref={gridRef}
                className="d-board__grid"
                role="group"
                aria-label={`Tablero de ${rules.name}, ${size} por ${size}`}
                aria-describedby={helpId}
                style={{
                    gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
                }}
                onKeyDown={handleKeyDown}
            >
                {Array.from({ length: size * size }, (_, cell) => {
                    const index = flipped ? size * size - 1 - cell : cell;
                    const row = rowOf(index, size);
                    const col = colOf(index, size);

                    if (!isPlayable(row, col, variant)) {
                        return <div key={index} className="d-sq d-sq--void" />;
                    }

                    const piece = board[index];
                    const isSelected = selection === index;
                    const targetMove = targets.get(index);
                    const isTarget = targetMove !== undefined;
                    const isLast =
                        lastMove !== null &&
                        (lastMove.from === index || lastMove.to === index);
                    const isCapturable = movable.has(index);
                    const isMust = mustMove?.has(index) === true;
                    const states = [
                        pieceLabel(piece, viewer),
                        isSelected ? 'seleccionada' : '',
                        isTarget ? 'movimiento posible' : '',
                        isTarget && (targetMove?.captures.length ?? 0) > 0
                            ? 'captura'
                            : '',
                        isLast ? 'última jugada' : '',
                        isCapturable ? 'pieza capturable' : '',
                        isMust ? 'se puede mover' : '',
                    ].filter((value) => value !== '');

                    return (
                        <button
                            key={index}
                            type="button"
                            data-display={cell}
                            tabIndex={cell === tabDisplay ? 0 : -1}
                            className={[
                                'd-sq',
                                'd-sq--field',
                                isSelected ? 'd-sq--sel' : '',
                                isTarget ? 'd-sq--dest' : '',
                                isLast ? 'd-sq--last' : '',
                                isCapturable ? 'd-sq--capturable' : '',
                                isMust ? 'd-sq--must' : '',
                            ]
                                .filter((value) => value !== '')
                                .join(' ')}
                            onClick={() => {
                                if (interactive) {
                                    onSquare(index);
                                }
                            }}
                            onFocus={() => setFocusDisplay(cell)}
                            aria-disabled={interactive ? undefined : true}
                            aria-label={`${squareName(index, variant)}, ${states.join(', ')}`}
                        >
                            {null}
                        </button>
                    );
                })}
            </div>

            <p className="sr-only" role="status" aria-live="polite" aria-atomic>
                {correction === '' ? selectionAnnouncement : correction}
            </p>

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

            <div className="d-pieces" aria-hidden="true">
                {board.map((piece, index) => {
                    if (piece === null) {
                        return null;
                    }

                    if (animation !== null && index === animation.from) {
                        return null;
                    }

                    const square = toDisplay(index, flipped, size);
                    const beaten = captured.has(index);
                    const isMust = mustMove?.has(index) === true;
                    const rejection =
                        rejected !== null && rejected.index === index
                            ? rejected.pulse
                            : null;

                    return (
                        <div
                            key={
                                rejection === null
                                    ? index
                                    : `${index}-r${rejection}`
                            }
                            className={[
                                'd-piece',
                                beaten ? 'd-piece--beat' : '',
                                isMust ? 'd-piece--must' : '',
                                rejection === null ? '' : 'd-piece--rejected',
                            ]
                                .filter((value) => value !== '')
                                .join(' ')}
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
