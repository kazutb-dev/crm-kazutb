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
        Schema::table('positions', function (Blueprint $table) {
            if (Schema::hasColumn('positions', 'department_id')) {
                $fk = DB::table('information_schema.KEY_COLUMN_USAGE')
                    ->where('TABLE_SCHEMA', DB::getDatabaseName())
                    ->where('TABLE_NAME', 'positions')
                    ->where('COLUMN_NAME', 'department_id')
                    ->whereNotNull('REFERENCED_TABLE_NAME')
                    ->value('CONSTRAINT_NAME');

                if (is_string($fk) && $fk !== '') {
                    DB::statement("ALTER TABLE `positions` DROP FOREIGN KEY `{$fk}`");
                }

                $indexes = DB::table('information_schema.STATISTICS')
                    ->where('TABLE_SCHEMA', DB::getDatabaseName())
                    ->where('TABLE_NAME', 'positions')
                    ->where('COLUMN_NAME', 'department_id')
                    ->pluck('INDEX_NAME')
                    ->filter(fn ($name) => is_string($name) && $name !== 'PRIMARY')
                    ->unique()
                    ->values();

                foreach ($indexes as $indexName) {
                    DB::statement("ALTER TABLE `positions` DROP INDEX `{$indexName}`");
                }

                $table->dropColumn('department_id');
            }

            if (! Schema::hasColumn('positions', 'division_id')) {
                $table->foreignId('division_id')->after('id')->constrained('divisions')->restrictOnDelete();
            }

            $table->unique(['division_id', 'name']);
            $table->unique(['division_id', 'code']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('positions', function (Blueprint $table) {
            if (Schema::hasColumn('positions', 'division_id')) {
                $fk = DB::table('information_schema.KEY_COLUMN_USAGE')
                    ->where('TABLE_SCHEMA', DB::getDatabaseName())
                    ->where('TABLE_NAME', 'positions')
                    ->where('COLUMN_NAME', 'division_id')
                    ->whereNotNull('REFERENCED_TABLE_NAME')
                    ->value('CONSTRAINT_NAME');

                if (is_string($fk) && $fk !== '') {
                    DB::statement("ALTER TABLE `positions` DROP FOREIGN KEY `{$fk}`");
                }

                $indexes = DB::table('information_schema.STATISTICS')
                    ->where('TABLE_SCHEMA', DB::getDatabaseName())
                    ->where('TABLE_NAME', 'positions')
                    ->where('COLUMN_NAME', 'division_id')
                    ->pluck('INDEX_NAME')
                    ->filter(fn ($name) => is_string($name) && $name !== 'PRIMARY')
                    ->unique()
                    ->values();

                foreach ($indexes as $indexName) {
                    DB::statement("ALTER TABLE `positions` DROP INDEX `{$indexName}`");
                }

                $table->dropColumn('division_id');
            }

            if (! Schema::hasColumn('positions', 'department_id')) {
                $table->foreignId('department_id')->after('id')->constrained('departments')->restrictOnDelete();
            }

            $table->unique(['department_id', 'name']);
            $table->unique(['department_id', 'code']);
        });
    }
};