<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificate_templates', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('code', 80)->unique();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['is_active', 'name']);
        });

        Schema::create('certificate_template_versions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('template_id')->constrained('certificate_templates')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('background_path')->nullable();
            $table->unsignedInteger('canvas_width');
            $table->unsignedInteger('canvas_height');
            $table->unsignedSmallInteger('dpi')->default(300);
            $table->json('layout_json');
            $table->json('text_rules_json')->nullable();
            $table->json('qr_rules_json')->nullable();
            $table->boolean('is_published')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['template_id', 'version']);
            $table->index(['template_id', 'is_published']);
        });

        Schema::create('certificate_number_sequences', function (Blueprint $table): void {
            $table->id();
            $table->string('prefix', 20);
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('last_number')->default(0);
            $table->timestamps();

            $table->unique(['prefix', 'year']);
        });

        Schema::create('certificates', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('template_id')->constrained('certificate_templates');
            $table->foreignId('template_version_id')->constrained('certificate_template_versions');
            $table->string('certificate_number', 80)->unique();
            $table->string('recipient_full_name');
            $table->string('topic');
            $table->json('optional_json')->nullable();
            $table->text('qr_payload');
            $table->string('status', 20)->default('draft');
            $table->string('file_pdf_path')->nullable();
            $table->string('file_png_path')->nullable();
            $table->string('checksum_sha256', 64)->nullable();
            $table->timestamp('generated_at')->nullable();
            $table->timestamp('issued_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->text('revoked_reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'issued_at']);
            $table->index(['recipient_full_name']);
            $table->index(['created_at']);
        });

        Schema::create('certificate_generation_batches', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('template_version_id')->constrained('certificate_template_versions');
            $table->string('source_type', 20);
            $table->string('source_file_path')->nullable();
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('success_rows')->default(0);
            $table->unsignedInteger('failed_rows')->default(0);
            $table->string('status', 20)->default('processing');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });

        Schema::create('certificate_generation_batch_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('batch_id')->constrained('certificate_generation_batches')->cascadeOnDelete();
            $table->unsignedInteger('row_index');
            $table->json('payload_json');
            $table->foreignId('result_certificate_id')->nullable()->constrained('certificates')->nullOnDelete();
            $table->string('status', 20)->default('pending');
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['batch_id', 'status']);
        });

        Schema::create('certificate_audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 100);
            $table->string('entity_type', 100);
            $table->unsignedBigInteger('entity_id');
            $table->json('meta_json')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['entity_type', 'entity_id']);
            $table->index(['action', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificate_audit_logs');
        Schema::dropIfExists('certificate_generation_batch_items');
        Schema::dropIfExists('certificate_generation_batches');
        Schema::dropIfExists('certificates');
        Schema::dropIfExists('certificate_number_sequences');
        Schema::dropIfExists('certificate_template_versions');
        Schema::dropIfExists('certificate_templates');
    }
};
