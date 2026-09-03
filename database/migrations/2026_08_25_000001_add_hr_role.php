<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $hrRoleId = DB::table('roles')
            ->where('slug', 'hr')
            ->value('id');

        if ($hrRoleId === null) {
            $hrRoleId = DB::table('roles')->insertGetId([
                'name' => 'HR',
                'slug' => 'hr',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('users')
            ->whereIn('role', ['HR', 'hr'])
            ->update([
                'role' => 'hr',
                'role_id' => $hrRoleId,
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $hrRoleId = DB::table('roles')->where('slug', 'hr')->value('id');

        if ($hrRoleId !== null) {
            DB::table('users')->where('role_id', $hrRoleId)->update(['role_id' => null]);
            DB::table('roles')->where('id', $hrRoleId)->delete();
        }
    }
};
