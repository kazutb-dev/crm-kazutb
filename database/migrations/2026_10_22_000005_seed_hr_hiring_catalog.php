<?php

use Database\Seeders\HrHiringCatalogSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * RU genitive forms for org units and teaching positions (by rules, not verified), administrative and
     * support positions from the prototype, employer requisites from the sample contract.
     */
    public function up(): void
    {
        (new HrHiringCatalogSeeder)->run();
    }

    public function down(): void
    {
        DB::table('app_settings')->where('key', 'hr_employer')->delete();
    }
};
