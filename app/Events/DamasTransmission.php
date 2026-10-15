<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Transmision de una mesa de damas (multiplayer en tiempo real).
 *
 * Igual que RemoteStyleUpdate: canal PUBLICO por sala, sin auth,
 * para que dos pestanas/dispositivos compartan la misma partida.
 */
class DamasTransmission implements ShouldBroadcastNow
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public string $sala,
        public string $tipo,
        public string $emisor,
        public array $payload = [],
    ) {}

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [new Channel('damas.'.$this->sala)];
    }

    public function broadcastAs(): string
    {
        return 'DamasTransmission';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'sala' => $this->sala,
            'tipo' => $this->tipo,
            'emisor' => $this->emisor,
            'payload' => $this->payload,
            'at' => now()->getTimestampMs(),
        ];
    }
}
