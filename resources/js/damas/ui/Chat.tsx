import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import type { Side } from '../engine/types';
import { Button, Chip, Plate } from './primitives';

export type Role = Side | 'spectator';

export interface ChatLine {
    id: string;
    emisor: string;
    name: string;
    role: Role;
    text: string;
    at: number;
}

export interface PeerInfo {
    name: string;
    role: Role;
    at: number;
}

export const roleLabel = (role: Role): string =>
    role === 'spectator'
        ? 'ESPECTADOR'
        : role === 'operador'
          ? 'CLARO'
          : 'OSCURO';

const FRASES = [
    'Buena jugada',
    'Se me escapó',
    'Estoy pensando',
    'Gracias por la partida',
] as const;

const hora = (at: number): string =>
    new Date(at).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
    });

/** Mesa de la sala: participantes presentes y comentarios. */
export const MesaPlate = ({
    peers,
    selfName,
    selfRole,
    lines,
    onSend,
}: {
    peers: PeerInfo[];
    selfName: string;
    selfRole: Role;
    lines: ChatLine[];
    onSend: (text: string) => void;
}) => {
    const [draft, setDraft] = useState('');
    const endRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: 'nearest' });
    }, [lines.length]);

    const send = (text: string) => {
        const clean = text.trim().slice(0, 160);

        if (clean === '') {
            return;
        }

        onSend(clean);
        setDraft('');
    };

    return (
        <Plate label="MESA · PARTICIPANTES">
            <div className="d-stack" style={{ gap: 10 }}>
                <div className="d-row" style={{ gap: 8 }}>
                    <Chip accent>{selfName === '' ? 'TÚ' : selfName}</Chip>
                    <span className="d-mono d-mute">{roleLabel(selfRole)}</span>
                    {peers.length === 0 ? (
                        <span className="d-mono d-mute">· SOLO VOS</span>
                    ) : null}
                </div>
                {peers.length > 0 ? (
                    <div
                        className="d-peers"
                        role="list"
                        aria-label="Participantes de la mesa"
                    >
                        {peers.map((peer) => (
                            <span
                                key={peer.name}
                                className="d-peer"
                                role="listitem"
                            >
                                <span
                                    className={`d-peer__disc d-peer__disc--${peer.role}`}
                                    aria-hidden="true"
                                />
                                <span className="d-mono">{peer.name}</span>
                                <span className="d-mono d-mute">
                                    {roleLabel(peer.role)}
                                </span>
                            </span>
                        ))}
                    </div>
                ) : null}
                <div
                    className="d-chat-log d-mesa-log"
                    role="log"
                    tabIndex={0}
                    aria-live="polite"
                    aria-relevant="additions"
                    aria-label="Comentarios de la mesa"
                >
                    {lines.length === 0 ? (
                        <p className="d-mute d-mono" style={{ margin: 0 }}>
                            SIN COMENTARIOS TODAVÍA
                        </p>
                    ) : (
                        lines.map((line) => (
                            <article
                                key={line.id}
                                className={`d-mesa-line d-mesa-line--${line.role}${
                                    line.emisor === 'self'
                                        ? ' d-mesa-line--self'
                                        : ''
                                }`}
                            >
                                <div className="d-row d-row--between">
                                    <span className="d-mono d-acc">
                                        {line.name}
                                    </span>
                                    <span className="d-mono d-quiet">
                                        {roleLabel(line.role)} · {hora(line.at)}
                                    </span>
                                </div>
                                <p style={{ margin: '3px 0 0' }}>{line.text}</p>
                            </article>
                        ))
                    )}
                    <div ref={endRef} />
                </div>
                <div className="d-row" style={{ gap: 6 }}>
                    {FRASES.map((frase) => (
                        <button
                            key={frase}
                            type="button"
                            className="d-chat-prompt"
                            aria-label={`Enviar comentario: ${frase}`}
                            onClick={() => send(frase)}
                        >
                            {frase}
                        </button>
                    ))}
                </div>
                <form
                    className="d-row d-chat-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        send(draft);
                    }}
                >
                    <label className="sr-only" htmlFor="mesa-texto">
                        Comentario para la mesa
                    </label>
                    <input
                        id="mesa-texto"
                        className="d-input"
                        value={draft}
                        maxLength={160}
                        placeholder="Comentar..."
                        autoComplete="off"
                        enterKeyHint="send"
                        onChange={(event) => setDraft(event.target.value)}
                    />
                    <Button icon={Send} onClick={() => send(draft)}>
                        Enviar
                    </Button>
                </form>
            </div>
        </Plate>
    );
};

/** Versión corta para la pantalla de espera. */
export const MesaHint = ({ peers }: { peers: PeerInfo[] }) =>
    peers.length === 0 ? null : (
        <div className="d-row" style={{ gap: 8 }}>
            <MessageCircle size={15} className="d-acc" />
            <span className="d-mono d-mute">
                {peers.map((peer) => peer.name).join(' · ')}
            </span>
        </div>
    );
