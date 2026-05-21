<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_activity_snapshots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->string('last_ip_address', 45)->nullable()->index();
            $table->string('last_route_name')->nullable();
            $table->string('last_path')->nullable();
            $table->string('last_user_agent')->nullable();
            $table->string('last_activity_source', 50)->nullable();
            $table->timestamps();

            $table->index(['last_seen_at', 'last_ip_address']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_activity_snapshots');
    }
};