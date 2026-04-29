<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('navigation_routes', function (Blueprint $table): void {
            $table->id();
            $table->string('badge', 30);
            $table->string('title', 190);
            $table->string('meta', 190);
            $table->enum('kind', ['cabinet', 'staff', 'department'])->default('cabinet');
            $table->string('building', 120)->nullable();
            $table->unsignedTinyInteger('floor')->nullable();
            $table->string('room', 40)->nullable();
            $table->json('steps')->nullable();
            $table->string('map_image_path')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->unsignedInteger('sort_order')->default(0)->index();
            $table->timestamps();
        });

        $now = now();

        DB::table('navigation_routes')->insert([
            ['badge' => '100', 'title' => 'Кабинет 100', 'meta' => '1 корпус • 1 этаж', 'kind' => 'cabinet', 'building' => '1 корпус', 'floor' => 1, 'room' => '100', 'sort_order' => 10, 'created_at' => $now, 'updated_at' => $now],
            ['badge' => '101', 'title' => 'Кабинет 101', 'meta' => '2 корпус • 1 этаж', 'kind' => 'cabinet', 'building' => '2 корпус', 'floor' => 1, 'room' => '101', 'sort_order' => 20, 'created_at' => $now, 'updated_at' => $now],
            ['badge' => '102', 'title' => 'Кабинет 102', 'meta' => '2 корпус • 1 этаж', 'kind' => 'cabinet', 'building' => '2 корпус', 'floor' => 1, 'room' => '102', 'sort_order' => 30, 'created_at' => $now, 'updated_at' => $now],
            ['badge' => '103', 'title' => 'Кабинет 103', 'meta' => '2 корпус • 1 этаж', 'kind' => 'cabinet', 'building' => '2 корпус', 'floor' => 1, 'room' => '103', 'sort_order' => 40, 'created_at' => $now, 'updated_at' => $now],
            ['badge' => '103/1', 'title' => 'Кабинет 103/1', 'meta' => '2 корпус • 1 этаж', 'kind' => 'cabinet', 'building' => '2 корпус', 'floor' => 1, 'room' => '103/1', 'sort_order' => 50, 'created_at' => $now, 'updated_at' => $now],
            ['badge' => '104', 'title' => 'Кабинет 104', 'meta' => '2 корпус • 1 этаж', 'kind' => 'cabinet', 'building' => '2 корпус', 'floor' => 1, 'room' => '104', 'sort_order' => 60, 'created_at' => $now, 'updated_at' => $now],
            ['badge' => '105', 'title' => 'Кабинет 105', 'meta' => '2 корпус • 1 этаж', 'kind' => 'cabinet', 'building' => '2 корпус', 'floor' => 1, 'room' => '105', 'sort_order' => 70, 'created_at' => $now, 'updated_at' => $now],
            ['badge' => '106', 'title' => 'Кабинет 106', 'meta' => '2 корпус • 1 этаж', 'kind' => 'cabinet', 'building' => '2 корпус', 'floor' => 1, 'room' => '106', 'sort_order' => 80, 'created_at' => $now, 'updated_at' => $now],
            ['badge' => '201', 'title' => 'Кабинет 201', 'meta' => '2 корпус • 2 этаж', 'kind' => 'cabinet', 'building' => '2 корпус', 'floor' => 2, 'room' => '201', 'sort_order' => 90, 'created_at' => $now, 'updated_at' => $now],
            ['badge' => '202', 'title' => 'Кабинет 202', 'meta' => '2 корпус • 2 этаж', 'kind' => 'cabinet', 'building' => '2 корпус', 'floor' => 2, 'room' => '202', 'sort_order' => 100, 'created_at' => $now, 'updated_at' => $now],
            ['badge' => '203', 'title' => 'Кабинет 203', 'meta' => '2 корпус • 2 этаж', 'kind' => 'cabinet', 'building' => '2 корпус', 'floor' => 2, 'room' => '203', 'sort_order' => 110, 'created_at' => $now, 'updated_at' => $now],
            ['badge' => '204', 'title' => 'Кабинет 204', 'meta' => '2 корпус • 2 этаж', 'kind' => 'cabinet', 'building' => '2 корпус', 'floor' => 2, 'room' => '204', 'sort_order' => 120, 'created_at' => $now, 'updated_at' => $now],
            ['badge' => 'IT', 'title' => 'Деканат ИТ', 'meta' => '1 корпус • 2 этаж', 'kind' => 'department', 'building' => '1 корпус', 'floor' => 2, 'room' => null, 'sort_order' => 130, 'created_at' => $now, 'updated_at' => $now],
            ['badge' => 'HR', 'title' => 'Отдел кадров', 'meta' => 'Главный корпус • 1 этаж', 'kind' => 'department', 'building' => 'Главный корпус', 'floor' => 1, 'room' => null, 'sort_order' => 140, 'created_at' => $now, 'updated_at' => $now],
            ['badge' => 'SM', 'title' => 'Смагулова А.', 'meta' => '2 корпус • 3 этаж', 'kind' => 'staff', 'building' => '2 корпус', 'floor' => 3, 'room' => null, 'sort_order' => 150, 'created_at' => $now, 'updated_at' => $now],
            ['badge' => 'AK', 'title' => 'Ахметов К.', 'meta' => '1 корпус • 2 этаж', 'kind' => 'staff', 'building' => '1 корпус', 'floor' => 2, 'room' => null, 'sort_order' => 160, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('navigation_routes');
    }
};
