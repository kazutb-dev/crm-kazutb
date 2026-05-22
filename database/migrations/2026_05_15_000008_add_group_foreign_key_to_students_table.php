<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('students') || !Schema::hasTable('groups') || !Schema::hasColumn('students', 'group_id')) {
            return;
        }

        $databaseName = DB::connection()->getDatabaseName();

        $groupIdColumn = DB::table('information_schema.COLUMNS')
            ->where('TABLE_SCHEMA', $databaseName)
            ->where('TABLE_NAME', 'students')
            ->where('COLUMN_NAME', 'group_id')
            ->first();

        if ($groupIdColumn && ($groupIdColumn->IS_NULLABLE ?? 'NO') === 'NO') {
            DB::statement('ALTER TABLE students MODIFY group_id BIGINT UNSIGNED NULL');
        }

        $foreignKeyExists = DB::table('information_schema.KEY_COLUMN_USAGE')
            ->where('TABLE_SCHEMA', $databaseName)
            ->where('TABLE_NAME', 'students')
            ->where('COLUMN_NAME', 'group_id')
            ->whereNotNull('REFERENCED_TABLE_NAME')
            ->exists();

        if ($foreignKeyExists) {
            return;
        }

        Schema::table('students', function (Blueprint $table): void {
            $table->foreign('group_id', 'students_group_id_foreign')
                ->references('id')
                ->on('groups')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('students') || !Schema::hasColumn('students', 'group_id')) {
            return;
        }

        $databaseName = DB::connection()->getDatabaseName();

        $foreignKeyExists = DB::table('information_schema.KEY_COLUMN_USAGE')
            ->where('TABLE_SCHEMA', $databaseName)
            ->where('TABLE_NAME', 'students')
            ->where('COLUMN_NAME', 'group_id')
            ->whereNotNull('REFERENCED_TABLE_NAME')
            ->exists();

        if (! $foreignKeyExists) {
            return;
        }

        Schema::table('students', function (Blueprint $table): void {
            $table->dropForeign('students_group_id_foreign');
        });
    }
};