<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('discipline_group')) {
            return;
        }

        Schema::create('discipline_group', function (Blueprint $table) {
            $table->id();
            $table->foreignId('discipline_id')->constrained('disciplines')->cascadeOnDelete();
            $table->foreignId('group_id')->constrained('groups')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['discipline_id', 'group_id']);
            $table->index('discipline_id');
            $table->index('group_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discipline_group');
    }
};
