#!/usr/bin/env node
/**
 * Proxy local para jugar multijugador a través de un único túnel (Cloudflare).
 *
 * Escucha en un solo puerto y enruta:
 *   - /app/*  (WebSocket de Reverb) -> REVERB (por defecto 127.0.0.1:8080)
 *   - todo lo demás (la web)        -> la app Laravel (por defecto 127.0.0.1:8001)
 *
 * Así el navegador conecta el WebSocket contra el MISMO host que la página,
 * de modo que el túnel (y su dominio cambiante) sirve ambos sin recompilar.
 *
 * Variables opcionales:
 *   MULTIPLAYER_PROXY_PORT  puerto de escucha del proxy      (8100)
 *   MULTIPLAYER_HTTP_PORT   puerto de la app Laravel          (8001)
 *   MULTIPLAYER_WS_PORT     puerto de Reverb                  (8080)
 */
import http from 'node:http';
import net from 'node:net';

const HOST = '127.0.0.1';
const LISTEN_PORT = Number(process.env.MULTIPLAYER_PROXY_PORT ?? 8100);
const HTTP_PORT = Number(process.env.MULTIPLAYER_HTTP_PORT ?? 8001);
const WS_PORT = Number(process.env.MULTIPLAYER_WS_PORT ?? 8080);

const isReverbPath = (url = '') => url.startsWith('/app');

const server = http.createServer((req, res) => {
    const upstream = http.request(
        {
            host: HOST,
            port: HTTP_PORT,
            method: req.method,
            path: req.url,
            headers: req.headers,
        },
        (response) => {
            res.writeHead(response.statusCode ?? 502, response.headers);
            response.pipe(res);
        },
    );

    upstream.on('error', (error) => {
        if (!res.headersSent) {
            res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
        }
        res.end(`Proxy error: ${error.message}`);
    });

    req.pipe(upstream);
});

// Las conexiones WebSocket empiezan con un "upgrade" HTTP que hay que
// reenviar en crudo al proceso correspondiente (Reverb o la app).
server.on('upgrade', (req, socket, head) => {
    const targetPort = isReverbPath(req.url) ? WS_PORT : HTTP_PORT;
    const upstream = net.connect(targetPort, HOST, () => {
        const headers = Object.entries(req.headers)
            .map(
                ([name, value]) =>
                    `${name}: ${Array.isArray(value) ? value.join(', ') : value}`,
            )
            .join('\r\n');

        upstream.write(
            `${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`,
        );

        if (head && head.length > 0) {
            upstream.write(head);
        }

        socket.pipe(upstream).pipe(socket);
    });

    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
});

server.listen(LISTEN_PORT, HOST, () => {
    console.log(
        `[multiplayer-proxy] escuchando en http://${HOST}:${LISTEN_PORT}`,
    );
    console.log(`  web      -> http://${HOST}:${HTTP_PORT}`);
    console.log(`  /app/*   -> ws://${HOST}:${WS_PORT} (Reverb)`);
});
