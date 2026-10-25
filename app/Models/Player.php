<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Player extends Model
{
    protected $fillable = [
        'name',
        'points',
        'wins',
        'losses',
        'draws',
        'games',
        'last_played_at',
    ];

    protected function casts(): array
    {
        return [
            'points' => 'integer',
            'wins' => 'integer',
            'losses' => 'integer',
            'draws' => 'integer',
            'games' => 'integer',
            'last_played_at' => 'datetime',
        ];
    }
}
