<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('questionnaire_group_specialities')) {
            Schema::table('questionnaire_group_specialities', function (Blueprint $table): void {
                if (! Schema::hasColumn('questionnaire_group_specialities', 'department_id')) {
                    $table->foreignId('department_id')
                        ->nullable()
                        ->after('name')
                        ->constrained('departments')
                        ->nullOnDelete();
                }
            });
        }

        if (
            Schema::hasTable('questionnaire_groups')
            && Schema::hasColumn('questionnaire_groups', 'department_id')
            && Schema::hasTable('questionnaire_group_specialities')
            && Schema::hasColumn('questionnaire_group_specialities', 'department_id')
        ) {
            $bindings = DB::table('questionnaire_groups')
                ->select('group_speciality_id', 'department_id')
                ->whereNotNull('group_speciality_id')
                ->whereNotNull('department_id')
                ->orderBy('id')
                ->get();

            foreach ($bindings as $binding) {
                DB::table('questionnaire_group_specialities')
                    ->where('id', (int) $binding->group_speciality_id)
                    ->whereNull('department_id')
                    ->update(['department_id' => (int) $binding->department_id]);
            }
        }

        if (Schema::hasTable('questionnaire_groups') && Schema::hasColumn('questionnaire_groups', 'department_id')) {
            Schema::table('questionnaire_groups', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('department_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('questionnaire_groups')) {
            Schema::table('questionnaire_groups', function (Blueprint $table): void {
                if (! Schema::hasColumn('questionnaire_groups', 'department_id')) {
                    $table->foreignId('department_id')
                        ->nullable()
                        ->after('group_educational_program_id')
                        ->constrained('departments')
                        ->nullOnDelete();
                }
            });
        }

        if (
            Schema::hasTable('questionnaire_group_specialities')
            && Schema::hasColumn('questionnaire_group_specialities', 'department_id')
            && Schema::hasTable('questionnaire_groups')
            && Schema::hasColumn('questionnaire_groups', 'department_id')
        ) {
            DB::table('questionnaire_groups as g')
                ->join('questionnaire_group_specialities as s', 's.id', '=', 'g.group_speciality_id')
                ->whereNotNull('s.department_id')
                ->update(['g.department_id' => DB::raw('s.department_id')]);
        }

        if (Schema::hasTable('questionnaire_group_specialities') && Schema::hasColumn('questionnaire_group_specialities', 'department_id')) {
            Schema::table('questionnaire_group_specialities', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('department_id');
            });
        }
    }
};
