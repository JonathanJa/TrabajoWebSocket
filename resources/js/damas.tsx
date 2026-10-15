import { useConnectionStatus, useEchoPublic } from '@laravel/echo-react';
import {
    ArrowLeft,
    BookOpen,
    Bot,
    Check,
    ChevronUp,
    Copy,
    Crown,
    Flag,
    Link2,
    MessageCircle,
    Radio,
    RotateCcw,
    Swords,
    Users,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { transmitir } from './actions/App/Http/Controllers/DamasController';
import { AI_PROFILES, profileById, type AiProfile } from './damas/ai/profiles';
import { CASES, caseIndex } from './damas/campaign/cases';
import {
    MAX_LEVEL,
    loadLadder,
    nextProfile,
    profileIndex,
    recordOf,
    registerLadderDuel,
    saveLadder,
    type LadderState,
} from './damas/campaign/ladder';
import {
    campaignStats,
    isUnlocked,
    loadProgress,
    registerAttempt,
    registerWin,
    type ProgressMap,
} from './damas/campaign/progress';
import type { Move, Side } from './damas/engine/types';
import {
    duelOf,
    loadDuels,
    registerRivalDuel,
    saveDuels,
    type DuelMap,
} from './damas/game/duels';
import {
    DEFAULT_VARIANT,
    isVariantId,
    rulesFor,
    type VariantId,
} from './damas/engine/variants';
import { isLegal, type MatchSnapshot } from './damas/game/matchState';
import type { AcademyId } from './damas/game/academy';
import { isMuted, playSound, setMuted } from './damas/game/sound';
import {
    announceHumanTurn,
    isVoiceEnabled,
    setVoiceEnabled,
    speakText,
} from './damas/game/voice';
import { useMatch, type MatchController } from './damas/game/useMatch';
import { verdictOf } from './damas/game/notation';
import { Board } from './damas/ui/Board';
import {
    MatchControls,
    MoveLog,
    SidePlate,
    StatusLine,
    ThinkingRow,
} from './damas/ui/Hud';
import { Academy } from './damas/ui/Academy';
import {
    MesaHint,
    MesaPlate,
    type ChatLine,
    type PeerInfo,
    type Role,
} from './damas/ui/Chat';
import {
    DuelRankPlate,
    LadderPlate,
    LadderRankPlate,
    RemoteScorePlate,
} from './damas/ui/Score';
import { Header, Screen } from './damas/ui/Screen';
import { Button, Chip, Plate, SegNav } from './damas/ui/primitives';
import './echo';
import '../css/damas-theme.css';

type Page =
    | 'home'
    | 'campaign'
    | 'setup'
    | 'multiplayer'
    | 'waiting'
    | 'match'
    | 'academy';
type MatchMode = 'ai' | 'local' | 'remote';
type FreeMode = 'ai' | 'local';
type RoomRole = 'host' | 'guest' | null;

interface Transmission {
    sala: string;
    tipo: string;
    emisor: string;
    payload: Record<string, unknown>;
}

const isSide = (value: unknown): value is Side =>
    value === 'operador' || value === 'entidad';

const isIndex = (value: unknown): value is number =>
    Number.isInteger(value) &&
    typeof value === 'number' &&
    value >= 0 &&
    value < 100;

const isMovePayload = (value: unknown): value is Move => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const move = value as Partial<Move>;

    return (
        isIndex(move.from) &&
        isIndex(move.to) &&
        Array.isArray(move.captures) &&
        move.captures.every(isIndex) &&
        typeof move.promotion === 'boolean'
    );
};

const decodeSnapshot = (value: unknown): MatchSnapshot | null => {
    if (typeof value !== 'object' || value === null) {
        return null;
    }

    const candidate = value as Partial<MatchSnapshot>;
    const variant = isVariantId(candidate.variant) ? candidate.variant : null;
    const expectedLength =
        variant !== null ? rulesFor(variant).boardSize ** 2 : 0;
    const validBoard =
        variant !== null &&
        Array.isArray(candidate.board) &&
        candidate.board.length === expectedLength &&
        candidate.board.every(
            (piece) =>
                piece === null ||
                (typeof piece === 'object' &&
                    isSide(piece.side) &&
                    (piece.kind === 'man' || piece.kind === 'king')),
        );
    const result = candidate.result;
    const validResult =
        result === null ||
        (typeof result === 'object' &&
            result !== undefined &&
            (result.winner === null || isSide(result.winner)) &&
            [
                'sin-piezas',
                'bloqueado',
                'tablas-repeticion',
                'tablas-material',
                'abandono',
            ].includes(result.reason));
    const validLog =
        Array.isArray(candidate.log) &&
        candidate.log.every(
            (entry) =>
                typeof entry === 'object' &&
                entry !== null &&
                Number.isInteger(entry.id) &&
                isSide(entry.side) &&
                typeof entry.label === 'string' &&
                Number.isInteger(entry.captured) &&
                typeof entry.crowned === 'boolean' &&
                Number.isInteger(entry.ply),
        );
    const validRepetitions =
        typeof candidate.repetitions === 'object' &&
        candidate.repetitions !== null &&
        Object.entries(candidate.repetitions).every(
            ([key, count]) =>
                variant !== null &&
                key.startsWith(`${variant}:`) &&
                key.length === variant.length + expectedLength + 2 &&
                Number.isInteger(count) &&
                count > 0,
        );

    if (
        !validBoard ||
        !isSide(candidate.sideToMove) ||
        !validResult ||
        !Number.isInteger(candidate.plies) ||
        candidate.plies === undefined ||
        candidate.plies < 0 ||
        !validLog ||
        typeof candidate.tally !== 'object' ||
        candidate.tally === null ||
        !Number.isInteger(candidate.quietPlies) ||
        candidate.quietPlies === undefined ||
        candidate.quietPlies < 0 ||
        !validRepetitions ||
        !(candidate.lastMove === null || isMovePayload(candidate.lastMove))
    ) {
        return null;
    }

    const tally = candidate.tally as Record<Side, unknown>;

    if (!Number.isInteger(tally.operador) || !Number.isInteger(tally.entidad)) {
        return null;
    }

    return candidate as MatchSnapshot;
};

const makeRoomCode = (): string => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);

    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join(
        '',
    );
};

const newPlayerId = (): string =>
    typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const PLAYER_NAME_KEY = 'senal.damas.nombre.v1';
const PLAYER_NAME_MAX = 18;

const cleanPlayerName = (value: string): string =>
    value
        .replace(/[^\p{L}\p{N} ._-]/gu, '')
        .replace(/\s+/g, ' ')
        .trimStart()
        .slice(0, PLAYER_NAME_MAX);

const loadPlayerName = (): string => {
    try {
        return cleanPlayerName(
            window.localStorage.getItem(PLAYER_NAME_KEY) ?? '',
        );
    } catch {
        return '';
    }
};

const savePlayerName = (value: string): void => {
    try {
        window.localStorage.setItem(PLAYER_NAME_KEY, value);
    } catch {
        // Sin almacenamiento local: el nombre solo dura la sesión.
    }
};

const readName = (value: unknown): string =>
    typeof value === 'string' ? cleanPlayerName(value) : '';

const RemoteChannel = ({
    room,
    onMessage,
}: {
    room: string;
    onMessage: (message: Transmission) => void;
}) => {
    useEchoPublic<Transmission>(
        `damas.${room}`,
        '.DamasTransmission',
        onMessage,
        [room, onMessage],
    );

    return null;
};

