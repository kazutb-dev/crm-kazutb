<?php

namespace App\Console\Commands;

use App\Models\Student;
use App\Models\User;
use Illuminate\Console\Command;

class CreateStudentUsers extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'students:create-users';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create user accounts for all students';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $students = Student::all();
        $created = 0;

        foreach ($students as $student) {
            $user = User::where('email', $student->email)->first();
            
            if (!$user) {
                User::create([
                    'name' => $student->getFullNameAttribute(),
                    'email' => $student->email,
                    'password' => bcrypt('password123'),
                    'role' => 'student',
                    'email_verified_at' => now(),
                ]);
                $created++;
            }
        }

        $this->info("Создано пользователей: $created");
        $this->info("Всего пользователей: " . User::count());
    }
}
