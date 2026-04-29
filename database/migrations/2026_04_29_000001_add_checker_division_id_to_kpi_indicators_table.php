<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kpi_indicators', function (Blueprint $table) {
            $table->unsignedBigInteger('checker_division_id')->nullable()->after('sort_order');
            $table->foreign('checker_division_id')->references('id')->on('divisions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('kpi_indicators', function (Blueprint $table) {
            $table->dropForeign(['checker_division_id']);
            $table->dropColumn('checker_division_id');
        });
    }
};
