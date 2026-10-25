import {
    ArrowRight,
    ArrowUpRight,
    BookOpen,
    Crown,
    Flag,
    Hexagon,
    RotateCcw,
    Swords,
    Trophy,
    Undo2,
} from 'lucide-react';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
} from 'react';
import { resolveLocalNames, type LocalNames } from '../game/localNames';
import { reportLocalScore } from '../game/scores';
import { playSound } from '../game/sound';
import { StatusLine } from '../ui/Hud';
import { LocalNamesFields } from '../ui/LocalNames';
import { Bar, Button, Chip, Plate, Stat } from '../ui/primitives';
import {
    CHINESE_BOARD,
    CHINESE_ROW_LENGTHS,
    CHINESE_STAR_POINTS,
    holeName,
    holePercent,
    holePoint,
    holeSpokenName,
} from './board';
import {
    applyChineseMove,
    createChineseBoard,
    hasAnyMove,
    hasWon,
    movesForHole,
    otherPlayer,
    targetProgress,
    type ChineseCell,
    type ChineseMove,
    type ChinesePlayer,
} from './engine';

type Phase = 'setup' | 'playing';
type ChineseResult = ChinesePlayer | 'draw' | null;

interface Snapshot {
    board: ChineseCell[];
    turn: ChinesePlayer;
    moves: number;
    lastMove: ChineseMove | null;
}

interface LogEntry {
    number: number;
    player: ChinesePlayer;
    move: ChineseMove;
}

interface ChineseGameProps {
    names: LocalNames;
    onNamesChange: (names: LocalNames) => void;
    fallbackName: string;
    onOpenTutorial: () => void;
    onOpenRanking: () => void;
    onExit: () => void;
}

const START_HOLE = CHINESE_BOARD.bottom[0];

