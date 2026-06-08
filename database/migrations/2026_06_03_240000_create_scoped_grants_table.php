<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scoped_grants', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('subject_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('grant_type', 64);
            $table->string('capability', 128);
            $table->string('module', 64)->nullable();
            $table->string('scope_type', 64)->nullable();
            $table->string('scope_source_type', 64)->nullable();
            $table->unsignedBigInteger('scope_source_id')->nullable();
            $table->foreignId('org_unit_id')->nullable()->constrained('org_units')->nullOnDelete();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->string('status', 32)->default('active');
            $table->foreignId('granted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['subject_user_id', 'status']);
            $table->index(['capability', 'module']);
            $table->index(['scope_type', 'scope_source_type', 'scope_source_id']);
            $table->index(['org_unit_id', 'starts_at', 'ends_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scoped_grants');
    }
};
