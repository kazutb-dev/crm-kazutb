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
        Schema::create('library_loans', function (Blueprint $table): void {
            $table->id();
            $table->string('book_id', 100)->index();
            $table->unsignedBigInteger('book_legacy_doc_id')->nullable()->index();
            $table->string('book_title', 500);
            $table->string('book_author', 255)->nullable();
            $table->string('book_isbn', 64)->nullable()->index();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('issued_at');
            $table->date('due_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('library_loans');
    }
};