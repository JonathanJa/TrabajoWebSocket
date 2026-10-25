<?php

use App\Http\Controllers\DamasController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\RemoteStyleController;
use App\Http\Controllers\ScoreController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect('/damas'))->name('home');

Route::get('/{current_team?}/dashboard', DashboardController::class)
    ->middleware(['auth', 'verified'])
    ->name('dashboard');

// Demo websocket original (emisor / receptor)
Route::get('/emisor', [RemoteStyleController::class, 'emisor'])->name('emisor');
Route::post('/emitir', [RemoteStyleController::class, 'emitir'])->name('emitir');
Route::get('/receptor', [RemoteStyleController::class, 'receptor'])->name('receptor');

// Juego de damas (single player + multiplayer por websocket)
Route::get('/damas', [DamasController::class, 'index'])->name('damas');
Route::post('/damas/transmitir', [DamasController::class, 'transmitir'])->name('damas.transmitir');

// Ranking global de participantes (base de datos).
Route::post('/damas/resultados', [ScoreController::class, 'store'])
    ->middleware('throttle:60,1')
    ->name('damas.resultados');
Route::get('/damas/ranking', [ScoreController::class, 'ranking'])
    ->name('damas.ranking');
