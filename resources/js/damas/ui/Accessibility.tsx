import { Accessibility, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button, IconButton } from './primitives';

export interface A11yPrefs {
    contrast: boolean;
    reduceMotion: boolean;
}

const A11Y_KEY = 'senal.damas.a11y.v1';

const DEFAULT_PREFS: A11yPrefs = {
    contrast: false,
    reduceMotion: false,
};

const systemPref = (query: string): boolean =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(query).matches;

export const loadA11y = (): A11yPrefs => {
    if (typeof window === 'undefined') {
        return DEFAULT_PREFS;
    }

    try {
        const raw = window.localStorage.getItem(A11Y_KEY);

        if (raw !== null) {
            const parsed = JSON.parse(raw) as Partial<A11yPrefs>;

            return {
                contrast: parsed.contrast === true,
                reduceMotion: parsed.reduceMotion === true,
            };
        }
    } catch {
        // Sin almacenamiento local: se usan las preferencias del sistema.
    }

    return {
        contrast: systemPref('(prefers-contrast: more)'),
        reduceMotion: systemPref('(prefers-reduced-motion: reduce)'),
    };
};

export const saveA11y = (prefs: A11yPrefs): void => {
    try {
        window.localStorage.setItem(A11Y_KEY, JSON.stringify(prefs));
    } catch {
        // Sin almacenamiento local: el ajuste solo dura la sesión.
    }
};

export const AccessibilityDialog = ({
    open,
    prefs,
    onChange,
    onClose,
}: {
    open: boolean;
    prefs: A11yPrefs;
    onChange: (next: A11yPrefs) => void;
    onClose: () => void;
}) => {
    const dialogRef = useRef<HTMLDialogElement | null>(null);

    useEffect(() => {
        const dialog = dialogRef.current;

        if (dialog === null) {
            return;
        }

        if (open && !dialog.open && dialog.isConnected) {
            dialog.showModal();
        }

        if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    const handleClose = (): void => {
        // En algunos navegadores el botón que abrió el diálogo no recibe foco
        // (por ejemplo, al tocarlo en pantalla táctil). Se lo devolvemos.
        const active = document.activeElement;
        const dialog = dialogRef.current;

        if (
            active === null ||
            active === document.body ||
            active === document.documentElement ||
            dialog?.contains(active) === true
        ) {
            document.getElementById('a11y-trigger')?.focus();
        }

        onClose();
    };

    return (
        <dialog
            ref={dialogRef}
            className="d-dialog"
            aria-labelledby="damas-a11y-title"
            onClose={handleClose}
            onClick={(event) => {
                if (event.target === dialogRef.current) {
                    onClose();
                }
            }}
        >
            <div className="d-dialog__body">
                <div className="d-row d-row--between">
                    <div className="d-row" style={{ gap: 10 }}>
                        <Accessibility size={22} className="d-acc" />
                        <h2
                            id="damas-a11y-title"
                            className="d-display"
                            style={{ margin: 0, fontSize: 20 }}
                        >
                            ACCESIBILIDAD
                        </h2>
                    </div>
                    <IconButton
                        icon={X}
                        label="Cerrar opciones de accesibilidad"
                        onClick={onClose}
                    />
                </div>

                <p className="d-mute" style={{ margin: 0 }}>
                    Ajustá la interfaz a tu forma de jugar. Los cambios se
                    aplican al instante y se guardan en este dispositivo.
                </p>

                <label className="d-a11y__opt">
                    <input
                        type="checkbox"
                        checked={prefs.contrast}
                        onChange={(event) =>
                            onChange({
                                ...prefs,
                                contrast: event.target.checked,
                            })
                        }
                    />
                    <span>
                        <b>Alto contraste</b>
                        <span className="d-mute">
                            Refuerza textos, bordes, casillas y fichas para
                            quienes ven poco o tienen baja visión.
                        </span>
                    </span>
                </label>

                <label className="d-a11y__opt">
                    <input
                        type="checkbox"
                        checked={prefs.reduceMotion}
                        onChange={(event) =>
                            onChange({
                                ...prefs,
                                reduceMotion: event.target.checked,
                            })
                        }
                    />
                    <span>
                        <b>Reducir movimiento</b>
                        <span className="d-mute">
                            Detiene animaciones y hace que las jugadas se
                            apliquen sin recorridos. La preferencia de tu
                            sistema operativo también se respeta.
                        </span>
                    </span>
                </label>

                <div className="d-a11y__help">
                    <p className="d-mono d-acc" style={{ margin: 0 }}>
                        TABLERO POR TECLADO
                    </p>
                    <p className="d-mute" style={{ margin: 0 }}>
                        Las flechas recorren las diagonales del tablero (arriba
                        = arriba-izquierda, derecha = arriba-derecha, abajo =
                        abajo-derecha, izquierda = abajo-izquierda). Enter o
                        espacio para elegir · Escape para cancelar. El tablero
                        se lee con lector de pantalla, con coordenadas, bando y
                        jugadas disponibles.
                    </p>
                    <p className="d-mute" style={{ margin: 0 }}>
                        Si la perspectiva 3D te incomoda, usá el botón de vista
                        plana en los mandos de la partida. También podés ampliar
                        con el zoom del navegador.
                    </p>
                </div>

                <div className="d-row d-row--between">
                    <Button
                        icon={RotateCcw}
                        variant="ghost"
                        onClick={() => onChange(DEFAULT_PREFS)}
                    >
                        Restablecer
                    </Button>
                    <Button variant="accent" onClick={onClose}>
                        Listo
                    </Button>
                </div>
            </div>
        </dialog>
    );
};
