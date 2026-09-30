<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * @var array<string, string>
     */
    private const RENAMES = [
        'ОТДЕЛ РЕЙТИНГА И АККРЕДИТАЦИИ' => 'отдел аккредитации и рейтингов',
        'УПРАВЛЕНИЕ ОБЕСПЕЧЕНИЯ КАЧЕСТВА И АККРЕДИТАЦИИ' => 'Департамент стратегического развития',
        'ОТДЕЛ МЕНЕДЖМЕНТА КАЧЕСТВА ОБРАЗОВАНИЯ' => 'Отдел системы менеджмента качества',
    ];

    public function up(): void
    {
        $this->rename(self::RENAMES);
    }

    public function down(): void
    {
        $this->rename(array_flip(self::RENAMES));
    }

    /**
     * @param  array<string, string>  $renames
     */
    private function rename(array $renames): void
    {
        DB::transaction(function () use ($renames): void {
            $sources = DB::table('phonebook_departments')
                ->whereIn('name', array_keys($renames))
                ->lockForUpdate()
                ->get(['id', 'name']);

            if ($sources->count() !== count($renames)) {
                throw new RuntimeException('Expected phonebook departments for rename were not found exactly once.');
            }

            $targetExists = DB::table('phonebook_departments')
                ->whereIn('name', array_values($renames))
                ->exists();

            if ($targetExists) {
                throw new RuntimeException('A target phonebook department name already exists.');
            }

            foreach ($sources as $department) {
                $updated = DB::table('phonebook_departments')
                    ->where('id', $department->id)
                    ->where('name', $department->name)
                    ->update([
                        'name' => $renames[$department->name],
                        'updated_at' => now(),
                    ]);

                if ($updated !== 1) {
                    throw new RuntimeException('Phonebook department rename did not update exactly one row.');
                }
            }
        });
    }
};
