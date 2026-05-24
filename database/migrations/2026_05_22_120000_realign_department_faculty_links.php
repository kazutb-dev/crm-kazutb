<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('departments', 'faculty_id')) {
            return;
        }

        $facultyIds = DB::table('faculties')
            ->select('id', 'code')
            ->pluck('id', 'code');

        $mapping = [
            'TST' => 'TF',
            'TLPD' => 'TF',
            'KIA' => 'TF',
            'PE' => 'TF',
            'TS' => 'FEB',
            'EU' => 'FEB',
            'FA' => 'FEB',
            'GIY' => 'FEB',
            'IT' => 'FEIT',
            'HHTE' => 'FEIT',
            'SHD' => 'FEIT',
        ];

        foreach ($mapping as $departmentCode => $facultyCode) {
            $facultyId = $facultyIds[$facultyCode] ?? null;
            if ($facultyId === null) {
                continue;
            }

            DB::table('departments')
                ->where('code', $departmentCode)
                ->update(['faculty_id' => $facultyId]);
        }
    }

    public function down(): void
    {
        // No-op: data realignment migration should not try to restore stale mappings.
    }
};