const VariantSelector = ({
    value,
    onChange,
}: {
    value: VariantId;
    onChange: (variant: VariantId) => void;
}) => (
    <Plate label="REGLAMENTO">
        <div className="d-stack" style={{ gap: 10 }}>
            <SegNav<VariantId>
                value={value}
                options={[
                    { value: 'spanish', label: 'ESPAÑOL' },
                    { value: 'international', label: 'INTERNACIONAL' },
                    { value: 'turkish', label: 'TURCAS' },
                ]}
                onChange={onChange}
                label="Variante de damas"
            />
            <p className="d-mute" style={{ margin: 0 }}>
                {rulesFor(value).description}
            </p>
        </div>
    </Plate>
);

const ordinal = (index: number): string => String(index + 1).padStart(2, '0');

const DamasApp = () => {
    const [page, setPage] = useState<Page>('home');
    const [pageBeforeAcademy, setPageBeforeAcademy] = useState<Page>('home');
    const [academyId, setAcademyId] = useState<AcademyId>(DEFAULT_VARIANT);
    const [matchMode, setMatchMode] = useState<MatchMode>('ai');
    const [freeMode, setFreeMode] = useState<FreeMode>('ai');
    const [variantId, setVariantId] = useState<VariantId>(DEFAULT_VARIANT);
    const [profileId, setProfileId] = useState(AI_PROFILES[1].id);
    const [humanSide, setHumanSide] = useState<Side>('operador');
    const [campaignCase, setCampaignCase] = useState<string | null>(null);
    const [progress, setProgress] = useState<ProgressMap>(() => loadProgress());
    const [ladder, setLadder] = useState<LadderState>(() => loadLadder());
    const [duels, setDuels] = useState<DuelMap>(() => loadDuels());
    const [remoteScore, setRemoteScore] = useState<Record<Side, number>>({
        operador: 0,
        entidad: 0,
    });
    const [chatLines, setChatLines] = useState<ChatLine[]>([]);
    const [peers, setPeers] = useState<Record<string, PeerInfo>>({});
    const [nextLevel, setNextLevel] = useState<AiProfile | null>(null);
    const [advanceIn, setAdvanceIn] = useState<number | null>(null);
    const [room, setRoom] = useState('');
    const [roomInput, setRoomInput] = useState('');
    const [roomRole, setRoomRole] = useState<RoomRole>(null);
    const [peerOnline, setPeerOnline] = useState(false);
    const [remoteSynced, setRemoteSynced] = useState(false);
    const [copyDone, setCopyDone] = useState(false);
    const [isSpectator, setIsSpectator] = useState(false);
    const [roomFull, setRoomFull] = useState(false);
    const [playerName, setPlayerName] = useState(() => loadPlayerName());
    const [rivalNames, setRivalNames] = useState<Partial<Record<Side, string>>>(
        {},
    );
    const rivalNamesRef = useRef<Partial<Record<Side, string>>>({});
    const [muted, setMutedState] = useState(isMuted());
    const [voiceEnabled, setVoiceEnabledState] = useState(isVoiceEnabled());
    const [transportError, setTransportError] = useState('');
    const playerId = useRef(newPlayerId());
    const matchRef = useRef<MatchController | null>(null);
    const greetedPeers = useRef<Set<string>>(new Set());
    const startMatchRef = useRef<
        | ((mode: MatchMode, selectedProfile: AiProfile, side: Side) => void)
        | null
    >(null);
    const recordedResult = useRef<string | null>(null);
    const hostHasPlayerRef = useRef(false);
    const connectionStatus = useConnectionStatus();
    const profile = profileById(profileId);
    const cleanName = cleanPlayerName(playerName);
    const nameOf = (side: Side): string => {
        if (!isSpectator && side === humanSide) {
            return cleanName === '' ? 'TÚ' : cleanName.toUpperCase();
        }

        const stored = rivalNames[side];

        if (stored !== undefined && stored !== '') {
            return stored.toUpperCase();
        }

        return side === 'operador' ? 'JUGADOR CLARO' : 'JUGADOR OSCURO';
    };
    const rivalName = (): string => {
        if (isSpectator) {
            return 'MESA COMPLETA';
        }

        const stored =
            humanSide === 'operador' ? rivalNames.entidad : rivalNames.operador;

        return stored === undefined || stored === ''
            ? 'SIN IDENTIFICAR'
            : stored.toUpperCase();
    };
    const rememberRivalName = useCallback((side: Side, value: string) => {
        if (value === '' || rivalNamesRef.current[side] === value) {
            return;
        }

        rivalNamesRef.current = { ...rivalNamesRef.current, [side]: value };
        setRivalNames(rivalNamesRef.current);
    }, []);
    const clearRivalNames = useCallback(() => {
        rivalNamesRef.current = {};
        setRivalNames({});
    }, []);
    /** Anota quién está en la sala (jugadores y espectadores). */
    const notePeer = useCallback((emisor: string, name: string, role: Role) => {
        if (emisor === '') {
            return;
        }

        const clean = name.trim().toUpperCase();

        setPeers((current) => {
            const previous = current[emisor];

            return {
                ...current,
                [emisor]: {
                    name: clean === '' ? (previous?.name ?? 'CONTACTO') : clean,
                    role,
                    at: Date.now(),
                },
            };
        });
    }, []);
    const dropPeer = useCallback((emisor: string) => {
        setPeers((current) => {
            if (!(emisor in current)) {
                return current;
            }

            const next = { ...current };
            delete next[emisor];

            return next;
        });
    }, []);
    const addChatLine = useCallback((line: ChatLine) => {
        setChatLines((current) => [...current, line].slice(-80));
    }, []);
    const remoteActive =
        (page === 'waiting' || page === 'match') &&
        matchMode === 'remote' &&
        room !== '';
    const peerList = Object.values(peers);
    const rivalLabel = isSpectator
        ? ''
        : ((humanSide === 'operador'
              ? rivalNames.entidad
              : rivalNames.operador) ?? '');
    const duelHistory = duelOf(duels, rivalLabel);

    const transmit = useCallback(
        async (tipo: string, payload: Record<string, unknown> = {}) => {
            if (room === '') {
                return false;
            }

            const token = document.querySelector<HTMLMetaElement>(
                'meta[name="csrf-token"]',
            )?.content;

            try {
                const endpoint = transmitir.post();
                const response = await fetch(endpoint.url, {
                    method: endpoint.method.toUpperCase(),
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        ...(token === undefined
                            ? {}
                            : { 'X-CSRF-TOKEN': token }),
                    },
                    body: JSON.stringify({
                        sala: room,
                        tipo,
                        emisor: playerId.current,
                        payload,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                setTransportError('');
                return true;
            } catch {
                setTransportError(
                    'No se pudo transmitir. Comprueba la conexión del servidor.',
                );
                return false;
            }
        },
        [room],
    );

    const sendChat = useCallback(
        (text: string) => {
            const clean = text.trim().slice(0, 160);

            if (clean === '' || room === '') {
                return;
            }

            const role: Role = isSpectator ? 'spectator' : humanSide;
            const name = cleanName === '' ? 'ANÓNIMO' : cleanName.toUpperCase();

            addChatLine({
                id: `${playerId.current}-${Date.now()}`,
                emisor: 'self',
                name,
                role,
                text: clean,
                at: Date.now(),
            });
            void transmit('chat', {
                name: cleanName,
                side: role,
                text: clean,
            });
        },
        [addChatLine, cleanName, humanSide, isSpectator, room, transmit],
    );

    const onPlay = useCallback(
        (move: Move, snapshot: MatchSnapshot) => {
            if (matchMode === 'remote') {
                void transmit('move', { move, ply: snapshot.plies });
            }
        },
        [matchMode, transmit],
    );

    const match = useMatch({
        humanSide,
        profile: matchMode === 'ai' ? profile : null,
        local: matchMode === 'local',
        remote: matchMode === 'remote',
        variant: variantId,
        onPlay,
    });
    matchRef.current = match;

    // El progreso de la escalera y el historial de rivales viven en el
    // dispositivo: el servidor no guarda estado.
    useEffect(() => {
        saveLadder(ladder);
    }, [ladder]);

    useEffect(() => {
        saveDuels(duels);
    }, [duels]);

    useEffect(() => {
        if (
            page !== 'match' ||
            matchMode !== 'ai' ||
            !voiceEnabled ||
            match.snapshot.result !== null ||
            match.snapshot.sideToMove !== humanSide
        ) {
            return;
        }

        announceHumanTurn(profile.callsign);
    }, [
        page,
        matchMode,
        voiceEnabled,
        humanSide,
        profile.callsign,
        match.snapshot.result,
        match.snapshot.sideToMove,
    ]);

    const onRemoteMessage = useCallback(
        (message: Transmission) => {
            if (message.emisor === playerId.current) {
                return;
            }

            const game = matchRef.current;

            if (game === null) {
                return;
            }

            const payload = message.payload ?? {};

            switch (message.tipo) {
                case 'join': {
                    if (roomRole !== 'host') {
                        break;
                    }
                    const joinName = readName(payload.name);
                    if (hostHasPlayerRef.current) {
                        // La sala ya tiene dos jugadores: ofrecer espectador.
                        // No se sobrescribe la identidad del invitado en juego.
                        void transmit('welcome', {
                            target: message.emisor,
                            role: 'spectator',
                            name: cleanName,
                            rival: rivalNamesRef.current.entidad ?? '',
                        });
                        break;
                    }
                    rememberRivalName('entidad', joinName);
                    notePeer(message.emisor, joinName, 'entidad');
                    hostHasPlayerRef.current = true;
                    setPeerOnline(true);
                    setRemoteSynced(false);
                    setPage('match');
                    void transmit('welcome', {
                        target: message.emisor,
                        role: 'player',
                        name: cleanName,
                        rival: joinName,
                    });
                    void transmit('sync', { snapshot: game.snapshot });
                    break;
                }
                case 'welcome': {
                    if (payload.target !== playerId.current) {
                        break;
                    }
                    const hostName = readName(payload.name);
                    const guestName = readName(payload.rival);
                    if (hostName !== '' || guestName !== '') {
                        rivalNamesRef.current = {
                            ...rivalNamesRef.current,
                            ...(hostName === '' ? {} : { operador: hostName }),
                            ...(guestName === '' ? {} : { entidad: guestName }),
                        };
                        setRivalNames(rivalNamesRef.current);
                    }
                    if (payload.role === 'spectator') {
                        setRoomFull(true);
                        setPage('waiting');
                        break;
                    }
                    notePeer(message.emisor, hostName, 'operador');
                    setRoomFull(false);
                    setIsSpectator(false);
                    setPeerOnline(true);
                    setPage('match');
                    break;
                }
                case 'hello': {
                    const who = payload.side;
                    const helloName = readName(payload.name);
                    if (isSide(who)) {
                        rememberRivalName(who, helloName);
                    }
                    notePeer(
                        message.emisor,
                        helloName,
                        isSide(who) ? who : 'spectator',
                    );
                    setPeerOnline(true);
                    // Un solo saludo de vuelta por contacto: así la mesa se
                    // llena de nombres (también con espectadores) sin bucles.
                    if (
                        room !== '' &&
                        !greetedPeers.current.has(message.emisor)
                    ) {
                        greetedPeers.current.add(message.emisor);
                        void transmit('hello', {
                            side: isSpectator ? 'spectator' : humanSide,
                            name: cleanName,
                        });
                    }
                    if (humanSide === 'operador') {
                        void transmit('sync', { snapshot: game.snapshot });
                    }
                    break;
                }
                case 'chat': {
                    setPeerOnline(true);
                    const text =
                        typeof payload.text === 'string'
                            ? payload.text.trim().slice(0, 160)
                            : '';
                    const who =
                        payload.side === 'spectator'
                            ? 'spectator'
                            : isSide(payload.side)
                              ? payload.side
                              : 'spectator';
                    const chatName = readName(payload.name);

                    if (text === '') {
                        break;
                    }

                    notePeer(message.emisor, chatName, who);
                    addChatLine({
                        id: `${message.emisor}-${Date.now()}`,
                        emisor: message.emisor,
                        name:
                            chatName === ''
                                ? 'CONTACTO'
                                : chatName.toUpperCase(),
                        role: who,
                        text,
                        at: Date.now(),
                    });
                    break;
                }
                case 'leave':
                    dropPeer(message.emisor);
                    if (roomRole === 'host' && payload.role !== 'spectator') {
                        hostHasPlayerRef.current = false;
                        setPeerOnline(false);
                    }
                    break;
                case 'sync-request':
                    setPeerOnline(true);
                    // Solo el anfitrión es autoridad del tablero; si responden
                    // los demás (p. ej. un espectador) llegarían instantáneas
                    // atrasadas y pisarían la partida en curso.
                    if (roomRole === 'host') {
                        void transmit('sync', { snapshot: game.snapshot }).then(
                            (sent) => setRemoteSynced(sent),
                        );
                    }
                    break;
                case 'sync': {
                    setPeerOnline(true);
                    const snapshot = decodeSnapshot(payload.snapshot);
                    if (snapshot !== null) {
                        // Nunca retroceder: una instantánea más vieja que la
                        // partida local se descarta.
                        if (snapshot.plies >= game.snapshot.plies) {
                            setVariantId(snapshot.variant);
                            game.adoptSnapshot(snapshot);
                            setRemoteSynced(true);
                        } else {
                            void transmit('sync-request');
                        }
                    }
                    break;
                }
                case 'move': {
                    setPeerOnline(true);
                    const move = payload.move;
                    const ply = payload.ply;
                    if (
                        isMovePayload(move) &&
                        ply === game.snapshot.plies + 1 &&
                        isLegal(
                            game.snapshot.board,
                            game.snapshot.sideToMove,
                            move,
                            game.snapshot.variant,
                        )
                    ) {
                        game.playRemote(move);
                    } else if (
                        typeof ply === 'number' &&
                        ply > game.snapshot.plies
                    ) {
                        void transmit('sync-request');
                    }
                    break;
                }
                case 'resign':
                    if (isSide(payload.side)) {
                        game.forfeit(payload.side);
                    }
                    break;
                case 'rematch':
                    game.restart(game.snapshot.variant);
                    setRemoteSynced(true);
                    break;
            }
        },
        [
            addChatLine,
            cleanName,
            dropPeer,
            humanSide,
            isSpectator,
            notePeer,
            rememberRivalName,
            room,
            roomRole,
            transmit,
        ],
    );

    useEffect(() => {
        if (!remoteActive) {
            return;
        }

        if (connectionStatus !== 'connected') {
            setPeerOnline(false);
            setRemoteSynced(false);

            return;
        }

        if (page === 'waiting') {
            if (roomRole === 'host' || isSpectator || roomFull) {
                return;
            }

            // El invitado pide entrar; el anfitrión responde con 'welcome'
            // (jugador o espectador) o no hay respuesta (sala inexistente).
            const timeout = window.setTimeout(() => {
                void transmit('join', { variant: variantId, name: cleanName });
            }, 200);

            return () => window.clearTimeout(timeout);
        }

        const timeout = window.setTimeout(() => {
            void transmit('hello', {
                side: isSpectator ? 'spectator' : humanSide,
                name: cleanName,
            });
            if (humanSide === 'entidad' || isSpectator) {
                void transmit('sync-request');
            }
        }, 200);

        return () => window.clearTimeout(timeout);
    }, [
        remoteActive,
        connectionStatus,
        page,
        roomRole,
        variantId,
        humanSide,
        transmit,
        isSpectator,
        roomFull,
        cleanName,
    ]);

    // Red de seguridad: si el anfitrión nunca responde (sala inexistente o
    // cerrada), no dejamos al invitado colgado en la pantalla de espera.
    useEffect(() => {
        if (
            !remoteActive ||
            page !== 'waiting' ||
            roomRole !== 'guest' ||
            isSpectator ||
            roomFull ||
            connectionStatus !== 'connected'
        ) {
            return;
        }

        const timer = window.setTimeout(() => {
            setPeerOnline(true);
            setPage('match');
        }, 6000);

        return () => window.clearTimeout(timer);
    }, [remoteActive, page, roomRole, isSpectator, roomFull, connectionStatus]);

    useEffect(() => {
        const result = match.snapshot.result;

        if (result === null) {
            recordedResult.current = null;
            return;
        }

        // La clave no incluye el motivo: un abandono posterior al final de la
        // partida no debe volver a contar el resultado.
        const resultKey = `${matchMode}:${campaignCase ?? 'free'}:${match.snapshot.plies}`;
        if (recordedResult.current === resultKey) {
            return;
        }

        recordedResult.current = resultKey;

        const winner = result.winner;
        const humanWon = winner !== null && winner === humanSide;

        // Aplauso: cierre entre personas o victoria propia contra la IA.
        if (matchMode !== 'ai' || humanWon) {
            playSound('applause');
        }

        if (matchMode === 'remote' && winner !== null) {
            setRemoteScore((current) => ({
                ...current,
                [winner]: current[winner] + 1,
            }));

            if (!isSpectator) {
                const rival =
                    (humanSide === 'operador'
                        ? rivalNamesRef.current.entidad
                        : rivalNamesRef.current.operador) ?? '';

                setDuels((current) =>
                    registerRivalDuel(current, rival, humanWon),
                );
            }
        }

        if (matchMode === 'ai' && campaignCase === null) {
            // Partida libre contra la IA: la escalera anota el duelo y, al
            // ganar, ofrece subir al contacto siguiente.
            if (winner !== null) {
                setLadder((current) =>
                    registerLadderDuel(current, profileId, humanWon),
                );
            }

            if (humanWon) {
                const following = nextProfile(profileId);

                setNextLevel(following);
                setAdvanceIn(following === null ? null : 10);
            } else {
                setNextLevel(null);
                setAdvanceIn(null);
            }
        }

        if (page === 'match' && matchMode === 'ai' && campaignCase !== null) {
            setProgress((current) => {
                let next = current;
                if (
                    result.winner === 'operador' &&
                    caseIndex(campaignCase) >= 0
                ) {
                    next = registerWin(
                        current,
                        campaignCase,
                        match.snapshot.plies,
                    );
                }
                return next;
            });
        }
    }, [
        campaignCase,
        humanSide,
        isSpectator,
        match.snapshot.plies,
        match.snapshot.result,
        matchMode,
        page,
        profileId,
    ]);

    // Cuenta atrás del ascenso: sube sola al contacto siguiente si el
    // jugador no se queda revisando el informe.
    useEffect(() => {
        if (advanceIn === null) {
            return;
        }

        if (nextLevel === null) {
            setAdvanceIn(null);

            return;
        }

        if (advanceIn <= 0) {
            setAdvanceIn(null);
            startMatchRef.current?.('ai', nextLevel, humanSide);

            return;
        }

        const timer = window.setTimeout(() => {
            setAdvanceIn((current) => (current === null ? null : current - 1));
        }, 1000);

        return () => window.clearTimeout(timer);
    }, [advanceIn, humanSide, nextLevel]);

    const startMatch = (
        mode: MatchMode,
        selectedProfile: AiProfile,
        side: Side,
        roomCode = '',
        campaignId: string | null = null,
        selectedVariant: VariantId = variantId,
    ) => {
        setMatchMode(mode);
        setProfileId(selectedProfile.id);
        setHumanSide(side);
        setVariantId(selectedVariant);
        setRoom(roomCode);
        setCampaignCase(campaignId);
        setPeerOnline(false);
        setRemoteSynced(mode !== 'remote' || side === 'operador');
        setTransportError('');
        setIsSpectator(false);
        setRoomFull(false);
        hostHasPlayerRef.current = false;
        recordedResult.current = null;
        setNextLevel(null);
        setAdvanceIn(null);
        match.restart(selectedVariant);
        setPage('match');
    };
    startMatchRef.current = startMatch;

    /** Reinicia el tablero y cancela cualquier ascenso pendiente. */
    const restartMatch = () => {
        setNextLevel(null);
        setAdvanceIn(null);
        match.restart();
    };

    /** Sube de inmediato al contacto siguiente. */
    const advanceNow = () => {
        if (nextLevel === null) {
            return;
        }

        setAdvanceIn(null);
        startMatch('ai', nextLevel, humanSide);
    };

    const leaveMatch = () => {
        if (matchMode === 'remote' && room !== '') {
            void transmit('leave', {
                role: isSpectator ? 'spectator' : 'player',
            });
        }
        hostHasPlayerRef.current = false;
        setRoom('');
        setRoomRole(null);
        setPeerOnline(false);
        setIsSpectator(false);
        setRoomFull(false);
        clearRivalNames();
        setNextLevel(null);
        setAdvanceIn(null);
        setRemoteScore({ operador: 0, entidad: 0 });
        setChatLines([]);
        setPeers({});
        greetedPeers.current = new Set();
        setPage('home');
    };

    const enterAsSpectator = () => {
        setIsSpectator(true);
        setRoomFull(false);
        setHumanSide('operador');
        setPeerOnline(true);
        setRemoteSynced(false);
        recordedResult.current = null;
        setRemoteScore({ operador: 0, entidad: 0 });
        setChatLines([]);
        setPeers({});
        match.restart(variantId);
        setPage('match');
    };

    const createRoom = () => {
        if (cleanName.length < 2) {
            setTransportError(
                'Escribe tu nombre (2 letras o más) para crear la sala.',
            );
            return;
        }

        const code = makeRoomCode();

        savePlayerName(cleanName);
        setMatchMode('remote');
        setHumanSide('operador');
        setRoom(code);
        setRoomRole('host');
        setPeerOnline(false);
        setRemoteSynced(false);
        setTransportError('');
        setIsSpectator(false);
        setRoomFull(false);
        clearRivalNames();
        setRemoteScore({ operador: 0, entidad: 0 });
        setChatLines([]);
        setPeers({});
        greetedPeers.current = new Set();
        hostHasPlayerRef.current = false;
        match.restart(variantId);
        setPage('waiting');
    };

    const joinRoom = () => {
        const code = roomInput.trim().toUpperCase();

        if (code.length < 3) {
            return;
        }

        if (cleanName.length < 2) {
            setTransportError(
                'Escribe tu nombre (2 letras o más) para entrar.',
            );
            return;
        }

        savePlayerName(cleanName);
        setMatchMode('remote');
        setHumanSide('entidad');
        setRoom(code);
        setRoomRole('guest');
        setPeerOnline(false);
        setRemoteSynced(false);
        setTransportError('');
        setIsSpectator(false);
        setRoomFull(false);
        clearRivalNames();
        setRemoteScore({ operador: 0, entidad: 0 });
        setChatLines([]);
        setPeers({});
        greetedPeers.current = new Set();
        match.restart(variantId);
        setPage('waiting');
    };

    const toggleMute = () => {
        const next = !muted;
        setMuted(next);
        setMutedState(next);
    };

    const toggleVoice = () => {
        const next = !voiceEnabled;
        setVoiceEnabled(next);
        setVoiceEnabledState(next);
    };

    const copyRoom = async () => {
        try {
            await navigator.clipboard.writeText(room);
            setCopyDone(true);
            window.setTimeout(() => setCopyDone(false), 1600);
        } catch {
            setTransportError('No se pudo copiar el código de sala.');
        }
    };

    const startCampaign = (caseId: string) => {
        const caseFile = CASES.find((candidate) => candidate.id === caseId);
        if (caseFile === undefined) {
            return;
        }

        setProgress((current) => registerAttempt(current, caseId));
        startMatch('ai', caseFile.profile, 'operador', '', caseId, 'spanish');
    };

    const stats = campaignStats(progress);
    const canUseBoard =
        !isSpectator &&
        match.canInteract &&
        (matchMode !== 'remote' || (peerOnline && remoteSynced));
    const statusText =
        match.snapshot.result !== null
            ? 'INFORME CERRADO'
            : match.thinking
              ? `${profile.callsign} CALCULANDO`
              : isSpectator
                ? !remoteSynced
                    ? 'SINCRONIZANDO TABLERO'
                    : 'MODO ESPECTADOR'
                : matchMode === 'remote'
                  ? !peerOnline
                      ? 'ESPERANDO AL SEGUNDO OPERADOR'
                      : !remoteSynced
                        ? 'SINCRONIZANDO TABLERO'
                        : match.snapshot.sideToMove === humanSide
                          ? 'TU TURNO'
                          : 'TURNO DEL RIVAL'
                  : match.snapshot.sideToMove === humanSide ||
                      matchMode === 'local'
                    ? 'TU TURNO'
                    : 'TURNO DE LA IA';

    return (
        <Screen>
            {remoteActive ? (
                <RemoteChannel room={room} onMessage={onRemoteMessage} />
            ) : null}
            <main className="d-wrap d-stack">
                {page !== 'home' && page !== 'match' ? (
                    <Button
                        icon={ArrowLeft}
                        variant="ghost"
                        onClick={() => {
                            if (page === 'academy') {
                                setPage(pageBeforeAcademy);
                            } else if (page === 'waiting') {
                                leaveMatch();
                            } else {
                                setPage('home');
                            }
                        }}
                    >
                        Volver
                    </Button>
                ) : null}

                {page === 'home' ? (
                    <>
                        <Header
                            code="ARCHIVO DE CAMPO · 08 CASOS"
                            title="DAMAS DEL DESIERTO"
                            meta="SEÑAL DETECTADA · SISTEMA LISTO"
                            right={
                                <Chip accent={connectionStatus === 'connected'}>
                                    <Radio size={13} />
                                    {connectionStatus === 'connected'
                                        ? 'EN LÍNEA'
                                        : connectionStatus === 'connecting' ||
                                            connectionStatus === 'reconnecting'
                                          ? 'CONECTANDO'
                                          : 'SIN SEÑAL'}
                                </Chip>
                            }
                        />
                        <div className="d-grid d-grid--bento">
                            <Plate label="CAMPAÑA · 8 INFORMES" accent>
                                <div className="d-stack" style={{ gap: 10 }}>
                                    <Crown size={24} className="d-acc" />
                                    <h2
                                        className="d-display"
                                        style={{ margin: 0, fontSize: 18 }}
                                    >
                                        ARCHIVO DE CONTACTO
                                    </h2>
                                    <Button
                                        icon={Flag}
                                        variant="accent"
                                        onClick={() => setPage('campaign')}
                                    >
                                        Abrir campaña
                                    </Button>
                                </div>
                            </Plate>
                            <Plate label="PARTIDA LIBRE">
                                <div className="d-stack" style={{ gap: 10 }}>
                                    <Bot size={24} className="d-acc" />
                                    <h2
                                        className="d-display"
                                        style={{ margin: 0, fontSize: 18 }}
                                    >
                                        UN OPERADOR
                                    </h2>
                                    <Button
                                        icon={Swords}
                                        onClick={() => setPage('setup')}
                                    >
                                        Preparar partida
                                    </Button>
                                </div>
                            </Plate>
                            <Plate label="MULTIJUGADOR · EN VIVO">
                                <div className="d-stack" style={{ gap: 10 }}>
                                    <Users size={24} className="d-acc" />
                                    <h2
                                        className="d-display"
                                        style={{ margin: 0, fontSize: 18 }}
                                    >
                                        DOS OPERADORES
                                    </h2>
                                    <Button
                                        icon={Link2}
                                        onClick={() => setPage('multiplayer')}
                                    >
                                        Abrir sala
                                    </Button>
                                </div>
                            </Plate>
                            <Plate label="ACADEMIA · 4 JUEGOS">
                                <div className="d-stack" style={{ gap: 10 }}>
                                    <BookOpen size={24} className="d-acc" />
                                    <h2
                                        className="d-display"
                                        style={{ margin: 0, fontSize: 18 }}
                                    >
                                        TUTORIAL Y ASISTENTE
                                    </h2>
                                    <Button
                                        icon={MessageCircle}
                                        onClick={() => {
                                            setPageBeforeAcademy('home');
                                            setPage('academy');
                                        }}
                                    >
                                        Conversar y aprender
                                    </Button>
                                </div>
                            </Plate>
                        </div>
                        <Plate label="REGISTRO DE CAMPAÑA" sunken>
                            <div className="d-row d-row--between">
                                <StatusLine
                                    text={`${stats.cleared} / ${stats.total} CASOS RESUELTOS`}
                                    accent
                                />
                                <StatusLine text={`RANGO · ${stats.rank}`} />
                            </div>
                        </Plate>
                    </>
                ) : null}

                {page === 'academy' ? (
                    <>
                        <Header
                            code="ACADEMIA · ASISTENTE CONVERSACIONAL"
                            title="APRENDE JUGANDO"
                            meta="ESPAÑOLAS · INTERNACIONALES · TURCAS · CHINAS"
                        />
                        <Academy
                            tutorialId={academyId}
                            onTutorialChange={setAcademyId}
                            onSpeak={speakText}
                        />
                    </>
                ) : null}

                {page === 'campaign' ? (
                    <>
                        <Header
                            code="ARCHIVO DE CAMPO · CAMPAÑA"
                            title="INFORMES ABIERTOS"
                            meta={`${stats.cleared} DE ${stats.total} CASOS RESUELTOS · ${stats.attempts} INTENTOS`}
                        />
                        <div className="d-grid d-grid--bento">
                            {CASES.map((caseFile, index) => {
                                const unlocked = isUnlocked(progress, index);
                                const record = progress[caseFile.id];
                                const Icon = caseFile.profile.icon;

                                return (
                                    <Plate
                                        key={caseFile.id}
                                        label={`${caseFile.code} · ${caseFile.coordinates}`}
                                        accent={record?.cleared === true}
                                    >
                                        <div
                                            className="d-stack"
                                            style={{ gap: 9 }}
                                        >
                                            <div className="d-row d-row--between">
                                                <Icon
                                                    size={20}
                                                    className={
                                                        unlocked
                                                            ? 'd-acc'
                                                            : 'd-mute'
                                                    }
                                                />
                                                {record?.cleared ? (
                                                    <Chip accent>
                                                        <Check size={12} />{' '}
                                                        RESUELTO
                                                    </Chip>
                                                ) : null}
                                            </div>
                                            <h2
                                                className="d-display"
                                                style={{
                                                    margin: 0,
                                                    fontSize: 15,
                                                }}
                                            >
                                                {caseFile.callsign}
                                            </h2>
                                            <p
                                                className="d-mono d-mute"
                                                style={{ margin: 0 }}
                                            >
                                                {caseFile.place}
                                            </p>
                                            <p
                                                className="d-mute"
                                                style={{
                                                    margin: 0,
                                                    fontSize: 13,
                                                }}
                                            >
                                                {caseFile.brief}
                                            </p>
                                            <StatusLine
                                                text={`RANGO · ${caseFile.reward}`}
                                            />
                                            <Button
                                                icon={unlocked ? Swords : Flag}
                                                variant={
                                                    unlocked
                                                        ? 'accent'
                                                        : 'plain'
                                                }
                                                disabled={!unlocked}
                                                onClick={() =>
                                                    startCampaign(caseFile.id)
                                                }
                                            >
                                                {unlocked
                                                    ? record?.cleared
                                                        ? 'Repetir caso'
                                                        : 'Investigar'
                                                    : 'Caso bloqueado'}
                                            </Button>
                                        </div>
                                    </Plate>
                                );
                            })}
                        </div>
                    </>
                ) : null}

                {page === 'setup' ? (
                    <>
                        <Header
                            code="PARTIDA LIBRE"
                            title="SELECCIONA EL CONTACTO"
                            meta="AJUSTA LAS REGLAS DE LA SESIÓN"
                        />
                        <VariantSelector
                            value={variantId}
                            onChange={setVariantId}
                        />
                        <Plate label="MODO DE PARTIDA">
                            <SegNav<FreeMode>
                                value={freeMode}
                                options={[
                                    {
                                        value: 'ai',
                                        label: 'CONTRA IA',
                                        icon: Bot,
                                    },
                                    {
                                        value: 'local',
                                        label: 'DOS JUGADORES',
                                        icon: Users,
                                    },
                                ]}
                                onChange={setFreeMode}
                                label="Modo de partida"
                            />
                        </Plate>
                        {freeMode === 'ai' ? (
                            <>
                                <Plate label="BANDO DEL OPERADOR">
                                    <SegNav<Side>
                                        value={humanSide}
                                        options={[
                                            {
                                                value: 'operador',
                                                label: 'CLARO',
                                                icon: Radio,
                                            },
                                            {
                                                value: 'entidad',
                                                label: 'OSCURO',
                                                icon: Crown,
                                            },
                                        ]}
                                        onChange={setHumanSide}
                                        label="Bando del operador"
                                    />
                                </Plate>
                                <div className="d-grid d-grid--bento">
                                    {AI_PROFILES.map((item, index) => {
                                        const Icon = item.icon;
                                        const selected = item.id === profileId;
                                        const record = recordOf(
                                            ladder,
                                            item.id,
                                        );
                                        const cleared = record.wins > 0;
                                        const current = index === ladder.level;
                                        return (
                                            <Plate
                                                key={item.id}
                                                label={`NIVEL ${ordinal(index)} · ${item.rating}`}
                                                accent={selected}
                                            >
                                                <div
                                                    className="d-stack"
                                                    style={{ gap: 9 }}
                                                >
                                                    <div className="d-row d-row--between">
                                                        <Icon
                                                            size={22}
                                                            className="d-acc"
                                                        />
                                                        <Chip accent={cleared}>
                                                            {cleared
                                                                ? `${record.wins}V · ${record.losses}D`
                                                                : current
                                                                  ? 'TU NIVEL'
                                                                  : 'SIN JUGAR'}
                                                        </Chip>
                                                    </div>
                                                    <h2
                                                        className="d-display"
                                                        style={{
                                                            margin: 0,
                                                            fontSize: 16,
                                                        }}
                                                    >
                                                        {item.callsign}
                                                    </h2>
                                                    <p
                                                        className="d-mute"
                                                        style={{
                                                            margin: 0,
                                                            minHeight: 42,
                                                        }}
                                                    >
                                                        {item.blurb}
                                                    </p>
                                                    <Button
                                                        icon={
                                                            selected
                                                                ? Check
                                                                : Bot
                                                        }
                                                        variant={
                                                            selected
                                                                ? 'accent'
                                                                : 'plain'
                                                        }
                                                        onClick={() =>
                                                            setProfileId(
                                                                item.id,
                                                            )
                                                        }
                                                    >
                                                        {selected
                                                            ? 'Seleccionada'
                                                            : 'Elegir señal'}
                                                    </Button>
                                                </div>
                                            </Plate>
                                        );
                                    })}
                                </div>
                                <LadderRankPlate
                                    ladder={ladder}
                                    activeId={profileId}
                                    onPick={(item) => setProfileId(item.id)}
                                />
                            </>
                        ) : (
                            <Plate label="DUELO LOCAL">
                                <Button
                                    icon={Swords}
                                    variant="accent"
                                    onClick={() =>
                                        startMatch('local', profile, 'operador')
                                    }
                                >
                                    Comenzar duelo
                                </Button>
                            </Plate>
                        )}
                        {freeMode === 'ai' ? (
                            <Button
                                icon={Swords}
                                variant="accent"
                                onClick={() =>
                                    startMatch('ai', profile, humanSide)
                                }
                            >
                                Iniciar contra {profile.callsign}
                            </Button>
                        ) : null}
                    </>
                ) : null}

                {page === 'multiplayer' ? (
                    <>
                        <Header
                            code="CANAL PÚBLICO · REVERB"
                            title="ESTABLECER CONTACTO"
                            meta="SALAS DE INVITACIÓN · REVERB"
                        />
                        <VariantSelector
                            value={variantId}
                            onChange={setVariantId}
                        />
                        <Plate label="IDENTIFICACIÓN" accent>
                            <div className="d-stack" style={{ gap: 10 }}>
                                <label
                                    className="d-mono d-mute"
                                    htmlFor="player-name"
                                >
                                    TU NOMBRE
                                </label>
                                <input
                                    id="player-name"
                                    className="d-input"
                                    value={playerName}
                                    maxLength={PLAYER_NAME_MAX}
                                    autoComplete="nickname"
                                    autoFocus
                                    placeholder="EJ. ANA"
                                    onChange={(event) =>
                                        setPlayerName(
                                            cleanPlayerName(event.target.value),
                                        )
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            document
                                                .getElementById('room-code')
                                                ?.focus();
                                        }
                                    }}
                                />
                                <p
                                    className="d-mute d-mono"
                                    style={{ margin: 0, fontSize: 12 }}
                                >
                                    {cleanName.length < 2
                                        ? 'ESCRIBE TU NOMBRE PARA JUGAR'
                                        : `JUGARÁS COMO ${cleanName.toUpperCase()} · EL RIVAL VERÁ ESTE NOMBRE`}
                                </p>
                            </div>
                        </Plate>
                        <div className="d-grid d-grid--split">
                            <Plate label="NUEVA SALA" accent>
                                <div className="d-stack">
                                    <Radio size={24} className="d-acc" />
                                    <Button
                                        icon={Users}
                                        variant="accent"
                                        disabled={cleanName.length < 2}
                                        onClick={createRoom}
                                    >
                                        Crear sala
                                    </Button>
                                </div>
                            </Plate>
                            <Plate label="UNIRSE A UNA SALA">
                                <div className="d-stack">
                                    <label
                                        className="d-mono d-mute"
                                        htmlFor="room-code"
                                    >
                                        CÓDIGO DE SALA
                                    </label>
                                    <input
                                        id="room-code"
                                        className="d-input"
                                        value={roomInput}
                                        maxLength={8}
                                        autoComplete="off"
                                        placeholder="EJ. 7KQ2LM"
                                        onChange={(event) =>
                                            setRoomInput(
                                                event.target.value
                                                    .toUpperCase()
                                                    .replace(/[^A-Z0-9]/g, ''),
                                            )
                                        }
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                joinRoom();
                                            }
                                        }}
                                    />
                                    <Button
                                        icon={Link2}
                                        disabled={
                                            roomInput.length < 3 ||
                                            cleanName.length < 2
                                        }
                                        onClick={joinRoom}
                                    >
                                        Entrar a la sala
                                    </Button>
                                    <p
                                        className="d-mute d-mono"
                                        style={{ margin: 0, fontSize: 12 }}
                                    >
                                        PULSA ENTER PARA ENTRAR
                                    </p>
                                </div>
                            </Plate>
                        </div>
                        <DuelRankPlate duels={duels} />
                        <Plate label="ESTADO DEL CANAL" sunken>
                            <div className="d-stack" style={{ gap: 8 }}>
                                <StatusLine
                                    text={`WEBSOCKET · ${String(connectionStatus).toUpperCase()}`}
                                    accent={connectionStatus === 'connected'}
                                />
                                {cleanName.length < 2 ? null : (
                                    <StatusLine
                                        text={`IDENTIDAD · ${cleanName.toUpperCase()}`}
                                        accent
                                    />
                                )}
                                {transportError !== '' ? (
                                    <StatusLine text={transportError} />
                                ) : null}
                            </div>
                        </Plate>
                    </>
                ) : null}

                {page === 'waiting' ? (
                    <>
                        <Header
                            code={
                                roomFull
                                    ? 'SALA COMPLETA · ESPECTADOR'
                                    : roomRole === 'host'
                                      ? 'ANFITRIÓN · SALA PRIVADA'
                                      : 'INVITADO · SALA PRIVADA'
                            }
                            title={
                                roomFull
                                    ? 'SALA LLENA'
                                    : roomRole === 'host'
                                      ? 'SALA CREADA'
                                      : 'CONECTANDO'
                            }
                            meta={`${rulesFor(variantId).name.toUpperCase()} · ${String(connectionStatus).toUpperCase()}`}
                        />
                        {roomFull ? (
                            <Plate label="SALA COMPLETA" accent>
                                <div className="d-stack" style={{ gap: 12 }}>
                                    <h2
                                        className="d-display"
                                        style={{ margin: 0, fontSize: 18 }}
                                    >
                                        YA HAY DOS JUGADORES
                                    </h2>
                                    <p className="d-mute" style={{ margin: 0 }}>
                                        La sala {room} ya tiene a sus dos
                                        operadores en juego. ¿Entras como
                                        espectador
                                        {cleanName === ''
                                            ? ''
                                            : `, ${cleanName.toUpperCase()},`}{' '}
                                        para mirar la partida sin mover piezas?
                                    </p>
                                    <div className="d-row">
                                        <Button
                                            icon={Users}
                                            variant="accent"
                                            onClick={enterAsSpectator}
                                        >
                                            Entrar como espectador
                                        </Button>
                                        <Button
                                            icon={ArrowLeft}
                                            variant="ghost"
                                            onClick={leaveMatch}
                                        >
                                            No, volver
                                        </Button>
                                    </div>
                                </div>
                            </Plate>
                        ) : (
                            <Plate label="CÓDIGO DE INVITACIÓN" accent>
                                <div className="d-stack" style={{ gap: 12 }}>
                                    <p
                                        className="d-code"
                                        aria-label={`Código ${room}`}
                                        style={{ margin: 0 }}
                                    >
                                        {room}
                                    </p>
                                    <div className="d-row d-row--between">
                                        <StatusLine
                                            text={
                                                roomRole === 'host'
                                                    ? peerOnline
                                                        ? `JUGADOR ENCONTRADO · ${nameOf('entidad')} · PREPARANDO TABLERO`
                                                        : `ESPERANDO AL SEGUNDO JUGADOR · TÚ: ${nameOf('operador')}`
                                                    : remoteSynced
                                                      ? `SALA SINCRONIZADA · ANFITRIÓN: ${nameOf('operador')}`
                                                      : `UNIÉNDOTE A LA SALA · TÚ: ${nameOf('entidad')}`
                                            }
                                            accent={peerOnline || remoteSynced}
                                        />
                                        <Button
                                            icon={copyDone ? Check : Copy}
                                            onClick={() => void copyRoom()}
                                        >
                                            {copyDone
                                                ? 'Copiado'
                                                : 'Copiar código'}
                                        </Button>
                                    </div>
                                    <MesaHint peers={peerList} />
                                    {connectionStatus === 'failed' ? (
                                        <StatusLine text="SIN CONEXIÓN EN VIVO. Si usas un túnel (cloudflared), apúntalo al proxy de multijugador y no al servidor web: ejecuta «npm run proxy» y crea el túnel hacia http://localhost:8100" />
                                    ) : null}
                                    {transportError !== '' ? (
                                        <StatusLine text={transportError} />
                                    ) : null}
                                </div>
                            </Plate>
                        )}
                        {roomFull ? null : (
                            <Button
                                icon={ArrowLeft}
                                variant="ghost"
                                onClick={leaveMatch}
                            >
                                Cancelar y volver
                            </Button>
                        )}
                    </>
                ) : null}

                {page === 'match' ? (
                    <>
                        <Header
                            code={
                                matchMode === 'remote'
                                    ? `SALA · ${room}`
                                    : matchMode === 'local'
                                      ? 'DUELO LOCAL'
                                      : `SEÑAL · ${profile.callsign}`
                            }
                            title={
                                match.snapshot.result === null
                                    ? 'CONTACTO ACTIVO'
                                    : 'INFORME CERRADO'
                            }
                            meta={`${match.snapshot.plies} JUGADAS · ${matchMode === 'remote' ? 'MULTIJUGADOR' : matchMode === 'local' ? 'DOS JUGADORES' : `NIVEL ${ordinal(profileIndex(profileId))} · ${profile.rating}`} · ${rulesFor(match.snapshot.variant).name.toUpperCase()}`}
                            right={
                                <div className="d-row">
                                    {matchMode === 'remote' ? (
                                        <Button
                                            icon={copyDone ? Check : Copy}
                                            onClick={() => void copyRoom()}
                                        >
                                            {copyDone
                                                ? 'Copiado'
                                                : 'Copiar sala'}
                                        </Button>
                                    ) : null}
                                    <Button
                                        icon={MessageCircle}
                                        onClick={() => {
                                            setPageBeforeAcademy('match');
                                            setPage('academy');
                                        }}
                                    >
                                        Asistente
                                    </Button>
                                </div>
                            }
                        />
                        {matchMode === 'remote' ? (
                            <Plate
                                label="ESTADO DE TRANSMISIÓN"
                                sunken
                                className="d-arena__link"
                            >
                                <div className="d-row d-row--between">
                                    <StatusLine
                                        text={`${String(connectionStatus).toUpperCase()} · ${peerOnline ? `RIVAL · ${rivalName()}` : 'ESPERANDO RIVAL'}`}
                                        accent={
                                            peerOnline &&
                                            connectionStatus === 'connected'
                                        }
                                    />
                                    <Button
                                        icon={RotateCcw}
                                        onClick={() =>
                                            void transmit('sync-request')
                                        }
                                    >
                                        Sincronizar
                                    </Button>
                                </div>
                            </Plate>
                        ) : null}
                        <div
                            className={`d-grid d-grid--split d-arena ${
                                matchMode === 'remote' ? 'd-arena--link' : ''
                            }`}
                        >
                            <section
                                className="d-stack d-arena__board"
                                style={{ gap: 10 }}
                            >
                                <SidePlate
                                    side="entidad"
                                    label={
                                        matchMode === 'remote'
                                            ? `${nameOf('entidad')} · OSCURO`
                                            : matchMode === 'local'
                                              ? 'JUGADOR 2 · OSCURO'
                                              : 'SEÑAL · OSCURO'
                                    }
                                    note={
                                        matchMode === 'ai'
                                            ? profile.callsign
                                            : 'BANDO OSCURO'
                                    }
                                    active={
                                        match.snapshot.sideToMove ===
                                            'entidad' &&
                                        match.snapshot.result === null
                                    }
                                    snapshot={match.snapshot}
                                />
                                <Board
                                    board={match.snapshot.board}
                                    animation={match.animation}
                                    selection={match.selection}
                                    targets={match.targets}
                                    lastMove={match.snapshot.lastMove}
                                    onSquare={match.onSquare}
                                    interactive={canUseBoard}
                                    variant={match.snapshot.variant}
                                    mustMove={
                                        canUseBoard ? match.mustMove : undefined
                                    }
                                    rejected={
                                        canUseBoard ? match.rejected : null
                                    }
                                    flipped={
                                        matchMode === 'remote' &&
                                        humanSide === 'entidad'
                                    }
                                />
                                <SidePlate
                                    side="operador"
                                    label={
                                        matchMode === 'remote'
                                            ? `${nameOf('operador')} · CLARO`
                                            : matchMode === 'local'
                                              ? 'JUGADOR 1 · CLARO'
                                              : 'OPERADOR · CLARO'
                                    }
                                    note={
                                        matchMode === 'remote'
                                            ? 'BANDO CLARO'
                                            : 'CONTROL LOCAL'
                                    }
                                    active={
                                        match.snapshot.sideToMove ===
                                            'operador' &&
                                        match.snapshot.result === null
                                    }
                                    snapshot={match.snapshot}
                                />
                            </section>
                            <aside className="d-stack d-arena__side">
                                <Plate
                                    label="ESTADO DE PARTIDA"
                                    accent
                                    className="d-arena__status"
                                >
                                    <div
                                        className="d-stack"
                                        style={{ gap: 10 }}
                                    >
                                        <StatusLine text={statusText} accent />
                                        {match.mustMove.size > 0 ? (
                                            <StatusLine
                                                text="SEÑAL RECHAZADA · MOVER LA FICHA MARCADA"
                                                accent
                                            />
                                        ) : null}
                                        {match.thinking ? (
                                            <ThinkingRow
                                                label={`${profile.callsign} ANALIZA EL CAMPO`}
                                            />
                                        ) : null}
                                        {transportError !== '' ? (
                                            <StatusLine text={transportError} />
                                        ) : null}
                                        {match.snapshot.result !== null ? (
                                            <div
                                                className="d-stack"
                                                style={{ gap: 8 }}
                                            >
                                                <h2
                                                    className="d-display"
                                                    style={{
                                                        margin: 0,
                                                        fontSize: 19,
                                                    }}
                                                >
                                                    {
                                                        verdictOf(
                                                            match.snapshot
                                                                .result,
                                                            humanSide,
                                                        ).title
                                                    }
                                                </h2>
                                                <p
                                                    className="d-mute"
                                                    style={{ margin: 0 }}
                                                >
                                                    {
                                                        verdictOf(
                                                            match.snapshot
                                                                .result,
                                                            humanSide,
                                                        ).detail
                                                    }
                                                </p>
                                                {nextLevel !== null ? (
                                                    <div
                                                        className="d-stack"
                                                        style={{ gap: 8 }}
                                                    >
                                                        <StatusLine
                                                            text={`NIVEL ${ordinal(profileIndex(profileId))} SUPERADO · PRÓXIMO CONTACTO: ${nextLevel.callsign} (${nextLevel.rating})`}
                                                            accent
                                                        />
                                                        <Button
                                                            icon={ChevronUp}
                                                            variant="accent"
                                                            onClick={advanceNow}
                                                        >
                                                            Subir al nivel{' '}
                                                            {ordinal(
                                                                profileIndex(
                                                                    nextLevel.id,
                                                                ),
                                                            )}
                                                        </Button>
                                                        {advanceIn === null ? (
                                                            <StatusLine text="ASCENSO EN PAUSA · REINICIA PARA SEGUIR EN ESTE NIVEL" />
                                                        ) : (
                                                            <>
                                                                <StatusLine
                                                                    text={`ASCENSO AUTOMÁTICO EN ${advanceIn} S`}
                                                                />
                                                                <Button
                                                                    icon={
                                                                        ArrowLeft
                                                                    }
                                                                    variant="ghost"
                                                                    onClick={() =>
                                                                        setAdvanceIn(
                                                                            null,
                                                                        )
                                                                    }
                                                                >
                                                                    Quedarme en
                                                                    el informe
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                ) : matchMode === 'remote' ? (
                                                    isSpectator ? null : (
                                                        <Button
                                                            icon={RotateCcw}
                                                            onClick={() => {
                                                                void transmit(
                                                                    'rematch',
                                                                );
                                                                restartMatch();
                                                            }}
                                                        >
                                                            Nueva partida
                                                        </Button>
                                                    )
                                                ) : (
                                                    <div
                                                        className="d-stack"
                                                        style={{ gap: 8 }}
                                                    >
                                                        {matchMode === 'ai' &&
                                                        campaignCase === null &&
                                                        match.snapshot.result
                                                            .winner ===
                                                            humanSide &&
                                                        ladder.level >=
                                                            MAX_LEVEL ? (
                                                            <StatusLine
                                                                text={`ESCALERA COMPLETA · SUPERASTE LOS ${AI_PROFILES.length} CONTACTOS`}
                                                                accent
                                                            />
                                                        ) : null}
                                                        <Button
                                                            icon={RotateCcw}
                                                            variant="accent"
                                                            onClick={
                                                                restartMatch
                                                            }
                                                        >
                                                            Jugar de nuevo
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                </Plate>
                                {matchMode === 'remote' ? (
                                    <div className="d-arena__score">
                                        <RemoteScorePlate
                                            names={{
                                                operador: nameOf('operador'),
                                                entidad: nameOf('entidad'),
                                            }}
                                            score={remoteScore}
                                            history={duelHistory}
                                            humanSide={humanSide}
                                            round={
                                                remoteScore.operador +
                                                remoteScore.entidad +
                                                1
                                            }
                                            rivalOnline={peerOnline}
                                        />
                                    </div>
                                ) : matchMode === 'ai' &&
                                  campaignCase === null ? (
                                    <div className="d-arena__score">
                                        <LadderPlate
                                            profile={profile}
                                            ladder={ladder}
                                        />
                                    </div>
                                ) : null}
                                {matchMode === 'remote' ? (
                                    <div className="d-arena__mesa">
                                        <MesaPlate
                                            peers={peerList}
                                            selfName={cleanName.toUpperCase()}
                                            selfRole={
                                                isSpectator
                                                    ? 'spectator'
                                                    : humanSide
                                            }
                                            lines={chatLines}
                                            onSend={sendChat}
                                        />
                                    </div>
                                ) : null}
                                <MoveLog
                                    entries={match.snapshot.log}
                                    viewer={humanSide}
                                />
                                <MatchControls
                                    canUndo={match.canUndo}
                                    onUndo={match.undo}
                                    onRestart={() => {
                                        if (matchMode === 'remote') {
                                            void transmit('rematch');
                                        }
                                        restartMatch();
                                    }}
                                    onSurrender={() => {
                                        if (matchMode === 'remote') {
                                            void transmit('resign', {
                                                side: humanSide,
                                            });
                                        }
                                        match.surrender();
                                    }}
                                    onExit={leaveMatch}
                                    muted={muted}
                                    onToggleMute={toggleMute}
                                    voiceEnabled={voiceEnabled}
                                    onToggleVoice={toggleVoice}
                                    showVoice={matchMode === 'ai'}
                                    showUndo={matchMode !== 'remote'}
                                    spectator={isSpectator}
                                />
                            </aside>
                        </div>
                    </>
                ) : null}
            </main>
        </Screen>
    );
};

const root = document.getElementById('damas-root');

if (root !== null) {
    const container = root as HTMLDivElement & { reactRoot?: Root };
    const reactRoot = container.reactRoot ?? createRoot(container);
    container.reactRoot = reactRoot;
    reactRoot.render(<DamasApp />);
}
