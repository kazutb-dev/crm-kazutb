<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('academic_scope_assignments')) {
            return;
        }

        Schema::create('academic_scope_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('assignment_type', 40)->index();
            $table->string('scope_status', 40)->default('pending')->index();

            $table->unsignedBigInteger('faculty_id')->nullable()->index();
            $table->unsignedBigInteger('department_id')->nullable()->index();
            $table->unsignedBigInteger('educational_program_id')->nullable()->index();
            $table->unsignedBigInteger('group_id')->nullable()->index();
            $table->unsignedTinyInteger('course_number')->nullable()->index();
            $table->string('stream_code', 120)->nullable()->index();

            $table->string('source_system', 80)->default('crm')->index();
            $table->string('source_external_id', 190)->nullable()->index();
            $table->unsignedBigInteger('governance_request_id')->nullable()->index();
            $table->unsignedBigInteger('approved_by')->nullable()->index();

            $table->dateTime('starts_at')->nullable();
            $table->dateTime('ends_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'assignment_type', 'scope_status'], 'academic_scope_user_type_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('academic_scope_assignments');
    }
};
