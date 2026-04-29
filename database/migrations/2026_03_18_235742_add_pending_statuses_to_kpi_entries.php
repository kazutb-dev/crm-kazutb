<?php

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
        DB::statement("ALTER TABLE kpi_entries MODIFY COLUMN status ENUM(
            'draft','submitted','returned','reviewed',
            'pending_dean','pending_structural',
            'approved','rejected','locked'
        ) NOT NULL DEFAULT 'draft'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE kpi_entries MODIFY COLUMN status ENUM(
            'draft','submitted','returned','reviewed',
            'approved','rejected','locked'
        ) NOT NULL DEFAULT 'draft'");
    }
};
