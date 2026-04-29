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
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('role_id')
                ->nullable()
                ->after('role')
                ->constrained('roles')
                ->nullOnDelete();
        });

        $roles = DB::table('roles')->pluck('id', 'slug');

        if ($roles->isEmpty()) {
            return;
        }

        DB::table('users')
            ->orderBy('id')
            ->chunkById(200, function ($users) use ($roles): void {
                foreach ($users as $user) {
                    $roleText = strtolower(trim((string) ($user->role ?? '')));
                    $statusText = strtolower(trim((string) ($user->status ?? '')));

                    $slug = match (true) {
                        in_array($roleText, ['admin', 'student', 'teacher', 'hod'], true) => $roleText,
                        $roleText === 'umo' => 'admin',
                        $roleText === 'department' => 'hod',
                        str_contains($statusText, 'student') || str_contains($statusText, 'студент') => 'student',
                        str_contains($statusText, 'teacher') || str_contains($statusText, 'преподав') || str_contains($statusText, 'pps') => 'teacher',
                        str_contains($statusText, 'hod') || str_contains($statusText, 'head') || str_contains($statusText, 'зав') => 'hod',
                        str_contains($statusText, 'admin') || str_contains($statusText, 'админ') => 'admin',
                        default => null,
                    };

                    if ($slug === null || !isset($roles[$slug])) {
                        continue;
                    }

                    DB::table('users')
                        ->where('id', $user->id)
                        ->update(['role_id' => $roles[$slug]]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('role_id');
        });
    }
};
