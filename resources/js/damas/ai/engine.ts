import { chooseMove, type Advice } from './advisor';
import type { EngineRequest, EngineResponse } from './engineProtocol';
import type { AiSearchConfig } from './profiles';
import type { Board, Side } from '../engine/types';
import type { VariantId } from '../engine/variants';

interface Pending {
    resolve: (advice: Advice) => void;
    reject: (error: Error) => void;
}

let worker: Worker | null | undefined;
let sequence = 0;
const pending = new Map<number, Pending>();

const failAll = (message: string): void => {
    const slots = [...pending.values()];

    pending.clear();
    worker = null;

    for (const slot of slots) {
        slot.reject(new Error(message));
    }
};

/** Arranca el worker una sola vez; si el navegador no lo permite, null. */
const ensureWorker = (): Worker | null => {
    if (worker !== undefined) {
        return worker;
    }

    try {
        const instance = new Worker(
            new URL('./engineWorker.ts', import.meta.url),
            { type: 'module', name: 'damas-engine' },
        );

        instance.onmessage = (event: MessageEvent<EngineResponse>) => {
            const data = event.data;
            const slot = pending.get(data.id);

            if (slot === undefined) {
                return;
            }

            pending.delete(data.id);

            if ('error' in data) {
                slot.reject(new Error(data.error));
            } else {
                slot.resolve(data.advice);
            }
        };
        instance.onerror = () => failAll('El motor de análisis se detuvo.');
        worker = instance;
    } catch {
        worker = null;
    }

    return worker;
};

/**
 * Pide una jugada al motor. Si el worker no está disponible (o falla), se
 * calcula en el hilo principal para que la partida nunca se detenga.
 */
export const requestAdvice = (
    board: Board,
    side: Side,
    config: AiSearchConfig,
    variant: VariantId,
): Promise<Advice> => {
    const instance = ensureWorker();

    if (instance === null) {
        return Promise.resolve(chooseMove(board, side, config, variant));
    }

    sequence += 1;
    const id = sequence;

    return new Promise<Advice>((resolve, reject) => {
        const timer = window.setTimeout(() => {
            pending.delete(id);
            reject(new Error('El motor de análisis no respondió a tiempo.'));
        }, config.timeMs + 15_000);

        pending.set(id, {
            resolve: (advice) => {
                window.clearTimeout(timer);
                resolve(advice);
            },
            reject: (error) => {
                window.clearTimeout(timer);
                reject(error);
            },
        });

        try {
            const request: EngineRequest = { id, board, side, variant, config };
            instance.postMessage(request);
        } catch (error) {
            pending.delete(id);
            window.clearTimeout(timer);
            reject(error instanceof Error ? error : new Error(String(error)));
        }
    });
};
