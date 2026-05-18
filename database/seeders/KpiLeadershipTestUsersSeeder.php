<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class KpiLeadershipTestUsersSeeder extends Seeder
{
    /**
     * Seed test users for all deans and heads of departments.
     */
    public function run(): void
    {
        Role::query()->firstOrCreate(
            ['slug' => 'dean'],
            ['name' => 'Dean']
        );

        foreach ($this->leadershipList() as $leader) {
            $roleSlug = (string) $leader['target_role_slug'];
            $roleId = Role::query()->where('slug', $roleSlug)->value('id');

            if (! $roleId) {
                $this->command?->warn("Role not found for {$leader['full_name']}: {$roleSlug}");
                continue;
            }

            $facultyCode = (string) $leader['faculty_code'];
            $departmentCode = $leader['department_code'] !== null ? (string) $leader['department_code'] : null;

            $faculty = Faculty::query()
                ->where('code', $facultyCode)
                ->orWhere('name', (string) $leader['faculty_name'])
                ->first();
            $department = null;

            if ($departmentCode !== null) {
                $department = Department::query()
                    ->where('code', $departmentCode)
                    ->orWhere('name', (string) $leader['department_name'])
                    ->first();
            }

            if (! $faculty) {
                $this->command?->warn("Faculty not found for {$leader['full_name']}: {$leader['faculty_name']}");
                continue;
            }

            if ($leader['department_name'] !== null && ! $department) {
                $this->command?->warn("Department not found for {$leader['full_name']}: {$leader['department_name']}");
                continue;
            }

            $login = 'test_' . Str::slug((string) $leader['full_name'], '_');
            $email = $login . '@kaztbu.edu.kz';

            $user = User::query()->updateOrCreate(
                ['ad_login' => $login],
                [
                    'name' => (string) $leader['full_name'],
                    'display_name' => (string) $leader['full_name'],
                    'email' => $email,
                    'password' => Hash::make('password'),
                    'role' => $roleSlug,
                    'role_id' => (int) $roleId,
                    'faculty_id' => (int) $faculty->id,
                    'department_id' => $department?->id,
                    'email_verified_at' => now(),
                ]
            );

            $this->command?->info("Created/updated test user: {$user->name} ({$login})");
        }
    }

    /**
     * @return array<int, array<string, string|null>>
     */
    private function leadershipList(): array
    {
        return [
            [
                'full_name' => 'Сафуани Жанар Есенқұлқызы',
                'faculty_code' => 'TF',
                'faculty_name' => 'Технологический факультет',
                'department_code' => null,
                'department_name' => null,
                'target_role_slug' => 'dean',
            ],
            [
                'full_name' => 'Оразов Аян Жарилкасинович',
                'faculty_code' => 'TF',
                'faculty_name' => 'Технологический факультет',
                'department_code' => 'TST',
                'department_name' => 'Технология и стандартизация',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Байжанова Жазира Болатбековна',
                'faculty_code' => 'TF',
                'faculty_name' => 'Технологический факультет',
                'department_code' => 'TLPD',
                'department_name' => 'Технология легкой промышленности и дизайна',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Магауянов Даурен Абильтаевич',
                'faculty_code' => 'TF',
                'faculty_name' => 'Технологический факультет',
                'department_code' => 'SHD',
                'department_name' => 'Социально-гуманитарные дисциплины',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Мақыш Мулдир Кикбаевна',
                'faculty_code' => 'FEB',
                'faculty_name' => 'Факультет экономики и бизнеса',
                'department_code' => null,
                'department_name' => null,
                'target_role_slug' => 'dean',
            ],
            [
                'full_name' => 'Жунусова Алия Анархановна',
                'faculty_code' => 'FEB',
                'faculty_name' => 'Факультет экономики и бизнеса',
                'department_code' => 'TS',
                'department_name' => 'Туризм и сервис',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Абдильдинова Найля Ермухановна',
                'faculty_code' => 'FEB',
                'faculty_name' => 'Факультет экономики и бизнеса',
                'department_code' => 'EU',
                'department_name' => 'Экономика и управление',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Бекбусинова Гульнафиз Кенжебековна',
                'faculty_code' => 'FEB',
                'faculty_name' => 'Факультет экономики и бизнеса',
                'department_code' => 'FA',
                'department_name' => 'Финансы и учет',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Канафиева Куланда Кабылсеитовна',
                'faculty_code' => 'FEB',
                'faculty_name' => 'Факультет экономики и бизнеса',
                'department_code' => 'GIY',
                'department_name' => 'Государственный и иностранные языки',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Серимбетов Булат Абуталибович',
                'faculty_code' => 'FEIT',
                'faculty_name' => 'Факультет инжиниринга и информационных технологий',
                'department_code' => null,
                'department_name' => null,
                'target_role_slug' => 'dean',
            ],
            [
                'full_name' => 'Абдукаримова Алия Амировна',
                'faculty_code' => 'FEIT',
                'faculty_name' => 'Факультет инжиниринга и информационных технологий',
                'department_code' => 'IT',
                'department_name' => 'Информационные технологии',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Акишев Каршыга Максутович',
                'faculty_code' => 'FEIT',
                'faculty_name' => 'Факультет инжиниринга и информационных технологий',
                'department_code' => 'KIA',
                'department_name' => 'Компьютерная инженерия и автоматизация',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Нұртай Жадыра Тастенбековна',
                'faculty_code' => 'FEIT',
                'faculty_name' => 'Факультет инжиниринга и информационных технологий',
                'department_code' => 'HHTE',
                'department_name' => 'Химия, химическая технология и экология',
                'target_role_slug' => 'hod',
            ],
        ];
    }
}