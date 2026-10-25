import type { LucideIcon } from 'lucide-react';
import {
    Aperture,
    Atom,
    Copy,
    Crosshair,
    Eye,
    Gem,
    Infinity as InfinityIcon,
    Layers,
    Mountain,
    Orbit,
    Radar,
    Shield,
    Sigma,
    Snowflake,
    Tornado,
    Waves,
    Zap,
} from 'lucide-react';

/** Ajustes de búsqueda que definen la fuerza y el "carácter" de una IA. */
export interface AiSearchConfig {
    /** Profundidad máxima de la búsqueda profunda. */
    maxDepth: number;
    /** Profundidad con la que "ve" el ruido y la pifia. */
    rankDepth: number;
    /** Tope de tiempo por jugada, en milisegundos. */
    timeMs: number;
    /** Plies extra cuando la captura es obligatoria. */
    extensions: number;
    /** Banda de imprecisión en centipeones (0 = no perdona). */
    noise: number;
    /** Probabilidad de elegir una jugada peor que la mejor. */
    blunderChance: number;
    /** Cuántos puestos por debajo puede caer cuando pifia. */
    blunderPool: number;
    /** Retardo mínimo para que su jugada se vea pensada. */
    minThinkMs: number;
}

export interface AiProfile {
    id: string;
    callsign: string;
    rating: number;
    /** Línea de voz del informe. */
    blurb: string;
    icon: LucideIcon;
    config: AiSearchConfig;
}

