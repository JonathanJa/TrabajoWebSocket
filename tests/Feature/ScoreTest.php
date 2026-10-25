<?php

use App\Models\Player;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('guarda un resultado y actualiza el acumulado del jugador', function () {
    $response = $this->postJson(route('damas.resultados'), [
        'name' => 'ana',
        'mode' => 'remote',
        'result' => 'win',
        'variant' => 'spanish',
        'opponent' => 'luis',
        'detail' => 'Duelo por red',
    ]);

    $response
        ->assertCreated()
        ->assertJsonPath('ok', true)
        ->assertJsonPath('points', 100)
        ->assertJsonPath('player.name', 'ANA')
        ->assertJsonPath('player.points', 100)
        ->assertJsonPath('player.wins', 1)
        ->assertJsonPath('player.games', 1);

    $this->assertDatabaseHas('players', [
        'name' => 'ANA',
        'points' => 100,
        'wins' => 1,
        'losses' => 0,
        'draws' => 0,
        'games' => 1,
    ]);

    $this->assertDatabaseHas('game_results', [
        'name' => 'ANA',
        'mode' => 'remote',
        'variant' => 'spanish',
        'result' => 'win',
        'points' => 100,
        'opponent' => 'LUIS',
        'detail' => 'Duelo por red',
    ]);
});

test('acumula partidas y normaliza el nombre', function () {
    $this->postJson(route('damas.resultados'), [
        'name' => '  ana  ',
        'mode' => 'ai',
        'result' => 'win',
    ])->assertCreated();

    $this->postJson(route('damas.resultados'), [
        'name' => 'Ana',
        'mode' => 'ai',
        'result' => 'loss',
    ])->assertCreated();

    $this->postJson(route('damas.resultados'), [
        'name' => 'ANA',
        'mode' => 'ai',
        'result' => 'draw',
    ])->assertCreated();

    $player = Player::query()->where('name', 'ANA')->firstOrFail();

    expect($player->points)->toBe(60 + 10 + 20)
        ->and($player->wins)->toBe(1)
        ->and($player->losses)->toBe(1)
        ->and($player->draws)->toBe(1)
        ->and($player->games)->toBe(3);

    expect($player->last_played_at)->not->toBeNull();
});

test('rechaza nombres y modalidades inválidas', function () {
    $this->postJson(route('damas.resultados'), [
        'name' => '!!',
        'mode' => 'remote',
        'result' => 'win',
    ])->assertUnprocessable();

    $this->postJson(route('damas.resultados'), [
        'name' => 'ANA',
        'mode' => 'arcade',
        'result' => 'win',
    ])->assertUnprocessable();

    $this->postJson(route('damas.resultados'), [
        'name' => 'ANA',
        'mode' => 'remote',
        'result' => 'victoria',
    ])->assertUnprocessable();

    expect(Player::query()->count())->toBe(0);
});

test('aplica los puntos de damas chinas y del duelo local', function () {
    $this->postJson(route('damas.resultados'), [
        'name' => 'CLARA',
        'mode' => 'chinese',
        'result' => 'win',
        'detail' => 'Damas chinas',
    ])->assertCreated()->assertJsonPath('points', 80);

    $this->postJson(route('damas.resultados'), [
        'name' => 'OSCAR',
        'mode' => 'chinese',
        'result' => 'loss',
        'detail' => 'Damas chinas',
    ])->assertCreated()->assertJsonPath('points', 15);

    $this->postJson(route('damas.resultados'), [
        'name' => 'LOCAL UNO',
        'mode' => 'local',
        'result' => 'draw',
        'detail' => 'Duelo local',
    ])->assertCreated()->assertJsonPath('points', 20);
});

test('devuelve el ranking ordenado por puntos y victorias', function () {
    Player::query()->create([
        'name' => 'ANA',
        'points' => 120,
        'wins' => 2,
        'games' => 3,
    ]);
    Player::query()->create([
        'name' => 'LUIS',
        'points' => 200,
        'wins' => 2,
        'games' => 2,
    ]);
    Player::query()->create([
        'name' => 'EVA',
        'points' => 120,
        'wins' => 3,
        'games' => 4,
    ]);

    $this->getJson(route('damas.ranking'))
        ->assertOk()
        ->assertJsonPath('players.0.name', 'LUIS')
        ->assertJsonPath('players.1.name', 'EVA')
        ->assertJsonPath('players.2.name', 'ANA')
        ->assertJsonCount(3, 'players');
});
