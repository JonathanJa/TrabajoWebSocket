<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <title>Receptor</title>
    @vite(['resources/css/app.css', 'resources/js/receptor.ts'])
    <style>
        body {
            font-family: system-ui, sans-serif;
            padding: 24px;
        }

        .wrap {
            max-width: 760px;
            margin: 0 auto;
        }

        #target-div {
            padding: 20px;
            border: 1px dashed #bbb;
            border-radius: 12px;
        }
    </style>
</head>

<body>
    <div class="wrap">
        <h1>Receptor</h1>
        <div id="target-div">Esperando mensaje...</div>
    </div>
</body>

</html>
