<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('certificates', function (Blueprint $table): void {
            $table->foreignId('issued_to_user_id')
                ->nullable()
                ->after('template_version_id')
                ->constrained('users')
                ->nullOnDelete();

            $table->index(['issued_to_user_id', 'issued_at'], 'certificates_issued_to_user_id_issued_at_index');
        });
    }

    public function down(): void
    {
        Schema::table('certificates', function (Blueprint $table): void {
            $table->dropIndex('certificates_issued_to_user_id_issued_at_index');
            $table->dropConstrainedForeignId('issued_to_user_id');
        });
    }
};
