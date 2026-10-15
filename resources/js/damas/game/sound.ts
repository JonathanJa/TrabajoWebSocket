/**
 * Audio sintetizado con WebAudio: sin archivos, sin descargas.
 * Estilo consola retro (ondas cuadradas y barridos cortos).
 */
export type SoundName =
    | 'select'
    | 'move'
    | 'capture'
    | 'crown'
    | 'invalid'
    | 'win'
    | 'lose'
    | 'transmit';

const MUTE_KEY = 'senal.damas.silencio.v1';

const RECIPES: Record<SoundName, number[]> = {
    select: [520, 620],
    move: [330, 392],
    capture: [700, 420, 240],
    crown: [523, 659, 784, 1046],
    invalid: [180, 140],
    win: [523, 659, 784, 1046, 1318],
    lose: [392, 330, 262, 196],
    transmit: [880, 1174, 880],
};

const DURATIONS: Record<SoundName, number> = {
    select: 0.05,
    move: 0.08,
    capture: 0.13,
    crown: 0.1,
    invalid: 0.12,
    win: 0.14,
    lose: 0.16,
    transmit: 0.06,
};

const GAINS: Record<SoundName, number> = {
    select: 0.05,
    move: 0.07,
    capture: 0.09,
    crown: 0.08,
    invalid: 0.07,
    win: 0.09,
    lose: 0.09,
    transmit: 0.05,
};

let audio: AudioContext | null = null;
let muted = false;

const readMuted = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        return window.localStorage.getItem(MUTE_KEY) === '1';
    } catch {
        return false;
    }
};

muted = readMuted();

const context = (): AudioContext | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    if (audio === null) {
        const Ctor =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;

        if (Ctor === undefined) {
            return null;
        }

        audio = new Ctor();
    }

    if (audio.state === 'suspended') {
        void audio.resume();
    }

    return audio;
};

const beep = (
    ctx: AudioContext,
    frequency: number,
    start: number,
    duration: number,
    gain: number,
): void => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(frequency, start);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(gain, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(env).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
};

export const playSound = (name: SoundName): void => {
    if (muted) {
        return;
    }

    const ctx = context();

    if (ctx === null) {
        return;
    }

    const notes = RECIPES[name];
    const duration = DURATIONS[name];
    const gain = GAINS[name];
    const base = ctx.currentTime + 0.01;

    notes.forEach((frequency, index) => {
        beep(ctx, frequency, base + index * duration * 0.85, duration, gain);
    });
};

export const isMuted = (): boolean => muted;

export const setMuted = (value: boolean): void => {
    muted = value;

    try {
        window.localStorage.setItem(MUTE_KEY, value ? '1' : '0');
    } catch {
        /* sin persistencia disponible */
    }
};
