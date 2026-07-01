<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('language_testing_sessions', function (Blueprint $table): void {
            if (! Schema::hasColumn('language_testing_sessions', 'iin')) {
                $table->string('iin', 20)->nullable()->after('student_id');
            }

            if (! Schema::hasColumn('language_testing_sessions', 'middle_name')) {
                $table->string('middle_name')->nullable()->after('first_name');
            }
        });

        Schema::table('language_testing_results', function (Blueprint $table): void {
            if (! Schema::hasColumn('language_testing_results', 'iin')) {
                $table->string('iin', 20)->nullable()->after('student_id');
            }

            if (! Schema::hasColumn('language_testing_results', 'middle_name')) {
                $table->string('middle_name')->nullable()->after('first_name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('language_testing_results', function (Blueprint $table): void {
            if (Schema::hasColumn('language_testing_results', 'middle_name')) {
                $table->dropColumn('middle_name');
            }

            if (Schema::hasColumn('language_testing_results', 'iin')) {
                $table->dropColumn('iin');
            }
        });

        Schema::table('language_testing_sessions', function (Blueprint $table): void {
            if (Schema::hasColumn('language_testing_sessions', 'middle_name')) {
                $table->dropColumn('middle_name');
            }

            if (Schema::hasColumn('language_testing_sessions', 'iin')) {
                $table->dropColumn('iin');
            }
        });
    }
};