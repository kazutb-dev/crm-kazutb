<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('academic_mobility_applications', function (Blueprint $table): void {
            $table->json('document_files')->nullable()->after('document_types');
        });
    }

    public function down(): void
    {
        Schema::table('academic_mobility_applications', function (Blueprint $table): void {
            $table->dropColumn('document_files');
        });
    }
};
