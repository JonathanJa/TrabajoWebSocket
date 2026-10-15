import type { LucideIcon } from 'lucide-react';
import {
    Copy,
    Crosshair,
    Eye,
    Gem,
    Radar,
    Shield,
    Tornado,
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
            timeMs: 560,
            extensions: 5,
            noise: 52,
            blunderChance: 0.32,
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
            maxDepth: 4,
            rankDepth: 3,
            timeMs: 850,
            extensions: 5,
            noise: 34,
            blunderChance: 0.2,
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
            maxDepth: 5,
            rankDepth: 4,
            timeMs: 1150,
            extensions: 6,
            noise: 18,
            blunderChance: 0.12,
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
            timeMs: 1600,
            extensions: 6,
            noise: 10,
            blunderChance: 0.05,
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
            maxDepth: 9,
            rankDepth: 7,
            timeMs: 2200,
            extensions: 7,
            noise: 4,
            blunderChance: 0.015,
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
            maxDepth: 14,
            rankDepth: 9,
            timeMs: 3000,
            extensions: 8,
            noise: 0,
            blunderChance: 0,
            blunderPool: 1,
            minThinkMs: 700,
        },
    },
];

export const profileById = (id: string): AiProfile =>
    AI_PROFILES.find((profile) => profile.id === id) ?? AI_PROFILES[0];
