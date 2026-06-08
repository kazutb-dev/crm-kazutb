<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_sources', function (Blueprint $table): void {
            $table->id();
            $table->string('key', 64)->unique();
            $table->string('label', 128);
            $table->string('source_type', 32);
            $table->boolean('is_active')->default(true);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['source_type', 'is_active']);
        });

        Schema::create('import_jobs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('import_source_id')->constrained('import_sources')->cascadeOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('target_domain', 64);
            $table->string('target_entity', 64);
            $table->string('status', 32)->default('draft');
            $table->string('mode', 32)->default('dry_run');
            $table->text('reason')->nullable();
            $table->unsignedInteger('row_count')->default(0);
            $table->unsignedInteger('valid_count')->default(0);
            $table->unsignedInteger('invalid_count')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['target_domain', 'target_entity', 'status']);
            $table->index(['requested_by', 'status']);
        });

        Schema::create('import_mappings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('import_job_id')->constrained('import_jobs')->cascadeOnDelete();
            $table->string('source_field', 128);
            $table->string('target_field', 128);
            $table->string('mapping_kind', 32)->default('direct');
            $table->string('transform_rule', 128)->nullable();
            $table->boolean('is_required')->default(false);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['import_job_id', 'target_field']);
        });

        Schema::create('import_validations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('import_job_id')->constrained('import_jobs')->cascadeOnDelete();
            $table->string('validation_key', 128);
            $table->string('severity', 16);
            $table->string('status', 16)->default('pending');
            $table->text('message');
            $table->unsignedInteger('row_number')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['import_job_id', 'severity', 'status']);
        });

        Schema::create('import_audits', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('import_job_id')->constrained('import_jobs')->cascadeOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 64);
            $table->text('message')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['import_job_id', 'action']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_audits');
        Schema::dropIfExists('import_validations');
        Schema::dropIfExists('import_mappings');
        Schema::dropIfExists('import_jobs');
        Schema::dropIfExists('import_sources');
    }
};
