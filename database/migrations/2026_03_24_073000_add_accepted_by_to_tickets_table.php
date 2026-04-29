<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table): void {
            $table->foreignId('accepted_by')->nullable()->after('submitted_by')->constrained('users')->nullOnDelete();
            $table->timestamp('accepted_at')->nullable()->after('accepted_by');

            $table->index(['accepted_by', 'accepted_at']);
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table): void {
            $table->dropIndex(['accepted_by', 'accepted_at']);
            $table->dropConstrainedForeignId('accepted_by');
            $table->dropColumn('accepted_at');
        });
    }
};
