import { AI_PROFILES, type AiProfile } from '../ai/profiles';

export interface CaseFile {
    /** Coincide con el id del perfil de IA que lo controla. */
    id: string;
    code: string;
    callsign: string;
    /** Coordenadas del contacto, estilo informe de campo. */
    coordinates: string;
    place: string;
    brief: string;
    /** Rango que se desbloquea al cerrar el caso. */
    reward: string;
    profile: AiProfile;
}

interface CaseSeed {
    id: string;
    code: string;
    coordinates: string;
    place: string;
    brief: string;
    reward: string;
}

const SEEDS: readonly CaseSeed[] = [
    {
        id: 'parpadeo',
        code: 'CASO 001',
        coordinates: '31°24′S 64°11′W',
        place: 'RUTA 40 · KM 12',
        brief: 'Tres destellos sobre el arcén y ningún registro en el radar. La señal no mantiene posición.',
        reward: 'PASANTE DE CAMPO',
    },
    {
        id: 'rastro',
        code: 'CASO 002',
        coordinates: '32°07′S 64°42′W',
        place: 'SALAR DE AMBATO',
        brief: 'Huellas de cuarenta centímetros que terminan en la nada. Algo aprendió a caminar el salar.',
        reward: 'OPERADOR DE RASTREO',
    },
    {
        id: 'alambre',
        code: 'CASO 003',
        coordinates: '29°58′S 63°55′W',
        place: 'TENDIDO NORTE · TORRE 6',
        brief: 'Zumbido metálico pegado al tendido. Corta el aire antes de moverse.',
        reward: 'TÉCNICO DE INTERFERENCIA',
    },
    {
        id: 'cuarzo',
        code: 'CASO 004',
        coordinates: '33°15′S 66°08′W',
        place: 'CANTERA DE CUARZO',
        brief: 'Refracta la luz y reaparece donde no la buscás. Material de contacto: desconocido.',
        reward: 'ANALISTA DE MATERIALES',
    },
    {
        id: 'espejo',
        code: 'CASO 005',
        coordinates: '34°02′S 65°30′W',
        place: 'LAGUNA SECA',
        brief: 'Copia cada movimiento antes de castigarlo. Está midiendo al operador.',
        reward: 'ESPECIALISTA EN CONDUCTA',
    },
    {
        id: 'vortice',
        code: 'CASO 006',
        coordinates: '27°45′S 64°20′W',
        place: 'CAMPO MAGNÉTICO 7',
        brief: 'Gira sobre el campo y aspira todo lo que se descuide. Seis bajas en el último informe.',
        reward: 'INVESTIGADOR DE CAMPO',
    },
    {
        id: 'oraculo',
        code: 'CASO 007',
        coordinates: '25°10′S 62°50′W',
        place: 'OBSERVATORIO INCA',
        brief: 'Resolvió esta partida antes de que la jugaras. Solo queda no equivocarse.',
        reward: 'CUSTODIO DEL ARCHIVO',
    },
    {
        id: 'centinela',
        code: 'CASO 008',
        coordinates: '36°00′S 68°00′W',
        place: 'BASE SUR · SECTOR CERO',
        brief: 'No parpadea. No concede. El último contacto antes de cerrar el informe.',
        reward: 'ARCHIVO CERO DESCLASIFICADO',
    },
];

const profileFor = (id: string): AiProfile => {
    const profile = AI_PROFILES.find((candidate) => candidate.id === id);

    if (profile === undefined) {
        throw new Error(`Perfil de IA desconocido: ${id}`);
    }

    return profile;
};

export const CASES: readonly CaseFile[] = SEEDS.map((seed) => ({
    ...seed,
    callsign: profileFor(seed.id).callsign,
    profile: profileFor(seed.id),
}));

export const caseById = (id: string): CaseFile | undefined =>
    CASES.find((caseFile) => caseFile.id === id);

export const caseIndex = (id: string): number =>
    CASES.findIndex((caseFile) => caseFile.id === id);
