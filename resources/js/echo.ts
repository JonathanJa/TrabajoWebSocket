import { configureEcho } from '@laravel/echo-react';

// Detrás de un túnel la página se sirve por HTTPS, así que conectamos el
// WebSocket contra el MISMO host que la página (el proxy reenvía /app/* a
// Reverb). Así funciona con cualquier dominio de túnel, sin recompilar.
// En local (HTTP) se conecta directo al servidor Reverb de VITE_REVERB_*.
const pageIsSecure =
    typeof window !== 'undefined' && window.location.protocol === 'https:';

const host = pageIsSecure
    ? window.location.hostname
    : import.meta.env.VITE_REVERB_HOST;
const port = pageIsSecure
    ? 443
    : Number(import.meta.env.VITE_REVERB_PORT ?? 8080);

configureEcho({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS: pageIsSecure,
    enabledTransports: ['ws', 'wss'],
});
