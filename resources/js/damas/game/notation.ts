import { squareName } from '../engine/board';
import type { GameResult, Move, ResultReason, Side } from '../engine/types';
import { DEFAULT_VARIANT, type VariantId } from '../engine/variants';

const CHAIN = '\u00d7';

/** Notación de la jugada: C3→D4, C3×E5×G3, con =DAMA al coronar. */
export const moveLabel = (
    move: Move,
    variant: VariantId = DEFAULT_VARIANT,
): string => {
    const steps =
        move.steps.length > 0
            ? move.steps
            : [{ from: move.from, to: move.to, captured: null }];
    const head = squareName(move.from, variant);
    const body = steps
        .map((step, index) => {
            const joiner = step.captured === null ? '\u2192' : CHAIN;

            return `${index === 0 ? joiner : joiner}${squareName(step.to, variant)}`;
        })
        .join('');

    return `${head}${body}${move.promotion ? '=DAMA' : ''}`;
};

export const reasonLabel = (reason: ResultReason): string => {
    switch (reason) {
        case 'sin-piezas':
            return 'Sin piezas sobre el tablero';
        case 'bloqueado':
            return 'Móvil bloqueado: no hay jugadas legales';
        case 'tablas-repeticion':
            return 'Tablas por repetición de posición';
        case 'tablas-material':
            return 'Tablas: 50 jugadas sin capturas';
        case 'abandono':
            return 'Transmisión cortada: abandono';
        default:
            return 'Informe cerrado';
    }
};

export interface Verdict {
    title: string;
    detail: string;
    won: boolean | null;
}

/** Veredicto del informe desde el punto de vista del jugador. */
export const verdictOf = (result: GameResult, humanSide: Side): Verdict => {
    if (result.winner === null) {
        return {
            title: 'TABLAS',
            detail: reasonLabel(result.reason),
            won: null,
        };
    }

    const won = result.winner === humanSide;

    return {
        title: won ? 'CONTACTO CLASIFICADO' : 'SEÑAL PERDIDA',
        detail: reasonLabel(result.reason),
        won,
    };
};

export const tallyLabel = (side: Side): string =>
    side === 'operador' ? 'NOS' : 'ELLOS';
