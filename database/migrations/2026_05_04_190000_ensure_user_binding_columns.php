<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'department_id')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->foreignId('department_id')
                    ->nullable()
                    ->after('role_id')
                    ->constrained('departments')
                    ->nullOnDelete();
            });
        }

        if (!Schema::hasColumn('users', 'faculty_id')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->foreignId('faculty_id')
                    ->nullable()
                    ->after('department_id')
                    ->constrained('faculties')
                    ->nullOnDelete();
            });
        }

        $database = DB::getDatabaseName();

        $hasDepartmentForeign = DB::table('information_schema.TABLE_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', $database)
            ->where('TABLE_NAME', 'users')
            ->where('CONSTRAINT_NAME', 'users_department_id_foreign')
            ->exists();

        if (!$hasDepartmentForeign && Schema::hasColumn('users', 'department_id')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->foreign('department_id')
                    ->references('id')
                    ->on('departments')
                    ->nullOnDelete();
            });
        }

        $hasFacultyForeign = DB::table('information_schema.TABLE_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', $database)
            ->where('TABLE_NAME', 'users')
            ->where('CONSTRAINT_NAME', 'users_faculty_id_foreign')
            ->exists();

        if (!$hasFacultyForeign && Schema::hasColumn('users', 'faculty_id')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->foreign('faculty_id')
                    ->references('id')
                    ->on('faculties')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        $database = DB::getDatabaseName();

        $hasDepartmentForeign = DB::table('information_schema.TABLE_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', $database)
            ->where('TABLE_NAME', 'users')
            ->where('CONSTRAINT_NAME', 'users_department_id_foreign')
            ->exists();

        if ($hasDepartmentForeign) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropForeign('users_department_id_foreign');
            });
        }

        $hasFacultyForeign = DB::table('information_schema.TABLE_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', $database)
            ->where('TABLE_NAME', 'users')
            ->where('CONSTRAINT_NAME', 'users_faculty_id_foreign')
            ->exists();

        if ($hasFacultyForeign) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropForeign('users_faculty_id_foreign');
            });
        }

        if (Schema::hasColumn('users', 'faculty_id')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropColumn('faculty_id');
            });
        }

        if (Schema::hasColumn('users', 'department_id')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropColumn('department_id');
            });
        }
    }
};