export const ChineseGame = ({
    names,
    onNamesChange,
    fallbackName,
    onOpenTutorial,
    onOpenRanking,
    onExit,
}: ChineseGameProps) => {
    const resolved = useMemo(
        () => resolveLocalNames(names, fallbackName),
        [names, fallbackName],
    );
    const nameFor = useCallback(
        (player: ChinesePlayer): string =>
            player === 0 ? resolved.operador : resolved.entidad,
        [resolved],
    );

    const [phase, setPhase] = useState<Phase>('setup');
    const [board, setBoard] = useState<ChineseCell[]>(createChineseBoard);
    const [turn, setTurn] = useState<ChinesePlayer>(0);
    const [selected, setSelected] = useState<number | null>(null);
    const [activeId, setActiveId] = useState<number>(START_HOLE);
    const [history, setHistory] = useState<Snapshot[]>([]);
    const [lastMove, setLastMove] = useState<ChineseMove | null>(null);
    const [moves, setMoves] = useState(0);
    const [result, setResult] = useState<ChineseResult>(null);
    const [message, setMessage] = useState('Elegí una canica para comenzar.');
    const [log, setLog] = useState<LogEntry[]>([]);
    const [gameId, setGameId] = useState(0);

    const holeRefs = useRef(new Map<number, HTMLButtonElement>());
    const resultRef = useRef<HTMLHeadingElement | null>(null);
    const reportedGame = useRef<number | null>(null);
    const pendingFocus = useRef<number | null>(null);
    const focusAfterMove = useRef<number | null>(null);

    const startGame = useCallback(() => {
        setBoard(createChineseBoard());
        setTurn(0);
        setSelected(null);
        setActiveId(START_HOLE);
        setHistory([]);
        setLastMove(null);
        setMoves(0);
        setResult(null);
        setLog([]);
        setGameId((current) => current + 1);
        setPhase('playing');
        setMessage(
            `Turno de ${nameFor(0)}. Las canicas claras empiezan abajo; llevá las diez al triángulo de arriba.`,
        );
        pendingFocus.current = START_HOLE;
        playSound('select');
    }, [nameFor]);

    // Foco inicial del tablero al comenzar o reiniciar.
    useEffect(() => {
        if (phase !== 'playing' || pendingFocus.current === null) {
            return;
        }

        const id = pendingFocus.current;
        pendingFocus.current = null;
        const timer = window.setTimeout(() => {
            holeRefs.current.get(id)?.focus();
        }, 80);

        return () => window.clearTimeout(timer);
    }, [phase, gameId]);

    // Después de mover, el foco vuelve al hueco de destino.
    useEffect(() => {
        if (focusAfterMove.current === null) {
            return;
        }

        const id = focusAfterMove.current;
        focusAfterMove.current = null;
        const timer = window.setTimeout(() => {
            holeRefs.current.get(id)?.focus();
        }, 30);

        return () => window.clearTimeout(timer);
    }, [board, activeId]);

    // Al terminar, el foco pasa al informe del resultado.
    useEffect(() => {
        if (result === null) {
            return;
        }

        const timer = window.setTimeout(() => {
            resultRef.current?.focus();
        }, 140);

        return () => window.clearTimeout(timer);
    }, [result]);

    // Ranking global: se informa una sola vez por partida.
    useEffect(() => {
        if (
            result === null ||
            phase !== 'playing' ||
            reportedGame.current === gameId
        ) {
            return;
        }

        reportedGame.current = gameId;
        const winner =
            result === 'draw' ? null : result === 0 ? 'operador' : 'entidad';

        void reportLocalScore(
            names,
            fallbackName,
            winner,
            'chinese',
            null,
            'Damas chinas',
        );

        playSound(result === 'draw' ? 'move' : 'win');
    }, [result, phase, gameId, names, fallbackName]);

    const selectedMoves = useMemo(
        () => (selected === null ? [] : movesForHole(board, selected, turn)),
        [board, selected, turn],
    );
    const targetMoves = useMemo(
        () => new Map(selectedMoves.map((move) => [move.to, move])),
        [selectedMoves],
    );

    const progressClaro = targetProgress(board, 0);
    const progressOscuro = targetProgress(board, 1);

    const commitMove = (move: ChineseMove) => {
        const snapshot: Snapshot = { board, turn, moves, lastMove };
        const nextBoard = applyChineseMove(board, move);

        setHistory((current) => [...current.slice(-59), snapshot]);
        setBoard(nextBoard);
        setSelected(null);
        setActiveId(move.to);
        setLastMove(move);
        setMoves(moves + 1);
        setLog((current) => [
            ...current.slice(-19),
            { number: moves + 1, player: move.player, move },
        ]);
        focusAfterMove.current = move.to;
        playSound('move');

        if (hasWon(nextBoard, move.player)) {
            setResult(move.player);
            setMessage(
                `¡Ganó ${nameFor(move.player)}! Las diez canicas llegaron al triángulo opuesto.`,
            );
            return;
        }

        const next = otherPlayer(move.player);

        if (!hasAnyMove(nextBoard, next)) {
            if (!hasAnyMove(nextBoard, move.player)) {
                setResult('draw');
                setMessage(
                    'Tablas: ningún jugador tiene movimientos disponibles.',
                );
                return;
            }

            setTurn(move.player);
            setMessage(
                `${nameFor(move.player)} movió a ${holeName(move.to)}. ${nameFor(next)} no tiene movimientos y pasa el turno.`,
            );
            return;
        }

        setTurn(next);
        setMessage(
            `${nameFor(move.player)} movió de ${holeName(move.from)} a ${holeName(move.to)}${move.kind === 'jump' ? ' con salto' : ''}. Turno de ${nameFor(next)}.`,
        );
    };

    const handleHole = (holeId: number) => {
        if (result !== null) {
            return;
        }

        setActiveId(holeId);

        if (selected !== null) {
            const move = targetMoves.get(holeId);

            if (move !== undefined) {
                commitMove(move);
                return;
            }

            if (holeId === selected) {
                setSelected(null);
                setMessage('Selección cancelada.');
                return;
            }
        }

        const occupant = board[holeId];

        if (occupant === turn) {
            const available = movesForHole(board, holeId, turn);

            if (available.length === 0) {
                setSelected(null);
                playSound('invalid');
                setMessage(
                    `La canica en ${holeName(holeId)} no tiene movimientos. Elegí otra.`,
                );
                return;
            }

            setSelected(holeId);
            playSound('select');
            setMessage(
                `Canica en ${holeName(holeId)} seleccionada. ${available.length} ${available.length === 1 ? 'destino posible' : 'destinos posibles'}.`,
            );
            return;
        }

        setSelected(null);

        if (occupant === null) {
            setMessage(`Hueco ${holeName(holeId)} vacío.`);
        } else {
            setMessage(
                `La canica en ${holeName(holeId)} es de ${nameFor(occupant)}.`,
            );
        }
    };

    const handleKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        holeId: number,
    ) => {
        const hole = CHINESE_BOARD.holes[holeId];
        let nextId: number | null = null;

        if (event.key === 'ArrowLeft') {
            if (hole.index > 0) {
                nextId = holeId - 1;
            }
        } else if (event.key === 'ArrowRight') {
            if (hole.index < CHINESE_ROW_LENGTHS[hole.row] - 1) {
                nextId = holeId + 1;
            }
        } else if (event.key === 'Home') {
            nextId = holeId - hole.index;
        } else if (event.key === 'End') {
            nextId = holeId - hole.index + CHINESE_ROW_LENGTHS[hole.row] - 1;
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            const targetRow = hole.row + (event.key === 'ArrowUp' ? -1 : 1);

            if (targetRow >= 0 && targetRow < CHINESE_ROW_LENGTHS.length) {
                const candidates = CHINESE_BOARD.holes.filter(
                    (candidate) => candidate.row === targetRow,
                );
                nextId = candidates.reduce((best, candidate) =>
                    Math.abs(candidate.x2 - hole.x2) <
                    Math.abs(best.x2 - hole.x2)
                        ? candidate
                        : best,
                ).id;
            }
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleHole(holeId);
            return;
        } else if (event.key === 'Escape') {
            event.preventDefault();
            setSelected(null);
            setMessage('Selección cancelada.');
            return;
        }

        if (nextId !== null) {
            event.preventDefault();
            setActiveId(nextId);
            holeRefs.current.get(nextId)?.focus();
        }
    };

    const undo = () => {
        if (history.length === 0 || result !== null) {
            return;
        }

        const previous = history[history.length - 1];

        setHistory((current) => current.slice(0, -1));
        setBoard(previous.board);
        setTurn(previous.turn);
        setMoves(previous.moves);
        setLastMove(previous.lastMove);
        setLog((current) => current.slice(0, -1));
        setSelected(null);
        setActiveId(previous.lastMove?.from ?? START_HOLE);
        focusAfterMove.current = previous.lastMove?.from ?? null;
        setMessage(`Movimiento deshecho. Turno de ${nameFor(previous.turn)}.`);
        playSound('select');
    };

    if (phase === 'setup') {
        return (
            <div className="d-stack" style={{ gap: 14 }}>
                <Plate label="DAMAS CHINAS · REGLAS" accent>
                    <div className="d-stack" style={{ gap: 12 }}>
                        <div className="d-row" style={{ gap: 8 }}>
                            <Hexagon size={24} className="d-acc" />
                            <h2
                                className="d-display"
                                style={{ margin: 0, fontSize: 20 }}
                            >
                                UNA ESTRELLA, DOS EJÉRCITOS
                            </h2>
                        </div>
                        <p className="d-mute" style={{ margin: 0 }}>
                            Cada jugador tiene diez canicas en un triángulo.
                            Gana quien las lleva todas al triángulo opuesto. No
                            se captura ninguna pieza: los saltos son puentes, no
                            ataques.
                        </p>
                        <ul className="d-chinese__rules">
                            <li>
                                Mové una canica a un hueco vecino o saltá sobre
                                una canica a un hueco libre.
                            </li>
                            <li>
                                Podés encadenar varios saltos en el mismo turno,
                                pero no mezclar un paso con saltos.
                            </li>
                            <li>
                                El claro empieza abajo y viaja hacia arriba; el
                                oscuro, al revés.
                            </li>
                        </ul>
                        <div className="d-row">
                            <Button
                                icon={Swords}
                                variant="accent"
                                onClick={startGame}
                            >
                                Comenzar partida
                            </Button>
                            <Button icon={BookOpen} onClick={onOpenTutorial}>
                                Ver tutorial
                            </Button>
                        </div>
                    </div>
                </Plate>
                <LocalNamesFields
                    names={names}
                    onChange={onNamesChange}
                    title="IDENTIFICACIÓN · DAMAS CHINAS"
                    fallbackName={fallbackName}
                />
                <Plate label="CÓMO SE JUEGA">
                    <ol className="d-chinese__steps">
                        <li>
                            <b>Elegí una canica propia.</b> Se iluminan todos
                            los huecos a los que puede llegar.
                        </li>
                        <li>
                            <b>Saltá o avanzá.</b> Un salto puede encadenarse;
                            la canica saltada se queda donde está.
                        </li>
                        <li>
                            <b>Llená el triángulo opuesto.</b> Cuando las diez
                            canicas están dentro, la partida termina.
                        </li>
                    </ol>
                    <p
                        className="d-mute d-mono"
                        style={{ margin: '10px 0 0', fontSize: 12 }}
                    >
                        TECLADO · FLECHAS PARA RECORRER · ENTER PARA ELEGIR ·
                        ESC PARA CANCELAR
                    </p>
                </Plate>
            </div>
        );
    }

    return (
        <div className="d-stack" style={{ gap: 14 }}>
            <div className="d-row d-row--between">
                <StatusLine
                    text={message}
                    accent={result === null}
                    role="status"
                />
                <Chip accent={result === null}>
                    {result === null
                        ? `TURNO · ${nameFor(turn).toUpperCase()}`
                        : result === 'draw'
                          ? 'TABLAS'
                          : 'PARTIDA TERMINADA'}
                </Chip>
            </div>

            <div className="d-grid d-grid--split d-chinese__players">
                <Plate
                    label={`${resolved.operador.toUpperCase()} · CLARO`}
                    accent={result === null && turn === 0}
                >
                    <div className="d-stack" style={{ gap: 8 }}>
                        <div className="d-row d-row--between">
                            <Stat
                                label="EN DESTINO"
                                value={`${progressClaro} / 10`}
                            />
                            <Chip accent={result === 0}>
                                {result === 0
                                    ? 'GANADOR'
                                    : turn === 0 && result === null
                                      ? 'EN TURNO'
                                      : '—'}
                            </Chip>
                        </div>
                        <Bar value={progressClaro / 10} />
                        <p
                            className="d-mono d-mute"
                            style={{ margin: 0, fontSize: 12 }}
                        >
                            META · TRIÁNGULO SUPERIOR
                        </p>
                    </div>
                </Plate>
                <Plate
                    label={`${resolved.entidad.toUpperCase()} · OSCURO`}
                    accent={result === null && turn === 1}
                >
                    <div className="d-stack" style={{ gap: 8 }}>
                        <div className="d-row d-row--between">
                            <Stat
                                label="EN DESTINO"
                                value={`${progressOscuro} / 10`}
                            />
                            <Chip accent={result === 1}>
                                {result === 1
                                    ? 'GANADOR'
                                    : turn === 1 && result === null
                                      ? 'EN TURNO'
                                      : '—'}
                            </Chip>
                        </div>
                        <Bar value={progressOscuro / 10} />
                        <p
                            className="d-mono d-mute"
                            style={{ margin: 0, fontSize: 12 }}
                        >
                            META · TRIÁNGULO INFERIOR
                        </p>
                    </div>
                </Plate>
            </div>

            <Plate label="TABLERO · 121 HUECOS" accent={result === null}>
                <p id="chinese-board-help" className="sr-only">
                    Tablero de damas chinas de 121 huecos. Usá las flechas para
                    recorrer las filas y las diagonales; Inicio y Fin para los
                    extremos de la fila; Enter o Espacio para seleccionar una
                    canica o confirmar un destino; Escape para cancelar.
                </p>
                <div
                    className="d-chinese__stage"
                    role="group"
                    aria-label="Tablero de damas chinas"
                    aria-describedby="chinese-board-help"
                >
                    <svg
                        className="d-chinese__bg"
                        viewBox={`0 0 ${CHINESE_BOARD.view.width} ${CHINESE_BOARD.view.height}`}
                        aria-hidden="true"
                        focusable="false"
                    >
                        <polygon
                            points={CHINESE_STAR_POINTS}
                            className="d-chinese__star"
                        />
                        {CHINESE_BOARD.holes.map((hole) => {
                            const point = holePoint(hole.id);

                            return (
                                <circle
                                    key={hole.id}
                                    cx={point.x}
                                    cy={point.y}
                                    r={0.37}
                                    className="d-chinese__socket"
                                />
                            );
                        })}
                    </svg>
                    {CHINESE_BOARD.holes.map((hole) => {
                        const cell = board[hole.id];
                        const isSelected = selected === hole.id;
                        const isTarget = targetMoves.has(hole.id);
                        const isLast =
                            lastMove !== null &&
                            (lastMove.from === hole.id ||
                                lastMove.to === hole.id);
                        const isSelectable = result === null && cell === turn;
                        const percent = holePercent(hole.id);
                        const label =
                            cell === null
                                ? `Hueco vacío, ${holeSpokenName(hole.id)}${isTarget ? ', destino posible' : ''}`
                                : `Canica ${cell === 0 ? 'clara' : 'oscura'} en ${holeSpokenName(hole.id)}${isSelectable ? ', seleccionable' : ''}${isTarget ? ', destino posible' : ''}`;

                        return (
                            <button
                                key={hole.id}
                                ref={(element) => {
                                    if (element === null) {
                                        holeRefs.current.delete(hole.id);
                                    } else {
                                        holeRefs.current.set(hole.id, element);
                                    }
                                }}
                                type="button"
                                className={`d-chinese__hole ${
                                    cell === 0
                                        ? 'd-chinese__hole--claro'
                                        : cell === 1
                                          ? 'd-chinese__hole--oscuro'
                                          : 'd-chinese__hole--empty'
                                } ${isSelected ? 'd-chinese__hole--selected' : ''} ${
                                    isTarget ? 'd-chinese__hole--target' : ''
                                } ${isLast ? 'd-chinese__hole--last' : ''}`}
                                style={{
                                    left: `${percent.left}%`,
                                    top: `${percent.top}%`,
                                }}
                                aria-label={label}
                                aria-pressed={isSelected ? true : undefined}
                                aria-disabled={
                                    result !== null ||
                                    (!isSelectable && !isTarget)
                                        ? true
                                        : undefined
                                }
                                tabIndex={hole.id === activeId ? 0 : -1}
                                onFocus={() => setActiveId(hole.id)}
                                onClick={() => handleHole(hole.id)}
                                onKeyDown={(event) =>
                                    handleKeyDown(event, hole.id)
                                }
                            >
                                {cell === null ? null : (
                                    <span
                                        className={`d-chinese__marble d-chinese__marble--${
                                            cell === 0 ? 'claro' : 'oscuro'
                                        }`}
                                        aria-hidden="true"
                                    />
                                )}
                                {isTarget ? (
                                    <span
                                        className="d-chinese__target"
                                        aria-hidden="true"
                                    />
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            </Plate>

            {result === null ? (
                selected !== null ? (
                    <Plate
                        label={`MOVIMIENTOS POSIBLES · ${holeName(selected)}`}
                        accent
                    >
                        {selectedMoves.length === 0 ? (
                            <p className="d-mute" style={{ margin: 0 }}>
                                Esa canica no tiene movimientos. Elegí otra.
                            </p>
                        ) : (
                            <div className="d-chinese__destinations">
                                {selectedMoves.map((move) => (
                                    <Button
                                        key={move.to}
                                        icon={
                                            move.kind === 'jump'
                                                ? ArrowUpRight
                                                : ArrowRight
                                        }
                                        onClick={() => commitMove(move)}
                                        ariaLabel={`Mover canica de ${holeSpokenName(move.from)} a ${holeSpokenName(move.to)}, ${move.kind === 'jump' ? 'salto' : 'paso'}`}
                                    >
                                        {`MOVER A · ${holeName(move.to)} · ${
                                            move.kind === 'jump'
                                                ? 'SALTO'
                                                : 'PASO'
                                        }`}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </Plate>
                ) : (
                    <Plate label="MOVIMIENTOS">
                        <p className="d-mute" style={{ margin: 0 }}>
                            Elegí una canica de {nameFor(turn)} para ver sus
                            destinos. También podés tocar directamente un hueco
                            iluminado.
                        </p>
                    </Plate>
                )
            ) : null}

            {result !== null ? (
                <Plate label="RESULTADO" accent>
                    <div className="d-stack" style={{ gap: 10 }}>
                        <div className="d-row" style={{ gap: 8 }}>
                            <Crown size={24} className="d-acc" />
                            <h2
                                ref={resultRef}
                                tabIndex={-1}
                                className="d-display"
                                style={{ margin: 0, fontSize: 22 }}
                            >
                                {result === 'draw'
                                    ? 'TABLAS'
                                    : `GANÓ ${nameFor(result).toUpperCase()}`}
                            </h2>
                        </div>
                        <p className="d-mute" style={{ margin: 0 }}>
                            {result === 'draw'
                                ? 'Ningún jugador tiene movimientos disponibles. La partida termina en tablas.'
                                : 'Las diez canicas llegaron al triángulo opuesto. El ranking global suma 80 puntos al ganador y 15 al perdedor.'}
                        </p>
                        {result === 'draw' ? (
                            <p className="d-mono d-mute" style={{ margin: 0 }}>
                                RANKING · TABLAS · +30 PARA CADA JUGADOR
                            </p>
                        ) : null}
                        <div className="d-row">
                            <Button
                                icon={RotateCcw}
                                variant="accent"
                                onClick={startGame}
                            >
                                Revancha
                            </Button>
                            <Button icon={Trophy} onClick={onOpenRanking}>
                                Ver ranking global
                            </Button>
                            <Button icon={Flag} onClick={onExit}>
                                Volver al inicio
                            </Button>
                        </div>
                    </div>
                </Plate>
            ) : null}

            <Plate label="CONTROLES">
                <div className="d-row d-row--between">
                    <div className="d-row">
                        <Button
                            icon={Undo2}
                            onClick={undo}
                            disabled={history.length === 0 || result !== null}
                        >
                            Deshacer
                        </Button>
                        <Button icon={RotateCcw} onClick={startGame}>
                            Reiniciar
                        </Button>
                    </div>
                    <StatusLine
                        text={`${moves} MOVIMIENTOS · ${log.length} EN REGISTRO`}
                    />
                </div>
            </Plate>

            <Plate label="REGISTRO DE MOVIMIENTOS" sunken>
                {log.length === 0 ? (
                    <p className="d-mute" style={{ margin: 0 }}>
                        Todavía no hay movimientos.
                    </p>
                ) : (
                    <ol
                        className="d-chinese__log"
                        aria-label="Últimos movimientos"
                    >
                        {log.slice(-8).map((entry) => (
                            <li key={entry.number}>
                                <span className="d-mono d-mute">
                                    {String(entry.number).padStart(2, '0')}
                                </span>{' '}
                                <b>{nameFor(entry.player).toUpperCase()}</b> ·{' '}
                                {holeName(entry.move.from)} →{' '}
                                {holeName(entry.move.to)}
                                {entry.move.kind === 'jump' ? ' · SALTO' : ''}
                            </li>
                        ))}
                    </ol>
                )}
            </Plate>
        </div>
    );
};
