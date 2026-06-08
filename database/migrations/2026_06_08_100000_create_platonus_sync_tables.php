<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Platonus Integration Architecture — Phase 3 Scaffold.
 *
 * Creates tables for future bidirectional sync with the Platonus AIS.
 * No live connection is established by this migration; it only defines
 * the local storage layer.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Platonus sync configuration ───────────────────────────────────────
        if (! Schema::hasTable('platonus_sync_configs')) {
            Schema::create('platonus_sync_configs', function (Blueprint $table): void {
                $table->id();
                $table->string('key')->unique();           // e.g. 'students', 'employees'
                $table->string('endpoint_path')->nullable(); // relative API path
                $table->boolean('is_enabled')->default(false);
                $table->integer('batch_size')->default(500);
                $table->string('direction', 20)->default('inbound'); // inbound|outbound|bidirectional
                $table->timestamps();
            });
        }

        // ── Student sync records ──────────────────────────────────────────────
        if (! Schema::hasTable('platonus_students')) {
            Schema::create('platonus_students', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id')->nullable()->index();
                $table->string('platonus_id')->nullable()->unique();   // external Platonus student ID
                $table->string('full_name');
                $table->string('iin', 12)->nullable()->index();        // ИИН
                $table->string('student_id_number')->nullable();       // Номер студенческого
                $table->unsignedTinyInteger('course')->nullable();
                $table->string('educational_program')->nullable();
                $table->string('faculty')->nullable();
                $table->string('group_name')->nullable();
                $table->decimal('gpa', 4, 2)->nullable();
                $table->string('status', 50)->default('active');       // active|expelled|graduated|academic_leave
                $table->string('study_form', 30)->nullable();          // full_time|part_time|distance
                $table->date('enrollment_date')->nullable();
                $table->date('expected_graduation')->nullable();
                $table->json('raw_data')->nullable();                  // original Platonus payload
                $table->timestamp('synced_at')->nullable();
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            });
        }

        // ── Employee sync records ─────────────────────────────────────────────
        if (! Schema::hasTable('platonus_employees')) {
            Schema::create('platonus_employees', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('user_id')->nullable()->index();
                $table->string('platonus_id')->nullable()->unique();
                $table->string('full_name');
                $table->string('iin', 12)->nullable()->index();
                $table->string('position')->nullable();
                $table->string('faculty')->nullable();
                $table->string('department')->nullable();
                $table->string('academic_title')->nullable();          // доцент, профессор и т.д.
                $table->string('academic_degree')->nullable();         // кандидат, доктор
                $table->decimal('workload_rate', 5, 2)->nullable();   // ставка
                $table->string('employee_type', 50)->nullable();      // full_time|part_time|contract
                $table->string('status', 50)->default('active');
                $table->json('raw_data')->nullable();
                $table->timestamp('synced_at')->nullable();
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            });
        }

        // ── Sync job audit log ────────────────────────────────────────────────
        if (! Schema::hasTable('platonus_sync_logs')) {
            Schema::create('platonus_sync_logs', function (Blueprint $table): void {
                $table->id();
                $table->string('entity_type', 50);                    // students|employees
                $table->string('direction', 20)->default('inbound');
                $table->string('status', 30);                         // started|completed|failed|partial
                $table->unsignedInteger('total_records')->default(0);
                $table->unsignedInteger('created_records')->default(0);
                $table->unsignedInteger('updated_records')->default(0);
                $table->unsignedInteger('skipped_records')->default(0);
                $table->unsignedInteger('failed_records')->default(0);
                $table->text('error_message')->nullable();
                $table->json('meta')->nullable();                      // batch info, endpoint used
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
            });
        }

        // ── Sync conflict records ─────────────────────────────────────────────
        if (! Schema::hasTable('platonus_sync_conflicts')) {
            Schema::create('platonus_sync_conflicts', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('sync_log_id')->nullable();
                $table->string('entity_type', 50);
                $table->string('platonus_id')->nullable();
                $table->string('field_name');
                $table->text('local_value')->nullable();
                $table->text('remote_value')->nullable();
                $table->string('resolution', 30)->default('pending'); // pending|keep_local|accept_remote|manual
                $table->unsignedBigInteger('resolved_by')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->timestamps();

                $table->foreign('sync_log_id')->references('id')->on('platonus_sync_logs')->nullOnDelete();
                $table->foreign('resolved_by')->references('id')->on('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('platonus_sync_conflicts');
        Schema::dropIfExists('platonus_sync_logs');
        Schema::dropIfExists('platonus_employees');
        Schema::dropIfExists('platonus_students');
        Schema::dropIfExists('platonus_sync_configs');
    }
};
