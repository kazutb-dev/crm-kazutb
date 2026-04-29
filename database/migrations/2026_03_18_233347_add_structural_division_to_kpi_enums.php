<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE kpi_indicators MODIFY COLUMN entity_type ENUM('teacher','department_head','dean','structural_division') NOT NULL");
        DB::statement("ALTER TABLE kpi_entries MODIFY COLUMN entity_type ENUM('teacher','department_head','dean','structural_division') NOT NULL");
        DB::statement("ALTER TABLE kpi_indicators MODIFY COLUMN section ENUM('teaching','science','social','qualification','survey','educational','staff','international') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE kpi_indicators MODIFY COLUMN section ENUM('teaching','science','social','qualification','survey') NOT NULL");
        DB::statement("ALTER TABLE kpi_indicators MODIFY COLUMN entity_type ENUM('teacher','department_head','dean') NOT NULL");
        DB::statement("ALTER TABLE kpi_entries MODIFY COLUMN entity_type ENUM('teacher','department_head','dean') NOT NULL");
    }
};
