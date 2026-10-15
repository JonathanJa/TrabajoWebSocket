<?php

namespace App\Http\Controllers;

use App\Events\DamasTransmission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DamasController extends Controller
{
    /**
     * Tipos de transmision que acepta una mesa de damas.
     *
     * @var array<int, string>
     */
    private const TIPOS = [
        'join',
        'welcome',
        'leave',
        'hello',
        'sync',
        'sync-request',
        'move',
        'resign',
        'rematch',
        'rematch-accept',
        'chat',
        'ping',
    ];

    public function index()
    {
        return view('damas');
    }

    /**
     * Retransmite un mensaje de la mesa a todos los clientes suscritos.
     * El servidor no guarda estado: cada cliente valida contra su propio tablero.
     */
    public function transmitir(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sala' => ['required', 'string', 'regex:/^[A-Z0-9]{3,8}$/'],
            'tipo' => ['required', 'string', 'in:'.implode(',', self::TIPOS)],
            'emisor' => ['required', 'string', 'max:40'],
            'payload' => ['nullable', 'array'],
        ]);

        $payload = $data['payload'] ?? [];
        $encoded = json_encode($payload, JSON_THROW_ON_ERROR);

        abort_if(strlen($encoded) > 6000, 422, 'Payload demasiado grande.');

        broadcast(new DamasTransmission(
            $data['sala'],
            $data['tipo'],
            $data['emisor'],
            $payload,
        ));

        return response()->json(['ok' => true, 'at' => now()->getTimestampMs()]);
    }
}
