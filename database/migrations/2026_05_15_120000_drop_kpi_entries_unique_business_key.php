<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('kpi_entries', function (Blueprint $table): void {
            $table->dropUnique('kpi_entries_unique_business_key');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kpi_entries', function (Blueprint $table): void {
            $table->unique(
                [
                    'kpi_period_id',
                    'entity_type',
                    'user_id',
                    'faculty_scope_id',
                    'department_scope_id',
                    'indicator_id',
                ],
                'kpi_entries_unique_business_key'
            );
        });
    }
};