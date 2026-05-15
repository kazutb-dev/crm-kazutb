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
        Schema::create('groups', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique(); // Название группы (например: БПМ-20-1)
            $table->string('code')->unique(); // Код группы
            $table->foreignId('department_id')->nullable()->constrained('departments')->cascadeOnDelete();
            $table->text('description')->nullable();
            $table->timestamps();
            $table->index('name');
            $table->index('code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('groups');
    }
};
