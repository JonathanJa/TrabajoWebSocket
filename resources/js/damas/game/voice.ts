const VOICE_KEY = 'senal.damas.voz.v1';

export const isVoiceEnabled = (): boolean => {
    if (typeof window === 'undefined') {
        return true;
    }

    try {
        return window.localStorage.getItem(VOICE_KEY) !== '0';
    } catch {
        return true;
    }
};

export const setVoiceEnabled = (enabled: boolean): void => {
    try {
        window.localStorage.setItem(VOICE_KEY, enabled ? '1' : '0');
    } catch {
        return;
    }

    if (!enabled && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
};

export const speakText = (text: string): void => {
    if (
        typeof window === 'undefined' ||
        !('speechSynthesis' in window) ||
        typeof SpeechSynthesisUtterance === 'undefined'
    ) {
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = window.speechSynthesis
        .getVoices()
        .find((candidate) => candidate.lang.toLowerCase().startsWith('es'));

    if (voice !== undefined) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
    } else {
        utterance.lang = 'es-ES';
    }

    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.volume = 0.82;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
};

export const announceHumanTurn = (opponent: string): void =>
    speakText(`Es tu turno. ${opponent} espera tu movimiento.`);
