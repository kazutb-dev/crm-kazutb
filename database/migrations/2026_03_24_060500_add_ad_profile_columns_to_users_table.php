<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('first_name', 120)->nullable()->after('name');
            $table->string('last_name', 120)->nullable()->after('first_name');
            $table->string('initials', 40)->nullable()->after('last_name');
            $table->string('display_name', 190)->nullable()->after('initials');
            $table->string('ad_description', 255)->nullable()->after('display_name');
            $table->string('room', 50)->nullable()->after('ad_description');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn([
                'first_name',
                'last_name',
                'initials',
                'display_name',
                'ad_description',
                'room',
            ]);
        });
    }
};
