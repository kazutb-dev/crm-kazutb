<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('questionnaire_surveys', function (Blueprint $table): void {
            if (! Schema::hasColumn('questionnaire_surveys', 'target_scope')) {
                $table->string('target_scope', 20)->default('global')->after('semester');
                $table->index('target_scope');
            }

            if (! Schema::hasColumn('questionnaire_surveys', 'target_group_id')) {
                $table->foreignId('target_group_id')
                    ->nullable()
                    ->after('target_scope')
                    ->constrained('questionnaire_groups')
                    ->nullOnDelete();

                $table->index(['target_scope', 'target_group_id'], 'q_surveys_scope_group_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('questionnaire_surveys', function (Blueprint $table): void {
            if (Schema::hasColumn('questionnaire_surveys', 'target_group_id')) {
                $table->dropForeign(['target_group_id']);
                $table->dropIndex('q_surveys_scope_group_idx');
                $table->dropColumn('target_group_id');
            }

            if (Schema::hasColumn('questionnaire_surveys', 'target_scope')) {
                $table->dropIndex(['target_scope']);
                $table->dropColumn('target_scope');
            }
        });
    }
};
