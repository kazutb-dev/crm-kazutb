<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kpi_structural_units', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 50)->unique();
            $table->string('name')->unique();
            $table->timestamps();
        });

        DB::table('kpi_structural_units')->insert([
            ['code' => 'ОМОиАМ', 'name' => 'Отдел международного образования и академической мобильности (ОМОиАМ)', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'ОРиА', 'name' => 'Отдел рейтингов и аккредитации (ОРиА)', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'УМиФК', 'name' => 'Управление маркетинга и формирование контингента', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'УОП', 'name' => 'Управление образовательных программ', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'УНиВС', 'name' => 'Управление науки и внешних связей (УНиВС)', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'ЦК', 'name' => 'Центр компетенции', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'ЦКАР', 'name' => 'Центр карьеры', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'ОУП', 'name' => 'Отдел управления персоналом', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'ОР', 'name' => 'Офис регистратора', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'УОКиА', 'name' => 'Управление обеспечения качества и аккредитации', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'ВиСР', 'name' => 'Воспитательная и социальная работа', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'ЭФ', 'name' => 'Эндаумент фонд', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('kpi_structural_units');
    }
};