export const AI_PROFILES: readonly AiProfile[] = [
    {
        id: 'parpadeo',
        callsign: 'PARPADEO',
        rating: 380,
        blurb: 'Señal intermitente a 12 km. Se mueve sin saber dónde está.',
        icon: Zap,
        config: {
            maxDepth: 1,
            rankDepth: 1,
            timeMs: 300,
            extensions: 4,
            noise: 90,
            blunderChance: 0.55,
            blunderPool: 8,
            minThinkMs: 320,
        },
    },
    {
        id: 'rastro',
        callsign: 'RASTRO',
        rating: 620,
        blurb: 'Deja marcas en la ruta. Aprende rápido, pero se impacienta.',
        icon: Copy,
        config: {
            maxDepth: 2,
            rankDepth: 1,
            timeMs: 420,
            extensions: 4,
            noise: 70,
            blunderChance: 0.45,
            blunderPool: 6,
            minThinkMs: 340,
        },
    },
    {
        id: 'alambre',
        callsign: 'ALAMBRE',
        rating: 880,
        blurb: 'Zumbido metálico sobre el tendido. Corta el aire y calcula.',
        icon: Crosshair,
        config: {
            maxDepth: 3,
            rankDepth: 2,
            timeMs: 620,
            extensions: 5,
            noise: 46,
            blunderChance: 0.28,
            blunderPool: 5,
            minThinkMs: 380,
        },
    },
    {
        id: 'cuarzo',
        callsign: 'CUARZO',
        rating: 1120,
        blurb: 'Refracta la luz del desierto: sus piezas aparecen donde no las esperás.',
        icon: Gem,
        config: {
            maxDepth: 5,
            rankDepth: 3,
            timeMs: 950,
            extensions: 5,
            noise: 28,
            blunderChance: 0.17,
            blunderPool: 4,
            minThinkMs: 420,
        },
    },
    {
        id: 'espejo',
        callsign: 'ESPEJO',
        rating: 1360,
        blurb: 'Repite tus jugadas antes de castigarlas.',
        icon: Eye,
        config: {
            maxDepth: 6,
            rankDepth: 4,
            timeMs: 1250,
            extensions: 6,
            noise: 14,
            blunderChance: 0.1,
            blunderPool: 3,
            minThinkMs: 460,
        },
    },
    {
        id: 'vortice',
        callsign: 'VÓRTICE',
        rating: 1580,
        blurb: 'Gira sobre el campo. Si bajás la guardia, te aspira.',
        icon: Tornado,
        config: {
            maxDepth: 7,
            rankDepth: 5,
            timeMs: 1750,
            extensions: 6,
            noise: 8,
            blunderChance: 0.04,
            blunderPool: 2,
            minThinkMs: 520,
        },
    },
    {
        id: 'oraculo',
        callsign: 'ORÁCULO',
        rating: 1800,
        blurb: 'Ya vio esta partida. Espera a que la juegues.',
        icon: Radar,
        config: {
            maxDepth: 10,
            rankDepth: 7,
            timeMs: 2400,
            extensions: 7,
            noise: 3,
            blunderChance: 0.01,
            blunderPool: 2,
            minThinkMs: 600,
        },
    },
    {
        id: 'centinela',
        callsign: 'CENTINELA',
        rating: 2050,
        blurb: 'No parpadea. No concede. El último contacto del informe.',
        icon: Shield,
        config: {
            maxDepth: 15,
            rankDepth: 9,
            timeMs: 3200,
            extensions: 8,
            noise: 0,
            blunderChance: 0,
            blunderPool: 1,
            minThinkMs: 700,
        },
    },
    {
        id: 'simun',
        callsign: 'SIMÚN',
        rating: 2300,
        blurb: 'Levanta la arena y borra las huellas. No vas a ver de dónde viene.',
        icon: Waves,
        config: {
            maxDepth: 17,
            rankDepth: 10,
            timeMs: 3600,
            extensions: 8,
            noise: 0,
            blunderChance: 0,
            blunderPool: 1,
            minThinkMs: 760,
        },
    },
    {
        id: 'yunque',
        callsign: 'YUNQUE',
        rating: 2560,
        blurb: 'Golpea siempre el mismo punto hasta que la línea se quiebra.',
        icon: Mountain,
        config: {
            maxDepth: 18,
            rankDepth: 11,
            timeMs: 3800,
            extensions: 9,
            noise: 0,
            blunderChance: 0,
            blunderPool: 1,
            minThinkMs: 800,
        },
    },
    {
        id: 'nucleo',
        callsign: 'NÚCLEO',
        rating: 2830,
        blurb: 'Denso y estable. Cada pieza que se acerca, se apaga.',
        icon: Atom,
        config: {
            maxDepth: 20,
            rankDepth: 12,
            timeMs: 4000,
            extensions: 9,
            noise: 0,
            blunderChance: 0,
            blunderPool: 1,
            minThinkMs: 840,
        },
    },
    {
        id: 'eclipse',
        callsign: 'ECLIPSE',
        rating: 3100,
        blurb: 'Tapa tu señal y aparece donde ya no hay luz.',
        icon: Orbit,
        config: {
            maxDepth: 21,
            rankDepth: 13,
            timeMs: 4300,
            extensions: 10,
            noise: 0,
            blunderChance: 0,
            blunderPool: 1,
            minThinkMs: 880,
        },
    },
    {
        id: 'hielo',
        callsign: 'HIELO',
        rating: 3380,
        blurb: 'No siente presión ni calor: no perdona una sola jugada.',
        icon: Snowflake,
        config: {
            maxDepth: 22,
            rankDepth: 14,
            timeMs: 4600,
            extensions: 10,
            noise: 0,
            blunderChance: 0,
            blunderPool: 1,
            minThinkMs: 920,
        },
    },
    {
        id: 'axioma',
        callsign: 'AXIOMA',
        rating: 3650,
        blurb: 'La partida ya estaba resuelta antes de que movieras.',
        icon: InfinityIcon,
        config: {
            maxDepth: 24,
            rankDepth: 15,
            timeMs: 5000,
            extensions: 11,
            noise: 0,
            blunderChance: 0,
            blunderPool: 1,
            minThinkMs: 960,
        },
    },
    {
        id: 'abismo',
        callsign: 'ABISMO',
        rating: 3900,
        blurb: 'El borde del tablero se abre. Cada jugada tuya cae más profundo.',
        icon: Layers,
        config: {
            maxDepth: 26,
            rankDepth: 16,
            timeMs: 5200,
            extensions: 12,
            noise: 0,
            blunderChance: 0,
            blunderPool: 1,
            minThinkMs: 1000,
        },
    },
    {
        id: 'nexo',
        callsign: 'NEXO',
        rating: 4200,
        blurb: 'Conecta tus piezas con las suyas. Cuando lo entendés, ya es tarde.',
        icon: Aperture,
        config: {
            maxDepth: 30,
            rankDepth: 17,
            timeMs: 6400,
            extensions: 13,
            noise: 0,
            blunderChance: 0,
            blunderPool: 1,
            minThinkMs: 1100,
        },
    },
    {
        id: 'singularidad',
        callsign: 'SINGULARIDAD',
        rating: 4600,
        blurb: 'Todo el informe colapsa en un punto. No hay jugada que no haya visto.',
        icon: Sigma,
        config: {
            maxDepth: 34,
            rankDepth: 18,
            timeMs: 7600,
            extensions: 14,
            noise: 0,
            blunderChance: 0,
            blunderPool: 1,
            minThinkMs: 1200,
        },
    },
];

export const profileById = (id: string): AiProfile =>
    AI_PROFILES.find((profile) => profile.id === id) ?? AI_PROFILES[0];
