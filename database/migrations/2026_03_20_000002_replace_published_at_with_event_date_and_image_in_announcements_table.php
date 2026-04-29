<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('announcements', function (Blueprint $table): void {
            $table->dropIndex(['is_active', 'published_at']);
            $table->dropColumn('published_at');

            $table->timestamp('event_date')->nullable()->after('is_important');
            $table->string('image_path')->nullable()->after('event_date');

            $table->index(['is_active', 'event_date']);
        });
    }

    public function down(): void
    {
        Schema::table('announcements', function (Blueprint $table): void {
            $table->dropIndex(['is_active', 'event_date']);
            $table->dropColumn(['event_date', 'image_path']);

            $table->timestamp('published_at')->nullable()->after('is_important');
            $table->index(['is_active', 'published_at']);
        });
    }
};
