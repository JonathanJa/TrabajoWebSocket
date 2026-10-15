<!DOCTYPE html>
<html lang="es" data-theme="ufo-sighting" style="--tp-h: 110">

<head>
    <meta charset="utf-8">
    <meta name="viewport"
        content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#050b08">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>SEÑAL — Damas del Desierto</title>

    <link rel="icon" href="/favicon.svg" type="image/svg+xml">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Rubik+Mono+One&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap">

    {{-- Fondo del shell antes de que cargue el tema (evita el flash blanco). --}}
    <style>
        html {
            background-color: #050b08;
        }
    </style>

    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/damas.tsx'])
</head>

<body class="d-shell">
    <div id="damas-root"></div>
</body>

</html>
