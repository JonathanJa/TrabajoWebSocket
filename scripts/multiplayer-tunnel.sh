#!/usr/bin/env bash
#
# Levanta el proxy de multijugador y un túnel de Cloudflare que expone la web
# y el WebSocket de Reverb en la misma URL.
#
# Uso:
#   bash scripts/multiplayer-tunnel.sh
#
# Antes de ejecutarlo, ten levantados:
#   - La app Laravel (por ejemplo Herd Lite en http://127.0.0.1:8001)
#   - Reverb:  php artisan reverb:start
#
# Copia la URL https://....trycloudflare.com que imprima cloudflared y
# compártela: ambos jugadores abren <URL>/damas.
set -euo pipefail

cd "$(dirname "$0")/.."

node scripts/reverb-proxy.mjs &
PROXY_PID=$!

cleanup() {
    kill "$PROXY_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "[multiplayer-tunnel] proxy PID $PROXY_PID; iniciando túnel..."
cloudflared tunnel --url http://localhost:8100
