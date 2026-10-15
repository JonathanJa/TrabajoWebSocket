<?php

use App\Events\DamasTransmission;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Tests\TestCase;

test('room transmissions are accepted and configured for immediate broadcast', function () {
    /** @var TestCase $testCase */
    $testCase = $this;

    $response = $testCase->post(
        route('damas.transmitir'),
        [
            'sala' => 'AB12CD',
            'tipo' => 'move',
            'emisor' => 'player-one',
            'payload' => ['move' => ['from' => 40, 'to' => 33]],
        ],
        ['Accept' => 'application/json'],
    );

    $response->assertOk()->assertJsonStructure(['ok', 'at']);

    expect(new DamasTransmission('AB12CD', 'move', 'player-one'))
        ->toBeInstanceOf(ShouldBroadcastNow::class);
});

test('a player can join a room with its invitation code', function () {
    /** @var TestCase $testCase */
    $testCase = $this;

    $testCase->post(
        route('damas.transmitir'),
        [
            'sala' => 'AB12CD',
            'tipo' => 'join',
            'emisor' => 'player-two',
            'payload' => ['side' => 'entidad'],
        ],
        ['Accept' => 'application/json'],
    )->assertOk()->assertJsonStructure(['ok', 'at']);
});

test('room transmissions reject invalid room codes', function () {
    /** @var TestCase $testCase */
    $testCase = $this;

    $testCase->post(
        route('damas.transmitir'),
        [
            'sala' => 'bad code',
            'tipo' => 'move',
            'emisor' => 'player-one',
            'payload' => [],
        ],
        ['Accept' => 'application/json'],
    )->assertUnprocessable()->assertJsonValidationErrors('sala');
});
