<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'kpi_workload_rate')) {
                $table->decimal('kpi_workload_rate', 4, 2)->nullable()->after('position_title');
            }

            if (! Schema::hasColumn('users', 'kpi_experience_years')) {
                $table->unsignedSmallInteger('kpi_experience_years')->nullable()->after('kpi_workload_rate');
            }

            if (! Schema::hasColumn('users', 'kpi_individual_plan_completion_percent')) {
                $table->decimal('kpi_individual_plan_completion_percent', 5, 2)->nullable()->after('kpi_experience_years');
            }

            if (! Schema::hasColumn('users', 'kpi_participation_override')) {
                $table->boolean('kpi_participation_override')->default(false)->after('kpi_individual_plan_completion_percent');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'kpi_participation_override')) {
                $table->dropColumn('kpi_participation_override');
            }

            if (Schema::hasColumn('users', 'kpi_individual_plan_completion_percent')) {
                $table->dropColumn('kpi_individual_plan_completion_percent');
            }

            if (Schema::hasColumn('users', 'kpi_experience_years')) {
                $table->dropColumn('kpi_experience_years');
            }

            if (Schema::hasColumn('users', 'kpi_workload_rate')) {
                $table->dropColumn('kpi_workload_rate');
            }
        });
    }
};
