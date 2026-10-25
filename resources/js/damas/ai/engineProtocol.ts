import type { Advice } from './advisor';
import type { AiSearchConfig } from './profiles';
import type { Board, Side } from '../engine/types';
import type { VariantId } from '../engine/variants';

/** Mensajes entre la interfaz y el worker que ejecuta el motor. */
export interface EngineRequest {
    id: number;
    board: Board;
    side: Side;
    variant: VariantId;
    config: AiSearchConfig;
}

export type EngineResponse =
    | { id: number; advice: Advice }
    | { id: number; error: string };
