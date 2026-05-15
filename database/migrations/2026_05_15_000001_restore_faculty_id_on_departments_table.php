<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('departments', 'faculty_id')) {
            Schema::table('departments', function (Blueprint $table): void {
                $table->foreignId('faculty_id')
                    ->nullable()
                    ->after('id')
                    ->constrained('faculties')
                    ->restrictOnDelete();
            });
        }

        $facultyIds = DB::table('faculties')
            ->select('id', 'code')
            ->pluck('id', 'code');

        $mapping = [
            'TST' => 'TF',
            'TLPD' => 'TF',
            'SHD' => 'TF',
            'TS' => 'FEB',
            'EU' => 'FEB',
            'FA' => 'FEB',
            'GIY' => 'FEB',
            'IT' => 'FEIT',
            'KIA' => 'FEIT',
            'HHTE' => 'FEIT',
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
        if (Schema::hasColumn('departments', 'faculty_id')) {
            Schema::table('departments', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('faculty_id');
            });
        }
    }
};