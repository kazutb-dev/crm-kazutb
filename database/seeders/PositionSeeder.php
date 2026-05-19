<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PositionSeeder extends Seeder
{
    public function run(): void
    {
        $positions = [
            'Декан',
            'Зав. кафедрой',
            'Ассоциированный профессор',
            'И.о. ассоциированного профессора',
            'Профессор',
            'Профессор-исследователь',
            'И.о. профессора',
            'Сеньор-лектор',
            'Ассистент профессора',
            'Лектор',
            'Ассистент',
        ];

        foreach ($positions as $name) {
            DB::table('positions')->updateOrInsert(
                ['name' => $name, 'division_id' => null],
                ['name' => $name, 'division_id' => null, 'updated_at' => now(), 'created_at' => now()]
            );
        }
    }
}
