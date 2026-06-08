<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('module_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('role_id')->nullable()->constrained('roles')->nullOnDelete();
            $table->string('module_key', 128);
            $table->string('module_role', 32);
            $table->string('assignment_kind', 32)->default('standard');
            $table->string('scope_type', 64)->nullable();
            $table->string('scope_source_type', 64)->nullable();
            $table->unsignedBigInteger('scope_source_id')->nullable();
            $table->foreignId('org_unit_id')->nullable()->constrained('org_units')->nullOnDelete();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->string('status', 32)->default('pending');
            $table->foreignId('granted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'module_key', 'module_role'], 'mod_assign_user_module_role_idx');
            $table->index(['module_key', 'status'], 'mod_assign_module_status_idx');
            $table->index(['scope_type', 'scope_source_type', 'scope_source_id'], 'mod_assign_scope_source_idx');
            $table->index(['org_unit_id', 'starts_at', 'ends_at'], 'mod_assign_org_window_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('module_assignments');
    }
};
