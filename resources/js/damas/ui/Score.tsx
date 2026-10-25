import { Check, Swords } from 'lucide-react';
import { AI_PROFILES, type AiProfile } from '../ai/profiles';
import {
    MAX_LEVEL,
    ladderTotals,
    profileIndex,
    recordOf,
    type LadderState,
} from '../campaign/ladder';
import { duelTotals, type DuelMap, type DuelRecord } from '../game/duels';
import type { Side } from '../engine/types';
import { Chip, Plate, Stat } from './primitives';
import { StatusLine } from './Hud';

const ordinal = (index: number): string => String(index + 1).padStart(2, '0');

/** Marcador de la partida por red: quién va ganando la serie. */
export const RemoteScorePlate = ({
    names,
    score,
    history,
    humanSide,
    round,
    rivalOnline,
}: {
    names: Record<Side, string>;
    score: Record<Side, number>;
    history: DuelRecord;
    humanSide: Side;
    round: number;
    rivalOnline: boolean;
}) => (
    <Plate label={`MARCADOR · RONDA ${ordinal(round - 1)}`} accent>
        <div className="d-stack" style={{ gap: 10 }}>
            <div className="d-score">
                <span
                    className={`d-score__name ${
                        humanSide === 'operador' ? 'd-acc' : 'd-mute'
                    }`}
                >
                    {names[humanSide]}
                </span>
                <span className="d-score__value">{score[humanSide]}</span>
                <span className="d-score__dash">:</span>
                <span className="d-score__value">
                    {score[humanSide === 'operador' ? 'entidad' : 'operador']}
                </span>
                <span
                    className={`d-score__name ${
                        humanSide === 'entidad' ? 'd-acc' : 'd-mute'
                    }`}
                >
                    {names[humanSide === 'operador' ? 'entidad' : 'operador']}
                </span>
            </div>
            <div className="d-row" style={{ gap: 8 }}>
                <Chip>{`HISTORIAL ${history.wins}V · ${history.losses}D`}</Chip>
                <Chip
                    accent={
                        rivalOnline ||
                        score[
                            humanSide === 'operador' ? 'entidad' : 'operador'
                        ] > 0
                    }
                >
                    {rivalOnline ? 'RIVAL PRESENTE' : 'RIVAL AUSENTE'}
                </Chip>
            </div>
        </div>
    </Plate>
);

/** Marcador de la escalera contra la IA: nivel, historial y puntaje. */
export const LadderPlate = ({
    profile,
    ladder,
}: {
    profile: AiProfile;
    ladder: LadderState;
}) => {
    const record = recordOf(ladder, profile.id);
    const totals = ladderTotals(ladder);
    const index = Math.max(profileIndex(profile.id), 0);

    return (
        <Plate label="MARCADOR DEL CONTACTO" accent>
            <div className="d-stack" style={{ gap: 10 }}>
                <div className="d-row d-row--between">
                    <span className="d-mono d-mute">
                        NIVEL {ordinal(index)} / {AI_PROFILES.length}
                    </span>
                    <Chip accent>
                        {profile.callsign} · {profile.rating}
                    </Chip>
                </div>
                <div className="d-row" style={{ gap: 16 }}>
                    <Stat
                        label="VICTORIAS"
                        value={<span className="d-acc">{record.wins}</span>}
                    />
                    <Stat
                        label="DERROTAS"
                        value={<span className="d-mute">{record.losses}</span>}
                    />
                    <Stat
                        label="PUNTAJE"
                        value={<span className="d-acc">{totals.points}</span>}
                    />
                </div>
                <StatusLine
                    text={`ESCALERA · ${totals.cleared} CONTACTOS SUPERADOS DE ${AI_PROFILES.length}`}
                    accent={totals.cleared > 0}
                />
            </div>
        </Plate>
    );
};

