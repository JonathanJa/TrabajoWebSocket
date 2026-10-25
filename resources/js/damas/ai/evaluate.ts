import { KING_VALUE, MAN_VALUE } from '../engine/constants';
import { colOf, indexOf, isInside, opposite, rowOf } from '../engine/board';
import type { Board, Side } from '../engine/types';
import {
    DEFAULT_VARIANT,
    allDirections,
    manCaptureDirections,
    rulesFor,
    type Direction,
    type VariantId,
} from '../engine/variants';

/** Pesos posicionales (centipeones: un peón vale MAN_VALUE). */
const EDGE_BONUS = 4;
const BACK_ROW_BONUS = 10;
const ADVANCE_BONUS = 3;
const PROMOTION_READY = 22;
const TEMPO = 6;
const THREAT_MAN = 24;
const THREAT_KING = 12;
const KING_EDGE_PENALTY = 6;
const KING_CENTER_MULTIPLIER = 3;

interface ThreatScan {
    /** Direcciones por las que puede venir una captura (dama + peones). */
    dirs: readonly Direction[];
    /** Direcciones de captura válidas para los peones de cada bando. */
    men: Record<Side, ReadonlySet<number>>;
    flyingKings: boolean;
}

/** Empaqueta una dirección en un entero (rango -1..1 por eje). */
const packDirection = (dr: number, dc: number): number => (dr + 1) * 3 + dc + 1;

const scanCache = new Map<VariantId, ThreatScan>();

/** Precalcula (una vez por variante) las direcciones que hay que revisar. */
const scanFor = (variant: VariantId): ThreatScan => {
    const cached = scanCache.get(variant);

    if (cached !== undefined) {
        return cached;
    }

    const rules = rulesFor(variant);
    const men: Record<Side, ReadonlySet<number>> = {
        operador: new Set(
            manCaptureDirections('operador', rules).map(([dr, dc]) =>
                packDirection(dr, dc),
            ),
        ),
        entidad: new Set(
            manCaptureDirections('entidad', rules).map(([dr, dc]) =>
                packDirection(dr, dc),
            ),
        ),
    };
    const scan: ThreatScan = {
        dirs: allDirections(rules.kingMovement),
        men,
        flyingKings: rules.flyingKings,
    };

    scanCache.set(variant, scan);

    return scan;
};

/**
 * ¿La pieza de `side` en `index` está amenazada por una captura inmediata?
 *
 * Revisa las cuatro direcciones del tablero: un peón enemigo a un paso y la
 * primera pieza que aparece en la dirección contraria (dama enemiga), siempre
 * que exista una casilla libre donde caer.
 */
const isAttacked = (
    board: Board,
    index: number,
    side: Side,
    size: number,
    scan: ThreatScan,
): boolean => {
    const enemy = opposite(side);
    const row = rowOf(index, size);
    const col = colOf(index, size);

    for (const [dr, dc] of scan.dirs) {
        const landingRow = row + dr;
        const landingCol = col + dc;

        if (!isInside(landingRow, landingCol, size)) {
            continue;
        }

        if (board[indexOf(landingRow, landingCol, size)] !== null) {
            continue;
        }

        const manRow = row - dr;
        const manCol = col - dc;

        if (isInside(manRow, manCol, size)) {
            const hunter = board[indexOf(manRow, manCol, size)];

            if (
                hunter !== null &&
                hunter.side === enemy &&
                hunter.kind === 'man' &&
                scan.men[enemy].has(packDirection(dr, dc))
            ) {
                return true;
            }
        }

        // Dama enemiga: la primera pieza que se cruza en la dirección inversa.
        let hunterRow = row - dr;
        let hunterCol = col - dc;
        let distance = 1;

        while (isInside(hunterRow, hunterCol, size)) {
            const hunter = board[indexOf(hunterRow, hunterCol, size)];

            if (hunter !== null) {
                if (
                    hunter.side === enemy &&
                    hunter.kind === 'king' &&
                    (scan.flyingKings || distance === 1)
                ) {
                    return true;
                }

                break;
            }

            hunterRow -= dr;
            hunterCol -= dc;
            distance += 1;
        }
    }

    return false;
};

/**
 * Evaluación estática desde la perspectiva de `side` (centipeones).
 *
 * Material + avance + control del centro + defensa de la fila base +
 * proximidad a coronar, con penalización simétrica de piezas amenazadas.
 */
export const evaluate = (
    board: Board,
    side: Side,
    variant: VariantId = DEFAULT_VARIANT,
): number => {
    const rules = rulesFor(variant);
    const size = rules.boardSize;
    const center = (size - 1) / 2;
    const scan = scanFor(variant);
    let score = TEMPO;

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
        const threatened = isAttacked(board, index, cell.side, size, scan);
        let value: number;

        if (cell.kind === 'king') {
            value =
                KING_VALUE +
                centerValue * KING_CENTER_MULTIPLIER -
                (onEdge ? KING_EDGE_PENALTY : 0) -
                (threatened ? THREAT_KING : 0);
        } else {
            const advance = cell.side === 'operador' ? size - 1 - row : row;
            const homeRow = cell.side === 'operador' ? size - 1 : 0;

            value =
                MAN_VALUE +
                advance * ADVANCE_BONUS +
                centerValue +
                (onEdge ? EDGE_BONUS : 0) +
                (row === homeRow ? BACK_ROW_BONUS : 0) +
                (advance === size - 2 ? PROMOTION_READY : 0) -
                (threatened ? THREAT_MAN : 0);
        }

        score += mine ? value : -value;
    }

    return score;
};
