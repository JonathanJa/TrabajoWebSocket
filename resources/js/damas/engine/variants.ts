export type VariantId = 'spanish' | 'international' | 'turkish';

export type Direction = readonly [row: number, column: number];

export interface VariantRules {
    id: VariantId;
    name: string;
    description: string;
    boardSize: number;
    startingRows: number;
    playable: 'light' | 'dark' | 'all';
    manMovement: 'diagonal' | 'orthogonal';
    kingMovement: 'diagonal' | 'orthogonal';
    menCaptureBackward: boolean;
    flyingKings: boolean;
    capturedPiecesRemovedImmediately: boolean;
    promotionStopsCapture: boolean;
    kingCapturePriority: boolean;
    forbidKingReverseCapture: boolean;
}

export const VARIANTS: Record<VariantId, VariantRules> = {
    spanish: {
        id: 'spanish',
        name: 'Damas españolas',
        description: '8×8 · 12 fichas · damas voladoras · cantidad y calidad',
        boardSize: 8,
        startingRows: 3,
        playable: 'light',
        manMovement: 'diagonal',
        kingMovement: 'diagonal',
        menCaptureBackward: false,
        flyingKings: true,
        capturedPiecesRemovedImmediately: false,
        promotionStopsCapture: true,
        kingCapturePriority: true,
        forbidKingReverseCapture: true,
    },
    international: {
        id: 'international',
        name: 'Damas internacionales',
        description: '10×10 · 20 fichas · captura máxima · damas voladoras',
        boardSize: 10,
        startingRows: 4,
        playable: 'dark',
        manMovement: 'diagonal',
        kingMovement: 'diagonal',
        menCaptureBackward: true,
        flyingKings: true,
        capturedPiecesRemovedImmediately: false,
        promotionStopsCapture: true,
        kingCapturePriority: false,
        forbidKingReverseCapture: false,
    },
    turkish: {
        id: 'turkish',
        name: 'Damas turcas',
        description: '8×8 · 16 fichas · movimiento ortogonal · captura máxima',
        boardSize: 8,
        startingRows: 2,
        playable: 'all',
        manMovement: 'orthogonal',
        kingMovement: 'orthogonal',
        menCaptureBackward: false,
        flyingKings: true,
        capturedPiecesRemovedImmediately: true,
        promotionStopsCapture: true,
        kingCapturePriority: false,
        forbidKingReverseCapture: true,
    },
};

export const DEFAULT_VARIANT: VariantId = 'spanish';

export const rulesFor = (variant: VariantId): VariantRules => VARIANTS[variant];

export const isVariantId = (value: unknown): value is VariantId =>
    value === 'spanish' || value === 'international' || value === 'turkish';

export const allDirections = (
    movement: 'diagonal' | 'orthogonal',
): Direction[] =>
    movement === 'diagonal'
        ? [
              [-1, -1],
              [-1, 1],
              [1, -1],
              [1, 1],
          ]
        : [
              [-1, 0],
              [0, -1],
              [0, 1],
              [1, 0],
          ];

export const manCaptureDirections = (
    side: 'operador' | 'entidad',
    rules: VariantRules,
): Direction[] => {
    const forward = side === 'operador' ? -1 : 1;

    if (rules.manMovement === 'orthogonal') {
        return [
            [forward, 0],
            [0, -1],
            [0, 1],
        ];
    }

    return rules.menCaptureBackward
        ? allDirections('diagonal')
        : [
              [forward, -1],
              [forward, 1],
          ];
};
