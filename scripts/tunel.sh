#!/usr/bin/env bash
# Levanta todo lo necesario para jugar por un túnel de Cloudflare:
#
#   navegador remoto -> cloudflared -> proxy :8100 -> Laravel :8000
#                                                  \-> Reverb :8080 (/app, WebSocket)
#
# El túnel NUNCA va directo a Reverb ni a Laravel: siempre al proxy.
#
# Uso:  bash scripts/tunel.sh
#       APP_PORT=8000 WS_PORT=8080 PROXY_PORT=8100 bash scripts/tunel.sh
set -euo pipefail

cd "$(dirname "$0")/.."

APP_PORT="${APP_PORT:-8000}"
WS_PORT="${WS_PORT:-8080}"
PROXY_PORT="${PROXY_PORT:-8100}"
LOG_DIR="${TMPDIR:-/tmp}/opencode"

mkdir -p "$LOG_DIR"

port_open() {
    (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1
}

# 1. El túnel sirve los archivos compilados. public/hot apunta a
#    127.0.0.1:5173 (el Vite local) y un jugador remoto no puede cargarlo.
if [ -f public/hot ]; then
    rm -f public/hot
    echo "· public/hot eliminado: el túnel usará la build."
fi

if [ ! -f public/build/manifest.json ]; then
    echo "✗ Falta la build. Ejecutá antes: npm run build"
    exit 1
fi

# 2. Aplicación Laravel.
if port_open "$APP_PORT"; then
    echo "· Laravel ya escucha en :$APP_PORT"
else
    nohup php artisan serve --host=127.0.0.1 --port="$APP_PORT" \
        >"$LOG_DIR/damas-app.log" 2>&1 &
    echo "· Laravel arrancando en :$APP_PORT"
    sleep 2
fi

# 3. Reverb (WebSocket del multijugador).
if port_open "$WS_PORT"; then
    echo "· Reverb ya escucha en :$WS_PORT"
else
    nohup php artisan reverb:start --host=0.0.0.0 --port="$WS_PORT" \
        >"$LOG_DIR/damas-reverb.log" 2>&1 &
    echo "· Reverb arrancando en :$WS_PORT"
    sleep 2
fi

# 4. Proxy: un único puerto para la web y el WebSocket.
pkill -f "scripts/reverb-proxy.mjs" >/dev/null 2>&1 || true
MULTIPLAYER_HTTP_PORT="$APP_PORT" \
MULTIPLAYER_WS_PORT="$WS_PORT" \
MULTIPLAYER_PROXY_PORT="$PROXY_PORT" \
    nohup node scripts/reverb-proxy.mjs >"$LOG_DIR/damas-proxy.log" 2>&1 &
echo "· Proxy arrancando en :$PROXY_PORT"
sleep 1

# 5. Túnel de Cloudflare hacia el proxy.
pkill -f "cloudflared tunnel --url http://127.0.0.1:$PROXY_PORT" \
    >/dev/null 2>&1 || true
: >"$LOG_DIR/damas-tunnel.log"
nohup cloudflared tunnel --url "http://127.0.0.1:$PROXY_PORT" \
    --no-autoupdate >"$LOG_DIR/damas-tunnel.log" 2>&1 &

URL=""
for _ in $(seq 1 40); do
    URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' \
        "$LOG_DIR/damas-tunnel.log" | head -1 || true)
    [ -n "$URL" ] && break
    sleep 1
done

echo
if [ -n "$URL" ]; then
    echo "✔ Túnel listo: $URL/damas"
    echo "  Compartí esa URL con el otro jugador."
else
    echo "✗ No se pudo obtener la URL. Revisá: $LOG_DIR/damas-tunnel.log"
    exit 1
fi
echo
echo "Logs: $LOG_DIR/damas-{app,reverb,proxy,tunnel}.log"
echo "Para cortar el túnel: pkill -f 'cloudflared tunnel --url http://127.0.0.1:$PROXY_PORT'"
