<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::update("
            UPDATE kpi_structural_confirmations ksc
            INNER JOIN kpi_entries ke ON ke.id = ksc.kpi_record_id
            SET
                ksc.status       = 'pending',
                ksc.confirmed_by = NULL,
                ksc.comment      = NULL,
                ksc.confirmed_at = NULL,
                ksc.updated_at   = NOW()
            WHERE ksc.status = 'rejected'
              AND ke.status NOT IN ('rejected', 'draft', 'returned')
        ");
    }

    public function down(): void
    {
        // intentionally a no-op
    }
};
