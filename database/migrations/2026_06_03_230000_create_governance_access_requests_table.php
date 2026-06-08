<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('governance_access_requests', function (Blueprint $table): void {
            $table->id();
            $table->string('request_type', 80);
            $table->foreignId('subject_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->string('origin', 120)->nullable();
            $table->string('authority_route', 40);
            $table->json('authority_scope')->nullable();
            $table->json('current_value');
            $table->json('requested_value');
            $table->text('request_comment')->nullable();
            $table->string('status', 30)->default('pending');
            $table->foreignId('approver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('review_comment')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('override_reason')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('effective_applied_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['status', 'request_type'], 'gov_access_requests_status_type_idx');
            $table->index(['subject_user_id', 'request_type', 'status'], 'gov_access_requests_subject_type_status_idx');
            $table->index(['requested_by', 'status'], 'gov_access_requests_requested_by_status_idx');
            $table->index(['authority_route', 'status'], 'gov_access_requests_route_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('governance_access_requests');
    }
};
