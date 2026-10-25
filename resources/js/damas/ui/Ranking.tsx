import { RefreshCw, Trophy, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PLAYER_NAME_MAX, cleanPlayerName } from '../game/identity';
import {
    fetchRanking,
    formatPlayedAt,
    type RankingPlayer,
} from '../game/scores';
import { Button, Plate } from './primitives';
import { StatusLine } from './Hud';

const useRanking = (limit: number) => {
    const [rows, setRows] = useState<RankingPlayer[] | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const players = await fetchRanking();
            setRows(players.slice(0, limit));
        } catch {
            setError('No se pudo cargar el ranking. Revisá la conexión.');
        } finally {
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        void reload();
    }, [reload]);

    return { rows, error, loading, reload };
};

const RankingRows = ({
    rows,
    compact = false,
}: {
    rows: RankingPlayer[];
    compact?: boolean;
}) => (
    <div
        className="d-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Tabla del ranking global"
    >
        <table className={`d-table ${compact ? 'd-table--compact' : ''}`}>
            <caption className="sr-only">
                Ranking global de participantes, ordenado por puntos
            </caption>
            <thead>
                <tr>
                    <th scope="col">#</th>
                    <th scope="col">JUGADOR</th>
                    <th scope="col">PUNTOS</th>
                    {compact ? (
                        <th scope="col">V · D</th>
                    ) : (
                        <>
                            <th scope="col">V</th>
                            <th scope="col">D</th>
                            <th scope="col">E</th>
                            <th scope="col">PARTIDAS</th>
                            <th scope="col">ÚLTIMA</th>
                        </>
                    )}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, index) => (
                    <tr key={row.name}>
                        <td className="d-table__pos">
                            {String(index + 1).padStart(2, '0')}
                        </td>
                        <th scope="row" className="d-table__name">
                            {row.name}
                        </th>
                        <td className="d-table__points">{row.points}</td>
                        {compact ? (
                            <td className="d-table__tally">
                                {row.wins}V · {row.losses}D
                            </td>
                        ) : (
                            <>
                                <td>{row.wins}</td>
                                <td>{row.losses}</td>
                                <td>{row.draws}</td>
                                <td>{row.games}</td>
                                <td className="d-table__date">
                                    {formatPlayedAt(row.last_played_at)}
                                </td>
                            </>
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const RankingStatus = ({
    loading,
    error,
    rows,
    onRetry,
    compact = false,
}: {
    loading: boolean;
    error: string;
    rows: RankingPlayer[] | null;
    onRetry: () => void;
    compact?: boolean;
}) => {
    if (loading) {
        return <StatusLine text="CARGANDO RANKING…" role="status" />;
    }

    if (error !== '') {
        return (
            <div className="d-stack" style={{ gap: 8 }}>
                <StatusLine text={error} role="alert" />
                <Button icon={RefreshCw} onClick={onRetry}>
                    Reintentar
                </Button>
            </div>
        );
    }

    const count = rows?.length ?? 0;

    return (
        <StatusLine
            text={
                compact
                    ? `TOP 5 · ${count} PARTICIPANTES`
                    : count === 0
                      ? 'RANKING VACÍO'
                      : `MOSTRANDO ${count} PARTICIPANTES`
            }
            accent={count > 0}
            role="status"
        />
    );
};

/** Vista previa del ranking y campo de nombre en la portada. */
export const GlobalRankingPlate = ({
    name,
    onNameChange,
    onOpen,
}: {
    name: string;
    onNameChange: (value: string) => void;
    onOpen: () => void;
}) => {
    const { rows, error, loading, reload } = useRanking(5);

    return (
        <Plate label="RANKING GLOBAL · BASE DE DATOS">
            <div className="d-grid d-grid--split d-ranking-home">
                <div className="d-stack" style={{ gap: 10 }}>
                    <div className="d-row" style={{ gap: 8 }}>
                        <Trophy size={22} className="d-acc" />
                        <h2
                            className="d-display"
                            style={{ margin: 0, fontSize: 18 }}
                        >
                            TU LUGAR EN LA SEÑAL
                        </h2>
                    </div>
                    <label
                        className="d-mono d-mute"
                        htmlFor="global-player-name"
                    >
                        TU NOMBRE PARA EL RANKING
                    </label>
                    <input
                        id="global-player-name"
                        className="d-input"
                        value={name}
                        maxLength={PLAYER_NAME_MAX}
                        autoComplete="nickname"
                        placeholder="EJ. ANA"
                        aria-describedby="global-player-name-help"
                        onChange={(event) =>
                            onNameChange(cleanPlayerName(event.target.value))
                        }
                    />
                    <p
                        id="global-player-name-help"
                        className="d-mute d-mono"
                        style={{ margin: 0, fontSize: 12 }}
                    >
                        SE GUARDA AL TERMINAR CADA PARTIDA · MÍNIMO 2 LETRAS
                    </p>
                    <div className="d-row">
                        <Button icon={Trophy} variant="accent" onClick={onOpen}>
                            Ver ranking completo
                        </Button>
                        <Button icon={RefreshCw} onClick={() => void reload()}>
                            Actualizar
                        </Button>
                    </div>
                </div>
                <div className="d-stack" style={{ gap: 8 }}>
                    <RankingStatus
                        loading={loading}
                        error={error}
                        rows={rows}
                        onRetry={() => void reload()}
                        compact
                    />
                    {rows !== null && rows.length > 0 ? (
                        <RankingRows rows={rows} compact />
                    ) : null}
                    {rows !== null && rows.length === 0 && !loading ? (
                        <p className="d-mute" style={{ margin: 0 }}>
                            Todavía no hay puntajes. Jugá una partida para
                            estrenar la tabla.
                        </p>
                    ) : null}
                </div>
            </div>
        </Plate>
    );
};

/** Página completa del ranking global. */
export const RankingPage = () => {
    const { rows, error, loading, reload } = useRanking(50);

    return (
        <Plate label="RANKING GLOBAL · BASE DE DATOS" accent>
            <div className="d-stack" style={{ gap: 14 }}>
                <div className="d-row d-row--between">
                    <div className="d-stack" style={{ gap: 4 }}>
                        <div className="d-row" style={{ gap: 8 }}>
                            <UserRound size={22} className="d-acc" />
                            <h2
                                className="d-display"
                                style={{ margin: 0, fontSize: 20 }}
                            >
                                MEJORES PUNTAJES
                            </h2>
                        </div>
                        <p className="d-mute" style={{ margin: 0 }}>
                            Los puntos se suman al terminar cada partida. El
                            servidor guarda el nombre y el resultado.
                        </p>
                    </div>
                    <Button icon={RefreshCw} onClick={() => void reload()}>
                        Actualizar
                    </Button>
                </div>
                <p className="d-mono d-mute" style={{ margin: 0 }}>
                    RED 100/40/20 · CAMPAÑA 90/30/10 · CHINAS 80/30/15 · IA
                    60/20/10 · LOCAL 50/20/10
                </p>
                <RankingStatus
                    loading={loading}
                    error={error}
                    rows={rows}
                    onRetry={() => void reload()}
                />
                {rows !== null && rows.length > 0 ? (
                    <RankingRows rows={rows} />
                ) : null}
                {rows !== null && rows.length === 0 && !loading ? (
                    <p className="d-mute" style={{ margin: 0 }}>
                        La tabla está vacía. Terminá una partida para registrar
                        el primer puntaje.
                    </p>
                ) : null}
            </div>
        </Plate>
    );
};
