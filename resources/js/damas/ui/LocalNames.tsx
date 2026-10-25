import { PLAYER_NAME_MAX, cleanPlayerName } from '../game/identity';
import type { LocalNames } from '../game/localNames';
import { Plate } from './primitives';

/**
 * Identificación de los dos jugadores de un duelo local. Se usa para el
 * ranking global y se recuerda en el dispositivo.
 */
export const LocalNamesFields = ({
    names,
    onChange,
    title = 'IDENTIFICACIÓN LOCAL',
    fallbackName = '',
}: {
    names: LocalNames;
    onChange: (names: LocalNames) => void;
    title?: string;
    /** Nombre de la portada que se usa si el jugador 1 queda vacío. */
    fallbackName?: string;
}) => (
    <Plate label={title}>
        <div className="d-grid d-grid--split d-local-names">
            <div className="d-stack" style={{ gap: 8 }}>
                <label className="d-mono d-mute" htmlFor="local-name-operador">
                    JUGADOR 1 · CLARO
                </label>
                <input
                    id="local-name-operador"
                    className="d-input"
                    value={names.operador}
                    maxLength={PLAYER_NAME_MAX}
                    autoComplete="off"
                    placeholder={
                        fallbackName === '' ? 'JUGADOR 1' : fallbackName
                    }
                    onChange={(event) =>
                        onChange({
                            ...names,
                            operador: cleanPlayerName(event.target.value),
                        })
                    }
                />
            </div>
            <div className="d-stack" style={{ gap: 8 }}>
                <label className="d-mono d-mute" htmlFor="local-name-entidad">
                    JUGADOR 2 · OSCURO
                </label>
                <input
                    id="local-name-entidad"
                    className="d-input"
                    value={names.entidad}
                    maxLength={PLAYER_NAME_MAX}
                    autoComplete="off"
                    placeholder="JUGADOR 2"
                    onChange={(event) =>
                        onChange({
                            ...names,
                            entidad: cleanPlayerName(event.target.value),
                        })
                    }
                />
            </div>
        </div>
        <p
            className="d-mute d-mono"
            style={{ margin: '10px 0 0', fontSize: 12 }}
        >
            MÍNIMO 2 LETRAS · LOS DOS NOMBRES SE GUARDAN EN EL RANKING GLOBAL AL
            TERMINAR.
        </p>
    </Plate>
);
