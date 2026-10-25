import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chooseMove, type Advice } from '../ai/advisor';
import { requestAdvice } from '../ai/engine';
import type { AiProfile } from '../ai/profiles';
import { generateMoves } from '../engine/movegen';
import type { Board, GameResult, Move, Side } from '../engine/types';
import {
    nextPaint,
    sleep,
    stepsOf,
    STEP_MS,
    type AnimationFrame,
} from './animation';
import {
    advance,
    initialSnapshot,
    isLegal,
    resign,
    type MatchSnapshot,
} from './matchState';
import { playSound } from './sound';
import { DEFAULT_VARIANT, type VariantId } from '../engine/variants';

export interface MatchOptions {
    /** Bando que controla la persona en este equipo. */
    humanSide: Side;
    /** IA local; null si no hay IA (duelo local o rival por red). */
    profile: AiProfile | null;
    /** Duelo local: las dos bandas se juegan en el mismo equipo. */
    local?: boolean;
    /** El rival juega por red: se desactivan atajos locales como deshacer. */
    remote?: boolean;
    variant?: VariantId;
    onPlay?: (move: Move, snapshot: MatchSnapshot) => void;
    onFinish?: (result: GameResult, plies: number) => void;
}

export interface MatchController {
    snapshot: MatchSnapshot;
    selection: number | null;
    animation: AnimationFrame | null;
    thinking: boolean;
    /** Destinos legales de la pieza seleccionada. */
    targets: Map<number, Move>;
    /** Casillas con piezas que pueden moverse ahora. */
    selectable: Set<number>;
    /** Corrección activa: fichas que sí pueden moverse tras un intento inválido. */
    mustMove: Set<number>;
    /** Ficha rechazada (temblor) con contador para reiniciar el aviso. */
    rejected: { index: number; pulse: number } | null;
    canInteract: boolean;
    canUndo: boolean;
    isHumanTurn: boolean;
    onSquare: (index: number) => void;
    /** Quita la selección actual sin mover (tecla Escape). */
    clearSelection: () => void;
    playRemote: (move: Move) => void;
    adoptState: (board: Board, sideToMove: Side) => void;
    adoptSnapshot: (snapshot: MatchSnapshot) => void;
    forfeit: (side: Side) => void;
    undo: () => void;
    surrender: () => void;
    restart: (variant?: VariantId) => void;
}

const HISTORY_LIMIT = 40;

/** Conjunto vacío estable: evita recrear el Set en cada render. */
const NO_MUST: Set<number> = new Set();

