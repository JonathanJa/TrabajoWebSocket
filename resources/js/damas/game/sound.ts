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
    | 'transmit'
    | 'applause';

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
    // 'applause' se sintetiza aparte (ruido), no usa estas recetas.
    applause: [],
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
    applause: 0,
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
    applause: 0,
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

/**
 * Aplauso sintetizado: una ráfaga densa de "palmadas" de ruido con un
 * filtro de banda y una caída suave, para celebrar el final de una partida.
 */
const applause = (ctx: AudioContext): void => {
    const start = ctx.currentTime + 0.02;
    const total = 1.9;
    const claps = 80;

    for (let index = 0; index < claps; index += 1) {
        const at = start + Math.random() * total;
        const length = 0.02 + Math.random() * 0.035;
        const frames = Math.max(1, Math.floor(ctx.sampleRate * length));
        const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
        const samples = buffer.getChannelData(0);

        for (let sample = 0; sample < frames; sample += 1) {
            samples[sample] =
                (Math.random() * 2 - 1) * Math.exp(-sample / (frames * 0.35));
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1000 + Math.random() * 2200;
        filter.Q.value = 0.8;

        const gain = ctx.createGain();
        gain.gain.value = 0.05 + Math.random() * 0.07;

        source.connect(filter).connect(gain).connect(ctx.destination);
        source.start(at);
    }
};

export const playSound = (name: SoundName): void => {
    if (muted) {
        return;
    }

    const ctx = context();

    if (ctx === null) {
        return;
    }

    if (name === 'applause') {
        applause(ctx);

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
