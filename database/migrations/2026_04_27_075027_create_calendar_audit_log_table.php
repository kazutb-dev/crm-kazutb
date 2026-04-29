<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calendar_audit_log', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('acting_for_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 100);
            $table->string('subject_type', 100);
            $table->unsignedBigInteger('subject_id');
            $table->json('changes')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->datetime('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_audit_log');
    }
};
