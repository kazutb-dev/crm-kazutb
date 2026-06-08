<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('phonebook_departments')) {
            Schema::create('phonebook_departments', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('legacy_id')->nullable()->unique();
                $table->string('name');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('phonebook_users')) {
            Schema::create('phonebook_users', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('legacy_id')->nullable()->unique();
                $table->foreignId('department_id')->nullable()->constrained('phonebook_departments')->nullOnDelete();
                $table->unsignedBigInteger('legacy_department_id')->nullable()->index();
                $table->string('full_name');
                $table->string('email')->nullable()->index();
                $table->string('phone')->nullable();
                $table->string('inner_phone')->nullable();
                $table->string('job_title')->nullable();
                $table->string('status', 50)->default('0');
                $table->text('avatar_url')->nullable();
                $table->string('office', 100)->nullable();
                $table->integer('sort_order')->nullable();
                $table->timestamps();

                $table->index('full_name');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('phonebook_users')) {
            Schema::drop('phonebook_users');
        }

        if (Schema::hasTable('phonebook_departments')) {
            Schema::drop('phonebook_departments');
        }
    }
};
