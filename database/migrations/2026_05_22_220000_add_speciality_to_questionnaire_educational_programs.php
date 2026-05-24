<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('questionnaire_group_educational_programs')) {
            return;
        }

        Schema::table('questionnaire_group_educational_programs', function (Blueprint $table): void {
            if (! Schema::hasColumn('questionnaire_group_educational_programs', 'group_speciality_id')) {
                $table->foreignId('group_speciality_id')
                    ->nullable()
                    ->after('name')
                    ->constrained('questionnaire_group_specialities', 'id', 'qgep_spec_fk')
                    ->cascadeOnDelete();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('questionnaire_group_educational_programs')) {
            return;
        }

        Schema::table('questionnaire_group_educational_programs', function (Blueprint $table): void {
            if (Schema::hasColumn('questionnaire_group_educational_programs', 'group_speciality_id')) {
                $table->dropForeign('qgep_spec_fk');
                $table->dropColumn('group_speciality_id');
            }
        });
    }
};