export const useMatch = (options: MatchOptions): MatchController => {
    const {
        humanSide,
        profile,
        local = false,
        remote = false,
        variant = DEFAULT_VARIANT,
    } = options;

    const [snapshot, setSnapshot] = useState<MatchSnapshot>(() =>
        initialSnapshot(variant),
    );
    const [selection, setSelection] = useState<number | null>(null);
    const [animation, setAnimation] = useState<AnimationFrame | null>(null);
    const [thinking, setThinking] = useState(false);
    const [running, setRunning] = useState(false);
    const [mustAlert, setMustAlert] = useState(false);
    const [rejected, setRejected] = useState<{
        index: number;
        pulse: number;
    } | null>(null);

    const pulsesRef = useRef(0);
    const historyRef = useRef<MatchSnapshot[]>([]);
    const runRef = useRef(0);
    const aiScheduledRef = useRef(false);
    const callbacksRef = useRef({
        onPlay: options.onPlay,
        onFinish: options.onFinish,
    });

    callbacksRef.current = {
        onPlay: options.onPlay,
        onFinish: options.onFinish,
    };

    const legalMoves = useMemo(
        () =>
            snapshot.result === null
                ? generateMoves(
                      snapshot.board,
                      snapshot.sideToMove,
                      {},
                      snapshot.variant,
                  )
                : [],
        [snapshot],
    );

    const targets = useMemo(() => {
        const map = new Map<number, Move>();

        if (selection === null) {
            return map;
        }

        for (const move of legalMoves) {
            if (move.from === selection) {
                map.set(move.to, move);
            }
        }

        return map;
    }, [legalMoves, selection]);

    const selectable = useMemo(
        () => new Set(legalMoves.map((move) => move.from)),
        [legalMoves],
    );

    const isHumanTurn = local ? true : snapshot.sideToMove === humanSide;
    const canInteract =
        snapshot.result === null &&
        !running &&
        animation === null &&
        isHumanTurn;

    // Tras un intento inválido se resaltan las fichas que sí pueden moverse.
    const mustMove = mustAlert && canInteract ? selectable : NO_MUST;

    const runMove = useCallback(
        async (base: MatchSnapshot, move: Move, notify = true) => {
            if (
                base.result !== null ||
                !isLegal(base.board, base.sideToMove, move, base.variant)
            ) {
                return;
            }

            // Con movimiento reducido no se reproduce el recorrido paso a paso:
            // la jugada se aplica de inmediato (el sonido y el estado sí cambian).
            const reduceMotion =
                typeof window !== 'undefined' &&
                (document.documentElement.dataset.motion === 'reduce' ||
                    (typeof window.matchMedia === 'function' &&
                        window.matchMedia('(prefers-reduced-motion: reduce)')
                            .matches));

            if (reduceMotion) {
                const next = advance(base, move);
                historyRef.current = [...historyRef.current, base].slice(
                    -HISTORY_LIMIT,
                );

                setSelection(null);
                setAnimation(null);
                setRunning(false);
                setSnapshot(next);
                playSound(
                    move.promotion
                        ? 'crown'
                        : move.captures.length > 0
                          ? 'capture'
                          : 'move',
                );

                if (notify) {
                    callbacksRef.current.onPlay?.(move, next);
                }

                if (next.result !== null) {
                    callbacksRef.current.onFinish?.(next.result, next.plies);
                }

                return;
            }

            const run = runRef.current;
            const steps = stepsOf(move);
            const captured: number[] = [];
            const trail: number[] = [move.from];

            setRunning(true);
            setSelection(null);
            setAnimation({
                mover: move.from,
                from: move.from,
                trail: [move.from],
                captured: [],
                capturedNow: null,
                index: 0,
                total: steps.length,
                crowned: false,
            });

            await nextPaint();

            if (run !== runRef.current) {
                setRunning(false);
                setAnimation(null);

                return;
            }

            for (let index = 0; index < steps.length; index += 1) {
                const step = steps[index];
                const crowned = index === steps.length - 1 && move.promotion;

                if (step.captured !== null) {
                    captured.push(step.captured);
                    playSound('capture');
                } else {
                    playSound(crowned ? 'crown' : 'move');
                }

                trail.push(step.to);
                setAnimation({
                    mover: step.to,
                    from: move.from,
                    trail: [...trail],
                    captured: [...captured],
                    capturedNow: step.captured,
                    index,
                    total: steps.length,
                    crowned,
                });

                await sleep(STEP_MS);

                if (run !== runRef.current) {
                    setRunning(false);
                    setAnimation(null);

                    return;
                }
            }

            const next = advance(base, move);
            historyRef.current = [...historyRef.current, base].slice(
                -HISTORY_LIMIT,
            );

            setSnapshot(next);
            setAnimation(null);
            setRunning(false);
            if (notify) {
                callbacksRef.current.onPlay?.(move, next);
            }

            if (next.result !== null) {
                callbacksRef.current.onFinish?.(next.result, next.plies);
            }
        },
        [],
    );

    const think = useCallback(
        async (base: MatchSnapshot, run: number) => {
            if (profile === null) {
                aiScheduledRef.current = false;

                return;
            }

            await nextPaint();

            const startedAt = performance.now();
            let advice: Advice;

            try {
                advice = await requestAdvice(
                    base.board,
                    base.sideToMove,
                    profile.config,
                    base.variant,
                );
            } catch {
                // Sin worker (o si falló): se resuelve en el hilo principal.
                advice = chooseMove(
                    base.board,
                    base.sideToMove,
                    profile.config,
                    base.variant,
                );
            }

            const elapsed = performance.now() - startedAt;
            const wait = Math.max(0, profile.config.minThinkMs - elapsed);

            if (wait > 0) {
                await sleep(wait);
            }

            setThinking(false);
            aiScheduledRef.current = false;

            if (run !== runRef.current || advice.move === null) {
                return;
            }

            await runMove(base, advice.move);
        },
        [profile, runMove],
    );

    useEffect(() => {
        if (profile === null || snapshot.result !== null) {
            return;
        }

        if (
            snapshot.sideToMove === humanSide ||
            running ||
            animation !== null
        ) {
            return;
        }

        if (aiScheduledRef.current) {
            return;
        }

        aiScheduledRef.current = true;
        setThinking(true);

        const run = runRef.current;

        window.setTimeout(() => {
            void think(snapshot, run);
        }, 60);
    }, [profile, snapshot, humanSide, running, animation, think]);

    // La corrección se apaga sola cuando cambia la posición (jugada, reinicio o sincronización).
    useEffect(() => {
        setMustAlert(false);
        setRejected(null);
    }, [snapshot]);

    const onSquare = useCallback(
        (index: number) => {
            if (!canInteract) {
                return;
            }

            const target = targets.get(index);

            if (target !== undefined) {
                setMustAlert(false);
                setRejected(null);
                void runMove(snapshot, target);

                return;
            }

            if (selectable.has(index)) {
                setMustAlert(false);
                setRejected(null);
                setSelection(index);
                playSound('select');

                return;
            }

            setSelection(null);

            // Tocó una ficha propia que no puede moverse: se marca cuál sí.
            const piece = snapshot.board[index];

            if (piece !== null && piece.side === snapshot.sideToMove) {
                pulsesRef.current += 1;
                setMustAlert(true);
                setRejected({ index, pulse: pulsesRef.current });
                playSound('invalid');
            }
        },
        [canInteract, targets, selectable, runMove, snapshot],
    );

    const clearSelection = useCallback(() => {
        setSelection(null);
        setMustAlert(false);
        setRejected(null);
    }, []);

    const playRemote = useCallback(
        (move: Move) => {
            if (running || animation !== null || snapshot.result !== null) {
                return;
            }

            const legalMove = generateMoves(
                snapshot.board,
                snapshot.sideToMove,
                {},
                snapshot.variant,
            ).find(
                (candidate) =>
                    candidate.from === move.from &&
                    candidate.to === move.to &&
                    candidate.promotion === move.promotion &&
                    candidate.captures.length === move.captures.length &&
                    candidate.captures.every(
                        (index, offset) => index === move.captures[offset],
                    ),
            );

            if (legalMove !== undefined) {
                void runMove(snapshot, legalMove, false);
            }
        },
        [running, animation, snapshot, runMove],
    );

    const adoptState = useCallback(
        (board: Board, sideToMove: Side) => {
            runRef.current += 1;
            historyRef.current = [];
            aiScheduledRef.current = false;

            setSnapshot({
                ...initialSnapshot(variant),
                board,
                sideToMove,
            });
            setSelection(null);
            setAnimation(null);
            setThinking(false);
            setRunning(false);
        },
        [variant],
    );

    const adoptSnapshot = useCallback((next: MatchSnapshot) => {
        runRef.current += 1;
        historyRef.current = [];
        aiScheduledRef.current = false;
        setSnapshot(next);
        setSelection(null);
        setAnimation(null);
        setThinking(false);
        setRunning(false);
    }, []);

    const forfeit = useCallback((side: Side) => {
        setSnapshot((current) => resign(current, side));
    }, []);

    const undo = useCallback(() => {
        if (remote || historyRef.current.length === 0 || running) {
            return;
        }

        const steps = profile === null ? 1 : 2;
        const history = historyRef.current;
        let target = history[history.length - 1];

        for (let index = 0; index < steps && history.length > 0; index += 1) {
            target = history.pop() ?? target;
        }

        historyRef.current = history;
        aiScheduledRef.current = false;
        setSnapshot(target);
        setSelection(null);
        setAnimation(null);
        setThinking(false);
    }, [profile, remote, running]);

    const surrender = useCallback(() => {
        const side = local ? snapshot.sideToMove : humanSide;
        setSnapshot((current) => resign(current, side));
    }, [local, humanSide, snapshot.sideToMove]);

    const restart = useCallback(
        (nextVariant = variant) => {
            runRef.current += 1;
            historyRef.current = [];
            aiScheduledRef.current = false;
            setSnapshot(initialSnapshot(nextVariant));
            setSelection(null);
            setAnimation(null);
            setThinking(false);
            setRunning(false);
        },
        [variant],
    );

    return {
        snapshot,
        selection,
        animation,
        thinking,
        targets,
        selectable,
        mustMove,
        rejected,
        canInteract,
        canUndo: !remote && historyRef.current.length > 0,
        isHumanTurn,
        onSquare,
        clearSelection,
        playRemote,
        adoptState,
        adoptSnapshot,
        forfeit,
        undo,
        surrender,
        restart,
    };
};
