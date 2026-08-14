<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('academic_mobility_applications', function (Blueprint $table) {
            $table->text('review_notes')->nullable()->after('notes');
            $table->timestamp('reviewed_at')->nullable()->after('review_notes');
            $table->unsignedBigInteger('reviewed_by')->nullable()->after('reviewed_at');
        });
    }

    public function down(): void
    {
        Schema::table('academic_mobility_applications', function (Blueprint $table) {
            $table->dropColumn(['review_notes', 'reviewed_at', 'reviewed_by']);
        });
    }
};
