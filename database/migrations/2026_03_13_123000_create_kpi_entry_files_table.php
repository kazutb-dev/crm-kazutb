<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('kpi_entry_files', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('kpi_entry_id')
                ->constrained('kpi_entries')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();

            $table->string('file_path', 500);
            $table->string('file_name', 255);
            $table->string('file_disk', 50)->default('public');
            $table->string('file_type', 100)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();

            $table->foreignId('uploaded_by')
                ->nullable()
                ->constrained('users')
                ->cascadeOnUpdate()
                ->nullOnDelete();

            $table->timestamps();

            $table->index('kpi_entry_id', 'kpi_entry_files_entry_id_idx');
            $table->index('uploaded_by', 'kpi_entry_files_uploaded_by_idx');
            $table->index('file_disk', 'kpi_entry_files_file_disk_idx');
            $table->index('created_at', 'kpi_entry_files_created_at_idx');
            $table->index(['kpi_entry_id', 'created_at'], 'kpi_entry_files_entry_created_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kpi_entry_files');
    }
};
