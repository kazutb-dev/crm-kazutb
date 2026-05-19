<?php

namespace Database\Seeders;

use App\Models\Position;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PositionSeeder extends Seeder
{
    public function run(): void
    {
        $divisionIds = DB::table('divisions')->pluck('id');

        if ($divisionIds->isEmpty()) {
            $this->command?->warn('No divisions found; PositionSeeder skipped.');

            return;
        }

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

        foreach ($divisionIds as $divisionId) {
            foreach ($positions as $name) {
                Position::query()->firstOrCreate([
                    'name' => $name,
                    'division_id' => (int) $divisionId,
                ]);
            }
        }
    }
}
