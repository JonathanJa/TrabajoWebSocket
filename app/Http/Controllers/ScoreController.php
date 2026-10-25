<?php

namespace App\Http\Controllers;

use App\Models\GameResult;
use App\Models\Player;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ScoreController extends Controller
{
    /**
     * Puntaje base por modalidad y resultado. El servidor decide los puntos:
     * el cliente solo informa qué pasó.
     *
     * @var array<string, array{win: int, draw: int, loss: int}>
     */
    private const POINTS = [
        'remote' => ['win' => 100, 'draw' => 40, 'loss' => 20],
        'campaign' => ['win' => 90, 'draw' => 30, 'loss' => 10],
        'chinese' => ['win' => 80, 'draw' => 30, 'loss' => 15],
        'ai' => ['win' => 60, 'draw' => 20, 'loss' => 10],
        'local' => ['win' => 50, 'draw' => 20, 'loss' => 10],
    ];

    /**
     * Guarda el resultado de una partida y actualiza el acumulado del jugador.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:18'],
            'mode' => ['required', 'string', Rule::in(array_keys(self::POINTS))],
            'result' => ['required', 'string', Rule::in(['win', 'loss', 'draw'])],
            'variant' => ['nullable', 'string', 'max:20'],
            'opponent' => ['nullable', 'string', 'max:18'],
            'detail' => ['nullable', 'string', 'max:120'],
        ]);

        $name = $this->cleanName($data['name']);
        $opponent = isset($data['opponent'])
            ? $this->cleanName($data['opponent'])
            : null;

        if (Str::length($name) < 2) {
            return response()->json([
                'message' => 'El nombre debe tener al menos 2 letras o números.',
            ], 422);
        }

        $points = self::POINTS[$data['mode']][$data['result']];

        $player = DB::transaction(function () use (
            $name,
            $opponent,
            $data,
            $points,
        ): Player {
            $player = Player::query()->firstOrCreate(['name' => $name]);

            $player->incrementEach(
                [
                    'points' => $points,
                    'wins' => $data['result'] === 'win' ? 1 : 0,
                    'losses' => $data['result'] === 'loss' ? 1 : 0,
                    'draws' => $data['result'] === 'draw' ? 1 : 0,
                    'games' => 1,
                ],
                ['last_played_at' => now()],
            );

            GameResult::query()->create([
                'name' => $name,
                'mode' => $data['mode'],
                'variant' => $data['variant'] ?? null,
                'result' => $data['result'],
                'points' => $points,
                'opponent' => $opponent === '' ? null : $opponent,
                'detail' => $data['detail'] ?? null,
            ]);

            return $player->refresh();
        });

        return response()->json([
            'ok' => true,
            'points' => $points,
            'player' => [
                'name' => $player->name,
                'points' => $player->points,
                'wins' => $player->wins,
                'losses' => $player->losses,
                'draws' => $player->draws,
                'games' => $player->games,
            ],
        ], 201);
    }

    /**
     * Ranking global: los mejores acumulados de la base de datos.
     */
    public function ranking(): JsonResponse
    {
        $players = Player::query()
            ->orderByDesc('points')
            ->orderByDesc('wins')
            ->orderBy('name')
            ->limit(50)
            ->get([
                'name',
                'points',
                'wins',
                'losses',
                'draws',
                'games',
                'last_played_at',
            ]);

        return response()->json([
            'players' => $players,
            'updated_at' => now()->toIso8601String(),
        ]);
    }

    private function cleanName(string $value): string
    {
        $clean = preg_replace('/[^\p{L}\p{N} ._-]/u', '', $value) ?? '';
        $clean = preg_replace('/\s+/u', ' ', $clean) ?? '';
        $clean = trim($clean);

        return Str::upper(Str::limit($clean, 18, ''));
    }
}
