import {
    Activity,
    Flag,
    Mic,
    MicOff,
    RotateCcw,
    Undo2,
    Volume2,
    VolumeX,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { countKings, countPieces } from '../engine/rules';
import { tallyLabel } from '../game/notation';
import type { MatchLogEntry, MatchSnapshot } from '../game/matchState';
import type { Side } from '../engine/types';
import { Button, IconButton, Plate } from './primitives';

interface SidePlateProps {
    side: Side;
    label: string;
    note: string;
    icon?: LucideIcon;
    active: boolean;
    snapshot: MatchSnapshot;
}

export const SidePlate = ({
    side,
    label,
    note,
    icon: Icon,
    active,
    snapshot,
}: SidePlateProps) => (
    <div className={`d-side d-side--${side} ${active ? 'd-side--turn' : ''}`}>
        <span
            className={`d-side__disc ${
                side === 'operador' ? 'd-side__disc--us' : 'd-side__disc--them'
            }`}
            aria-hidden="true"
        />
        <div className="d-col" style={{ flex: 1 }}>
            <p className="d-mono" style={{ margin: 0 }}>
                {label}
                {active ? <span className="d-acc"> · TURNO</span> : null}
            </p>
            <p
                className="d-mute d-side__note"
                style={{ margin: '2px 0 0', fontSize: 13 }}
            >
                {note}
            </p>
        </div>
        <div style={{ textAlign: 'right' }}>
            <p className="d-quiet" style={{ margin: 0 }}>
                {tallyLabel(side)}
            </p>
            <p className="d-mono d-acc" style={{ margin: 0, fontSize: 13 }}>
                {countPieces(snapshot.board, side)} en campo
                {countKings(snapshot.board, side) > 0
                    ? ` · ${countKings(snapshot.board, side)} dama`
                    : ''}
                {` · ${snapshot.tally[side]} bajas`}
            </p>
        </div>
        {Icon === undefined ? null : (
            <Icon size={18} strokeWidth={2.2} className="d-mute" />
        )}
    </div>
);

export const ThinkingRow = ({ label }: { label: string }) => (
    <div className="d-side">
        <Activity size={18} strokeWidth={2.2} className="d-acc d-pulse" />
        <p className="d-mono" style={{ margin: 0 }}>
            {label}
        </p>
    </div>
);

export const MoveLog = ({
    entries,
    viewer,
}: {
    entries: MatchLogEntry[];
    viewer: Side;
}) => (
    <Plate label="REGISTRO DE SEÑAL" className="d-arena__log">
        {entries.length === 0 ? (
            <p className="d-mute" style={{ margin: 0, fontSize: 14 }}>
                Sin jugadas registradas. El contacto todavía no se movió.
            </p>
        ) : (
            <ul className="d-log">
                {entries
                    .slice()
                    .reverse()
                    .map((entry) => (
                        <li key={entry.id}>
                            <b>{String(entry.ply).padStart(3, '0')}</b>{' '}
                            {tallyLabel(entry.side)} <b>{entry.label}</b>
                            {entry.captured > 0
                                ? ` · ${entry.captured} abducida(s)`
                                : ''}
                            {entry.crowned ? ' · DAMAS' : ''}
                            {entry.side === viewer && entry.captured > 0
                                ? ' ·'
                                : ''}
                        </li>
                    ))}
            </ul>
        )}
    </Plate>
);

interface ControlProps {
    canUndo: boolean;
    onUndo: () => void;
    onRestart: () => void;
    onSurrender: () => void;
    onExit: () => void;
    muted: boolean;
    onToggleMute: () => void;
    voiceEnabled?: boolean;
    onToggleVoice?: () => void;
    showVoice?: boolean;
    showUndo?: boolean;
    /** Modo espectador: solo se permite silenciar y salir. */
    spectator?: boolean;
}

export const MatchControls = ({
    canUndo,
    onUndo,
    onRestart,
    onSurrender,
    onExit,
    muted,
    onToggleMute,
    voiceEnabled = true,
    onToggleVoice,
    showVoice = false,
    showUndo = true,
    spectator = false,
}: ControlProps) => (
    <div className="d-row d-arena__controls">
        {showUndo && !spectator ? (
            <Button icon={Undo2} onClick={onUndo} disabled={!canUndo}>
                Deshacer
            </Button>
        ) : null}
        {spectator ? null : (
            <Button icon={RotateCcw} onClick={onRestart}>
                Reiniciar
            </Button>
        )}
        {spectator ? null : (
            <Button icon={Flag} onClick={onSurrender} variant="danger">
                Abandonar
            </Button>
        )}
        <IconButton
            icon={muted ? VolumeX : Volume2}
            label={muted ? 'Activar audio' : 'Silenciar'}
            onClick={onToggleMute}
        />
        {showVoice && onToggleVoice !== undefined ? (
            <IconButton
                icon={voiceEnabled ? Mic : MicOff}
                label={
                    voiceEnabled
                        ? 'Silenciar anuncios de voz'
                        : 'Activar anuncios de voz'
                }
                onClick={onToggleVoice}
            />
        ) : null}
        <IconButton icon={X} label="Salir al informe" onClick={onExit} />
    </div>
);

export const StatusLine = ({
    text,
    accent,
}: {
    text: string;
    accent?: boolean;
}) => (
    <p
        className={`d-mono ${accent === true ? 'd-acc' : 'd-mute'}`}
        style={{ margin: 0 }}
    >
        {text}
    </p>
);
