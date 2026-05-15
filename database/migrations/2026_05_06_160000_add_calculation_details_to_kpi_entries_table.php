<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kpi_entries', function (Blueprint $table): void {
            $table->json('calculation_details')->nullable()->after('manual_points');
        });
    }

    public function down(): void
    {
        Schema::table('kpi_entries', function (Blueprint $table): void {
            $table->dropColumn('calculation_details');
        });
    }
};
