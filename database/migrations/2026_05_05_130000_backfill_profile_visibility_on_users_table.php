<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users') || ! Schema::hasColumn('users', 'profile_visibility')) {
            return;
        }

        DB::table('users')
            ->whereNull('profile_visibility')
            ->update(['profile_visibility' => 'internal']);
    }

    public function down(): void
    {
        // Leave normalized visibility values in place.
    }
};