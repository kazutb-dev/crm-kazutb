<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('language_testing_sessions', function (Blueprint $table): void {
            if (! Schema::hasColumn('language_testing_sessions', 'submission_hash')) {
                $table->string('submission_hash', 64)->nullable()->after('total_questions');
                $table->index('submission_hash', 'lt_sessions_submission_hash_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('language_testing_sessions', function (Blueprint $table): void {
            if (Schema::hasColumn('language_testing_sessions', 'submission_hash')) {
                $table->dropIndex('lt_sessions_submission_hash_idx');
                $table->dropColumn('submission_hash');
            }
        });
    }
};
