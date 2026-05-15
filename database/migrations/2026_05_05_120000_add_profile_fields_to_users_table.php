<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'phone')) {
                $table->string('phone', 30)->nullable()->after('email');
            }

            if (! Schema::hasColumn('users', 'position_title')) {
                $table->string('position_title', 255)->nullable();
            }

            if (! Schema::hasColumn('users', 'office_location')) {
                $table->string('office_location', 255)->nullable();
            }

            if (! Schema::hasColumn('users', 'telegram')) {
                $table->string('telegram', 100)->nullable();
            }

            if (! Schema::hasColumn('users', 'bio')) {
                $table->text('bio')->nullable();
            }

            if (! Schema::hasColumn('users', 'avatar_url')) {
                $table->string('avatar_url', 2048)->nullable();
            }

            if (! Schema::hasColumn('users', 'profile_visibility')) {
                $table->string('profile_visibility', 30)->nullable()->default('internal');
            }

            if (! Schema::hasColumn('users', 'updated_profile_at')) {
                $table->timestamp('updated_profile_at')->nullable();
            }

            if (! Schema::hasColumn('users', 'profile_completed_at')) {
                $table->timestamp('profile_completed_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'profile_completed_at')) {
                $table->dropColumn('profile_completed_at');
            }

            if (Schema::hasColumn('users', 'updated_profile_at')) {
                $table->dropColumn('updated_profile_at');
            }

            if (Schema::hasColumn('users', 'profile_visibility')) {
                $table->dropColumn('profile_visibility');
            }

            if (Schema::hasColumn('users', 'avatar_url')) {
                $table->dropColumn('avatar_url');
            }

            if (Schema::hasColumn('users', 'bio')) {
                $table->dropColumn('bio');
            }

            if (Schema::hasColumn('users', 'telegram')) {
                $table->dropColumn('telegram');
            }

            if (Schema::hasColumn('users', 'office_location')) {
                $table->dropColumn('office_location');
            }

            if (Schema::hasColumn('users', 'position_title')) {
                $table->dropColumn('position_title');
            }

            if (Schema::hasColumn('users', 'phone')) {
                $table->dropColumn('phone');
            }
        });
    }
};