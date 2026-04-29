<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calendar_holidays', function (Blueprint $table) {
            $table->increments('id');
            $table->date('date');
            $table->string('name_ru');
            $table->string('name_kk')->nullable();
            $table->string('name_en')->nullable();
            $table->year('year');
            $table->boolean('is_active')->default(true);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_holidays');
    }
};