/** Tabla completa de la escalera: quién va ganando contra cada contacto. */
export const LadderRankPlate = ({
    ladder,
    activeId,
    onPick,
}: {
    ladder: LadderState;
    activeId: string;
    onPick: (profile: AiProfile) => void;
}) => {
    const totals = ladderTotals(ladder);
    const reached = Math.min(Math.max(ladder.level, 0), MAX_LEVEL);

    return (
        <Plate label="RANKING DE LA ESCALERA">
            <div className="d-stack" style={{ gap: 10 }}>
                <div className="d-row d-row--between">
                    <span className="d-mono d-acc">
                        PUNTAJE {totals.points}
                    </span>
                    <span className="d-mono d-mute">
                        {totals.wins}V · {totals.losses}D · {totals.cleared}/
                        {AI_PROFILES.length} SUPERADOS
                    </span>
                </div>
                <div
                    className="d-rank"
                    role="group"
                    aria-label="Contactos de la escalera"
                >
                    {AI_PROFILES.map((profile, index) => {
                        const record = recordOf(ladder, profile.id);
                        const cleared = record.wins > 0;
                        const current = index === reached;
                        const active = profile.id === activeId;

                        return (
                            <button
                                key={profile.id}
                                type="button"
                                aria-pressed={active}
                                className={[
                                    'd-rank__row',
                                    cleared ? 'd-rank__row--cleared' : '',
                                    current ? 'd-rank__row--level' : '',
                                    active ? 'd-rank__row--active' : '',
                                ]
                                    .filter((value) => value !== '')
                                    .join(' ')}
                                onClick={() => onPick(profile)}
                            >
                                <span className="d-rank__pos">
                                    {cleared ? (
                                        <Check size={13} />
                                    ) : current ? (
                                        <Swords size={13} />
                                    ) : (
                                        <span className="d-quiet">·</span>
                                    )}
                                </span>
                                <span className="d-rank__num">
                                    {ordinal(index)}
                                </span>
                                <span className="d-rank__name">
                                    {profile.callsign}
                                </span>
                                <span className="d-rank__rating">
                                    {profile.rating}
                                </span>
                                <span className="d-rank__tally">
                                    {record.wins}V · {record.losses}D
                                </span>
                                <span className="d-rank__tag">
                                    {current ? 'TU NIVEL' : ''}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </Plate>
    );
};

/** Ranking entre personas: historial cara a cara guardado en este dispositivo. */
export const DuelRankPlate = ({ duels }: { duels: DuelMap }) => {
    const totals = duelTotals(duels);
    const rows = Object.entries(duels)
        .map(([name, record]) => ({ name, ...record }))
        .sort(
            (a, b) =>
                b.wins - a.wins ||
                a.losses - b.losses ||
                a.name.localeCompare(b.name),
        );

    return (
        <Plate label="RANKING DE RIVALES">
            <div className="d-stack" style={{ gap: 10 }}>
                <div className="d-row d-row--between">
                    <span className="d-mono d-acc">
                        SERIE TOTAL · {totals.wins}V · {totals.losses}D
                    </span>
                    <span className="d-mono d-mute">
                        {rows.length === 1
                            ? '1 RIVAL'
                            : `${rows.length} RIVALES`}
                    </span>
                </div>
                {rows.length === 0 ? (
                    <p className="d-mute d-mono" style={{ margin: 0 }}>
                        SIN HISTORIAL TODAVÍA · JUGÁ UNA SERIE POR RED
                    </p>
                ) : (
                    <div
                        className="d-rank"
                        role="list"
                        aria-label="Ranking de rivales"
                    >
                        {rows.map((row, index) => {
                            const ahead = row.wins >= row.losses;

                            return (
                                <div
                                    key={row.name}
                                    role="listitem"
                                    className={`d-duel ${
                                        ahead ? 'd-duel--ahead' : ''
                                    }`}
                                >
                                    <span className="d-rank__pos">
                                        {ahead ? (
                                            <Check size={13} />
                                        ) : (
                                            <span className="d-quiet">
                                                {ordinal(index)}
                                            </span>
                                        )}
                                    </span>
                                    <span className="d-rank__name">
                                        {row.name}
                                    </span>
                                    <span className="d-rank__tally">
                                        {row.wins}V · {row.losses}D
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Plate>
    );
};
