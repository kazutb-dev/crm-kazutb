<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'last_login')) {
                $table->timestamp('last_login')->nullable()->after('last_login_at');
            }
        });

        if (Schema::hasColumn('users', 'last_login') && Schema::hasColumn('users', 'last_login_at')) {
            DB::table('users')
                ->whereNull('last_login')
                ->whereNotNull('last_login_at')
                ->update([
                    'last_login' => DB::raw('last_login_at'),
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'last_login')) {
                $table->dropColumn('last_login');
            }
        });
    }
};
