import { cleanPlayerName } from './identity';

const STORAGE_KEY = 'senal.damas.locales.v1';

export interface LocalNames {
    operador: string;
    entidad: string;
}

export const emptyLocalNames = (): LocalNames => ({
    operador: '',
    entidad: '',
});

/** Nombres de los dos jugadores de un duelo local. */
export const loadLocalNames = (): LocalNames => {
    if (typeof window === 'undefined') {
        return emptyLocalNames();
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);

        if (raw === null) {
            return emptyLocalNames();
        }

        const parsed = JSON.parse(raw) as Partial<LocalNames>;

        return {
            operador:
                typeof parsed.operador === 'string'
                    ? cleanPlayerName(parsed.operador)
                    : '',
            entidad:
                typeof parsed.entidad === 'string'
                    ? cleanPlayerName(parsed.entidad)
                    : '',
        };
    } catch {
        return emptyLocalNames();
    }
};

export const saveLocalNames = (names: LocalNames): void => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
    } catch {
        // Sin almacenamiento local: los nombres solo duran la sesión.
    }
};

const usableName = (value: string): string => {
    const clean = cleanPlayerName(value).trim();

    return clean.length >= 2 ? clean : '';
};

/** Nombres efectivos, con valores por defecto y sin duplicados exactos. */
export const resolveLocalNames = (
    names: LocalNames,
    fallback = '',
): LocalNames => {
    const operador =
        usableName(names.operador) || usableName(fallback) || 'JUGADOR 1';
    let entidad = usableName(names.entidad) || 'JUGADOR 2';

    if (entidad.toLocaleUpperCase('es') === operador.toLocaleUpperCase('es')) {
        entidad = `${entidad} 2`.slice(0, 18);
    }

    return { operador, entidad };
};
