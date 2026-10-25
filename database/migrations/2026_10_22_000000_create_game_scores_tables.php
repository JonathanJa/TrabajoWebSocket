<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Jugadores y resultados para el ranking global.
     */
    public function up(): void
    {
        Schema::create('players', function (Blueprint $table) {
            $table->id();
            $table->string('name', 18)->unique();
            $table->unsignedInteger('points')->default(0);
            $table->unsignedInteger('wins')->default(0);
            $table->unsignedInteger('losses')->default(0);
            $table->unsignedInteger('draws')->default(0);
            $table->unsignedInteger('games')->default(0);
            $table->timestamp('last_played_at')->nullable();
            $table->timestamps();
        });

        Schema::create('game_results', function (Blueprint $table) {
            $table->id();
            $table->string('name', 18)->index();
            $table->string('mode', 20);
            $table->string('variant', 20)->nullable();
            $table->string('result', 8);
            $table->unsignedSmallInteger('points')->default(0);
            $table->string('opponent', 18)->nullable();
            $table->string('detail', 120)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_results');
        Schema::dropIfExists('players');
    }
};
