<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Versioned .docx templates. Version 1 of each type is the built-in file in resources/hr/templates
        // (file_path = null); later versions are uploaded by the HR department.
        Schema::create('hr_document_templates', function (Blueprint $table): void {
            $table->id();
            $table->string('type', 20);
            $table->unsignedSmallInteger('version');
            $table->string('file_path')->nullable();
            $table->string('original_name')->nullable();
            $table->char('sha256', 64)->nullable();
            $table->boolean('is_active')->default(false);
            $table->string('comment')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['type', 'version']);
        });

        // Every generation is a new version; signed versions are never overwritten.
        Schema::create('hr_documents', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('hiring_id')->constrained('hr_hirings')->cascadeOnDelete();
            $table->string('type', 20);
            $table->unsignedSmallInteger('version');
            $table->foreignId('template_id')->constrained('hr_document_templates');
            $table->string('file_path');
            $table->char('sha256', 64);
            $table->string('status', 20)->default('draft');
            $table->string('oup_executor')->nullable();
            $table->json('missing_fields')->nullable();
            $table->json('warnings')->nullable();
            $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('signed_at')->nullable();
            $table->foreignId('signed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('signed_scan_path')->nullable();
            $table->timestamps();

            $table->unique(['hiring_id', 'type', 'version']);
        });

        // PDF previews rendered by LibreOffice in the queue; short-lived, pruned by the scheduler.
        Schema::create('hr_document_previews', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('hiring_id')->constrained('hr_hirings')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 20);
            $table->string('status', 20)->default('pending');
            $table->string('docx_path')->nullable();
            $table->string('pdf_path')->nullable();
            $table->string('error')->nullable();
            $table->timestamps();

            $table->index(['hiring_id', 'type', 'user_id']);
            $table->index('created_at');
        });

        $now = now();
        foreach (['contract', 'order', 'card'] as $type) {
            DB::table('hr_document_templates')->insert([
                'type' => $type,
                'version' => 1,
                'file_path' => null,
                'is_active' => true,
                'comment' => 'Встроенный шаблон',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_document_previews');
        Schema::dropIfExists('hr_documents');
        Schema::dropIfExists('hr_document_templates');
    }
};
