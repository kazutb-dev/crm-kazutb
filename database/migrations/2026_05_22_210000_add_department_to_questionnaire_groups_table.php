<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('questionnaire_groups')) {
            return;
        }

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

    public function down(): void
    {
        if (! Schema::hasTable('questionnaire_groups')) {
            return;
        }

        Schema::table('questionnaire_groups', function (Blueprint $table): void {
            if (Schema::hasColumn('questionnaire_groups', 'department_id')) {
                $table->dropConstrainedForeignId('department_id');
            }
        });
    }
};
