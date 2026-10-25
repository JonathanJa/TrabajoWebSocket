export const PLAYER_NAME_MAX = 18;

/** Limpia un nombre para mostrarlo y enviarlo al ranking. */
export const cleanPlayerName = (value: string): string =>
    value
        .replace(/[^\p{L}\p{N} ._-]/gu, '')
        .replace(/\s+/g, ' ')
        .trimStart()
        .slice(0, PLAYER_NAME_MAX);
