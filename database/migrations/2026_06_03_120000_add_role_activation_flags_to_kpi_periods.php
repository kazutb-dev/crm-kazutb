<?php

use App\Models\KpiPeriod;
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
        Schema::table('kpi_periods', function (Blueprint $table): void {
            $table->boolean('is_teacher_active')->default(false)->after('status');
            $table->boolean('is_hod_active')->default(false)->after('is_teacher_active');
            $table->boolean('is_dean_active')->default(false)->after('is_hod_active');
            $table->boolean('is_structural_active')->default(false)->after('is_dean_active');
        });

        DB::table('kpi_periods')
            ->where('status', KpiPeriod::STATUS_ACTIVE)
            ->update([
                'is_teacher_active' => true,
                'is_hod_active' => true,
                'is_dean_active' => true,
                'is_structural_active' => true,
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kpi_periods', function (Blueprint $table): void {
            $table->dropColumn([
                'is_teacher_active',
                'is_hod_active',
                'is_dean_active',
                'is_structural_active',
            ]);
        });
    }
};
