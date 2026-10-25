import { chooseMove } from './advisor';
import type { EngineRequest, EngineResponse } from './engineProtocol';

const scope = self as unknown as {
    onmessage: ((event: MessageEvent<EngineRequest>) => void) | null;
    postMessage: (message: EngineResponse) => void;
};

/**
 * Worker del motor: la búsqueda deja de bloquear la interfaz, así los niveles
 * altos pueden pensar varios segundos sin congelar el tablero.
 */
scope.onmessage = (event) => {
    const { id, board, side, variant, config } = event.data;

    try {
        scope.postMessage({
            id,
            advice: chooseMove(board, side, config, variant),
        });
    } catch (error) {
        scope.postMessage({ id, error: String(error) });
    }
};
