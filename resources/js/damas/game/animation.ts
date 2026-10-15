import type { Move } from '../engine/types';

/** Duración de cada salto de la animación (acompaña a --tp-dur-slow). */
export const STEP_MS = 320;

export interface AnimationFrame {
    /** Casilla donde está la pieza que se mueve en este instante. */
    mover: number;
    /** Casilla de origen de la jugada. */
    from: number;
    /** Recorrido completo hecho hasta ahora, para dibujar la estela. */
    trail: number[];
    /** Piezas ya abducidas en esta jugada. */
    captured: number[];
    /** Pieza que se abduce en este paso. */
    capturedNow: number | null;
    /** Índice del paso (0-based). */
    index: number;
    total: number;
    /** Último paso y la pieza corona. */
    crowned: boolean;
}

export const stepsOf = (
    move: Move,
): ReadonlyArray<{ from: number; to: number; captured: number | null }> =>
    move.steps.length > 0
        ? move.steps
        : [{ from: move.from, to: move.to, captured: null }];

export const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });

/** Espera a que el navegador pinte: necesaria para que la transición arranque. */
export const nextPaint = (): Promise<void> =>
    new Promise((resolve) => {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => resolve());
        });
    });
