<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->foreignId('department_id')
                ->nullable()
                ->after('role_id')
                ->constrained('departments')
                ->nullOnDelete();

            $table->foreignId('faculty_id')
                ->nullable()
                ->after('department_id')
                ->constrained('faculties')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropForeignIdFor(\App\Models\Department::class);
            $table->dropForeignIdFor(\App\Models\Faculty::class);
        });
    }
};
