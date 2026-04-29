<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('ad_division', 190)->nullable()->after('ad_department_number');
            $table->string('ad_employee_type', 120)->nullable()->after('ad_division');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn([
                'ad_division',
                'ad_employee_type',
            ]);
        });
    }
};