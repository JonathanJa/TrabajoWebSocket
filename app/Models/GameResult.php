<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GameResult extends Model
{
    protected $fillable = [
        'name',
        'mode',
        'variant',
        'result',
        'points',
        'opponent',
        'detail',
    ];

    protected function casts(): array
    {
        return [
            'points' => 'integer',
        ];
    }
}
