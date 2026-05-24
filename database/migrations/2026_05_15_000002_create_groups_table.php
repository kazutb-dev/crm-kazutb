<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('groups')) {
            return;
        }

        Schema::create('groups', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('code')->unique();
            $table->foreignId('department_id')->nullable()->constrained('departments')->cascadeOnDelete();
            $table->text('description')->nullable();
            $table->timestamps();
            $table->index('name');
            $table->index('code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('groups');
    }
};
