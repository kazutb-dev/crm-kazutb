<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::table('departments')->upsert([
            [
                'name' => 'Центр информационных технологий',
                'code' => 'CIT',
                'description' => 'Технические вопросы: оборудование, сеть, рабочие места.',
                'faculty_id' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Центр ИИ и аналитика данных',
                'code' => 'AI_ANALYTICS',
                'description' => 'Разработка и сопровождение цифровых сервисов, баги и доработки.',
                'faculty_id' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ], ['code'], ['name', 'description', 'updated_at']);
    }

    public function down(): void
    {
        DB::table('departments')
            ->whereIn('code', ['CIT', 'AI_ANALYTICS'])
            ->delete();
    }
};
