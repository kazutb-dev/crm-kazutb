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
        Schema::create('library_reservations', function (Blueprint $table): void {
            $table->id();
            $table->string('book_id', 100)->index();
            $table->string('book_title', 500);
            $table->string('book_author', 255)->nullable();
            $table->string('book_isbn', 64)->nullable()->index();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('student_identifier', 120)->nullable()->index();
            $table->string('student_name', 255)->nullable();
            $table->string('student_email', 255)->nullable()->index();
            $table->string('source_ip', 45)->index();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending')->index();
            $table->text('review_note')->nullable();
            $table->timestamp('requested_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('library_reservations');
    }
};
