<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('governance_access_requests')) {
            return;
        }

        $needsApprovedValue = ! Schema::hasColumn('governance_access_requests', 'approved_value');
        $needsEffectiveValue = ! Schema::hasColumn('governance_access_requests', 'effective_value');

        if (! $needsApprovedValue && ! $needsEffectiveValue) {
            return;
        }

        Schema::table('governance_access_requests', function (Blueprint $table) use ($needsApprovedValue, $needsEffectiveValue): void {
            if ($needsApprovedValue) {
                $table->json('approved_value')->nullable()->after('requested_value');
            }

            if ($needsEffectiveValue) {
                $table->json('effective_value')->nullable()->after('approved_value');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('governance_access_requests')) {
            return;
        }

        $dropColumns = [];

        if (Schema::hasColumn('governance_access_requests', 'effective_value')) {
            $dropColumns[] = 'effective_value';
        }

        if (Schema::hasColumn('governance_access_requests', 'approved_value')) {
            $dropColumns[] = 'approved_value';
        }

        if ($dropColumns === []) {
            return;
        }

        Schema::table('governance_access_requests', function (Blueprint $table) use ($dropColumns): void {
            $table->dropColumn($dropColumns);
        });
    }
};
