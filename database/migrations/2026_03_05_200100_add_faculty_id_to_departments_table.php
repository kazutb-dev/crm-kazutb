<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->foreignId('faculty_id')
                ->nullable()
                ->after('id')
                ->constrained('faculties')
                ->restrictOnDelete();
        });

        if (DB::table('departments')->whereNull('faculty_id')->exists()) {
            $defaultFacultyId = DB::table('faculties')->insertGetId([
                'name' => 'Общий факультет',
                'code' => 'GEN',
                'description' => 'Системный факультет для уже существующих кафедр.',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('departments')
                ->whereNull('faculty_id')
                ->update(['faculty_id' => $defaultFacultyId]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('faculty_id');
        });

        DB::table('faculties')
            ->where('code', 'GEN')
            ->where('name', 'Общий факультет')
            ->delete();
    }
};
