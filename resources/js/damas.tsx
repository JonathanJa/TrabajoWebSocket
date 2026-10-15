import { useConnectionStatus, useEchoPublic } from '@laravel/echo-react';
import {
    ArrowLeft,
    BookOpen,
    Bot,
    Check,
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
    campaignStats,
    isUnlocked,
    loadProgress,
    registerAttempt,
    registerWin,
    type ProgressMap,
} from './damas/campaign/progress';
import type { Move, Side } from './damas/engine/types';
import {
    DEFAULT_VARIANT,
    isVariantId,
    rulesFor,
    type VariantId,
} from './damas/engine/variants';
import { isLegal, type MatchSnapshot } from './damas/game/matchState';
import type { AcademyId } from './damas/game/academy';
import { isMuted, setMuted } from './damas/game/sound';
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
    const [room, setRoom] = useState('');
    const [roomInput, setRoomInput] = useState('');
    const [roomRole, setRoomRole] = useState<RoomRole>(null);
    const [peerOnline, setPeerOnline] = useState(false);
    const [remoteSynced, setRemoteSynced] = useState(false);
    const [copyDone, setCopyDone] = useState(false);
    const [muted, setMutedState] = useState(isMuted());
    const [voiceEnabled, setVoiceEnabledState] = useState(isVoiceEnabled());
    const [transportError, setTransportError] = useState('');
    const playerId = useRef(newPlayerId());
    const matchRef = useRef<MatchController | null>(null);
    const recordedResult = useRef<string | null>(null);
    const connectionStatus = useConnectionStatus();
    const profile = profileById(profileId);
    const remoteActive =
        (page === 'waiting' || page === 'match') &&
        matchMode === 'remote' &&
        room !== '';

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
                case 'join':
                    if (roomRole === 'host') {
                        setPeerOnline(true);
                        setRemoteSynced(false);
                        setPage('match');
                        void transmit('sync', { snapshot: game.snapshot });
                    }
                    break;
                case 'hello':
                    setPeerOnline(true);
                    if (humanSide === 'operador') {
                        void transmit('sync', { snapshot: game.snapshot });
                    }
                    break;
                case 'leave':
                    setPeerOnline(false);
                    break;
                case 'sync-request':
                    setPeerOnline(true);
                    if (humanSide === 'operador') {
                        void transmit('sync', { snapshot: game.snapshot }).then(
                            (sent) => setRemoteSynced(sent),
                        );
                    }
                    break;
                case 'sync': {
                    setPeerOnline(true);
                    const snapshot = decodeSnapshot(payload.snapshot);
                    if (snapshot !== null) {
                        setVariantId(snapshot.variant);
                        game.adoptSnapshot(snapshot);
                        setRemoteSynced(true);
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
        [humanSide, roomRole, transmit],
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
            if (roomRole === 'host') {
                return;
            }

            const timeout = window.setTimeout(() => {
                void transmit('join', { variant: variantId }).then((joined) => {
                    if (joined) {
                        setPeerOnline(true);
                        setPage('match');
                    }
                });
            }, 200);

            return () => window.clearTimeout(timeout);
        }

        const timeout = window.setTimeout(() => {
            void transmit('hello', { side: humanSide });
            if (humanSide === 'entidad') {
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
    ]);

    useEffect(() => {
        const result = match.snapshot.result;

        if (result === null) {
            recordedResult.current = null;
            return;
        }

        const resultKey = `${matchMode}:${campaignCase ?? 'free'}:${match.snapshot.plies}:${result.reason}`;
        if (recordedResult.current === resultKey) {
            return;
        }

        recordedResult.current = resultKey;
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
        match.snapshot.result,
        match.snapshot.plies,
        matchMode,
        page,
        campaignCase,
    ]);

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
        recordedResult.current = null;
        match.restart(selectedVariant);
        setPage('match');
    };

    const leaveMatch = () => {
        if (matchMode === 'remote' && room !== '') {
            void transmit('leave');
        }
        setRoom('');
        setRoomRole(null);
        setPeerOnline(false);
        setPage('home');
    };

    const createRoom = () => {
        const code = makeRoomCode();

        setMatchMode('remote');
        setHumanSide('operador');
        setRoom(code);
        setRoomRole('host');
        setPeerOnline(false);
        setRemoteSynced(false);
        setTransportError('');
        match.restart(variantId);
        setPage('waiting');
    };

    const joinRoom = () => {
        const code = roomInput.trim().toUpperCase();

        if (code.length < 3) {
            return;
        }

        setMatchMode('remote');
        setHumanSide('entidad');
        setRoom(code);
        setRoomRole('guest');
        setPeerOnline(false);
        setRemoteSynced(false);
        setTransportError('');
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
        match.canInteract &&
        (matchMode !== 'remote' || (peerOnline && remoteSynced));
    const statusText =
        match.snapshot.result !== null
            ? 'INFORME CERRADO'
            : match.thinking
              ? `${profile.callsign} CALCULANDO`
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
                                    {AI_PROFILES.map((item) => {
                                        const Icon = item.icon;
                                        const selected = item.id === profileId;
                                        return (
                                            <Plate
                                                key={item.id}
                                                label={`NIVEL ${item.rating}`}
                                                accent={selected}
                                            >
                                                <div
                                                    className="d-stack"
                                                    style={{ gap: 9 }}
                                                >
                                                    <Icon
                                                        size={22}
                                                        className="d-acc"
                                                    />
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
                        <div className="d-grid d-grid--split">
                            <Plate label="NUEVA SALA" accent>
                                <div className="d-stack">
                                    <Radio size={24} className="d-acc" />
                                    <Button
                                        icon={Users}
                                        variant="accent"
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
                                    />
                                    <Button
                                        icon={Link2}
                                        disabled={roomInput.length < 3}
                                        onClick={joinRoom}
                                    >
                                        Entrar a la sala
                                    </Button>
                                </div>
                            </Plate>
                        </div>
                        <Plate label="ESTADO DEL CANAL" sunken>
                            <div className="d-stack" style={{ gap: 8 }}>
                                <StatusLine
                                    text={`WEBSOCKET · ${String(connectionStatus).toUpperCase()}`}
                                    accent={connectionStatus === 'connected'}
                                />
                            </div>
                        </Plate>
                    </>
                ) : null}

                {page === 'waiting' ? (
                    <>
                        <Header
                            code={
                                roomRole === 'host'
                                    ? 'ANFITRIÓN · SALA PRIVADA'
                                    : 'INVITADO · SALA PRIVADA'
                            }
                            title={
                                roomRole === 'host'
                                    ? 'SALA CREADA'
                                    : 'CONECTANDO'
                            }
                            meta={`${rulesFor(variantId).name.toUpperCase()} · ${String(connectionStatus).toUpperCase()}`}
                        />
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
                                                    ? 'JUGADOR ENCONTRADO · PREPARANDO TABLERO'
                                                    : 'ESPERANDO AL SEGUNDO JUGADOR'
                                                : remoteSynced
                                                  ? 'SALA SINCRONIZADA'
                                                  : 'UNIÉNDOTE A LA SALA'
                                        }
                                        accent={peerOnline || remoteSynced}
                                    />
                                    <Button
                                        icon={copyDone ? Check : Copy}
                                        onClick={() => void copyRoom()}
                                    >
                                        {copyDone ? 'Copiado' : 'Copiar código'}
                                    </Button>
                                </div>
                                {transportError !== '' ? (
                                    <StatusLine text={transportError} />
                                ) : null}
                            </div>
                        </Plate>
                        <Button
                            icon={ArrowLeft}
                            variant="ghost"
                            onClick={leaveMatch}
                        >
                            Cancelar y volver
                        </Button>
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
                            meta={`${match.snapshot.plies} JUGADAS · ${matchMode === 'remote' ? 'MULTIJUGADOR' : matchMode === 'local' ? 'DOS JUGADORES' : `NIVEL ${profile.rating}`} · ${rulesFor(match.snapshot.variant).name.toUpperCase()}`}
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
                            <Plate label="ESTADO DE TRANSMISIÓN" sunken>
                                <div className="d-row d-row--between">
                                    <StatusLine
                                        text={`${String(connectionStatus).toUpperCase()} · ${peerOnline ? 'RIVAL DETECTADO' : 'ESPERANDO RIVAL'}`}
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
                        <div className="d-grid d-grid--split">
                            <section className="d-stack" style={{ gap: 10 }}>
                                <SidePlate
                                    side="entidad"
                                    label={
                                        matchMode === 'remote' &&
                                        humanSide === 'entidad'
                                            ? 'TÚ · OSCURO'
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
                                    flipped={
                                        matchMode === 'remote' &&
                                        humanSide === 'entidad'
                                    }
                                />
                                <SidePlate
                                    side="operador"
                                    label={
                                        matchMode === 'remote' &&
                                        humanSide === 'operador'
                                            ? 'TÚ · CLARO'
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
                            <aside className="d-stack">
                                <Plate label="ESTADO DE PARTIDA" accent>
                                    <div
                                        className="d-stack"
                                        style={{ gap: 10 }}
                                    >
                                        <StatusLine text={statusText} accent />
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
                                                {matchMode === 'remote' ? (
                                                    <Button
                                                        icon={RotateCcw}
                                                        onClick={() => {
                                                            void transmit(
                                                                'rematch',
                                                            );
                                                            match.restart();
                                                        }}
                                                    >
                                                        Nueva partida
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        icon={RotateCcw}
                                                        variant="accent"
                                                        onClick={match.restart}
                                                    >
                                                        Jugar de nuevo
                                                    </Button>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                </Plate>
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
                                        match.restart();
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
