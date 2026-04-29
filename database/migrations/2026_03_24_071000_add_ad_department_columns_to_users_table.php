<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('ad_department', 190)->nullable()->after('ad_description');
            $table->string('ad_department_number', 120)->nullable()->after('ad_department');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn([
                'ad_department',
                'ad_department_number',
            ]);
        });
    }
};
