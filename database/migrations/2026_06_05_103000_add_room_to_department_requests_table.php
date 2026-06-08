<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('department_requests', function (Blueprint $table): void {
            $table->string('room', 50)->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('department_requests', function (Blueprint $table): void {
            $table->dropColumn('room');
        });
    }
};
