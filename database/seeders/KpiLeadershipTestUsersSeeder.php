<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\KpiStructuralUnit;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class KpiLeadershipTestUsersSeeder extends Seeder
{
    /** @var list<string> */
    private array $ppsTitles = [
        'Ассистент',
        'Лектор',
        'Сеньор-лектор',
    ];

    /**
     * Seed test users for all deans and heads of departments.
     */
    public function run(): void
    {
        Role::query()->firstOrCreate(
            ['slug' => 'dean'],
            ['name' => 'Dean']
        );

        Role::query()->firstOrCreate(
            ['slug' => 'teacher'],
            ['name' => 'Teacher']
        );

        Role::query()->firstOrCreate(
            ['slug' => 'structural'],
            ['name' => 'Structural']
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

        $this->seedPpsForEachDepartment();
        $this->seedStructuralTestUsersFromSystem();
    }

    private function seedPpsForEachDepartment(): void
    {
        $teacherRoleId = Role::query()->where('slug', 'teacher')->value('id');
        if (! $teacherRoleId) {
            $this->command?->warn('Teacher role not found. Skipping PPS seed.');
            return;
        }

        $departments = Department::query()
            ->whereNotNull('faculty_id')
            ->orderBy('id')
            ->get(['id', 'faculty_id', 'name', 'code']);

        foreach ($departments as $department) {
            $departmentCode = Str::lower((string) ($department->code ?: 'dept' . $department->id));
            $departmentCode = Str::slug($departmentCode, '_');

            for ($i = 1; $i <= 2; $i++) {
                $login = "test_pps_{$departmentCode}_{$i}";
                $email = $login . '@kaztbu.edu.kz';
                $name = "Тест ППС {$department->name} {$i}";
                $title = $this->ppsTitles[($i - 1) % count($this->ppsTitles)];

                $user = User::query()->updateOrCreate(
                    ['ad_login' => $login],
                    [
                        'name' => $name,
                        'display_name' => $name,
                        'email' => $email,
                        'password' => Hash::make('password'),
                        'role' => 'teacher',
                        'role_id' => (int) $teacherRoleId,
                        'faculty_id' => (int) $department->faculty_id,
                        'department_id' => (int) $department->id,
                        'position_title' => $title,
                        'ad_title' => $title,
                        'email_verified_at' => now(),
                    ]
                );

                $this->command?->info("Created/updated PPS user: {$user->name} ({$login})");
            }
        }
    }

    private function seedStructuralTestUsersFromSystem(): void
    {
        $structuralRoleId = Role::query()->where('slug', 'structural')->value('id');
        if (! $structuralRoleId) {
            $this->command?->warn('Structural role not found. Skipping structural test users seed.');
            return;
        }

        $units = KpiStructuralUnit::query()
            ->with(['users' => fn ($q) => $q->orderBy('users.id')])
            ->orderBy('id')
            ->get(['id', 'code', 'name']);

        foreach ($units as $unit) {
            $sourceUsers = $unit->users->values();

            if ($sourceUsers->isEmpty()) {
                $unitCodeSlug = Str::slug(Str::lower((string) ($unit->code ?: 'unit' . $unit->id)), '_');
                $login = "test_structural_{$unitCodeSlug}_1";
                $email = $login . '@kaztbu.edu.kz';
                $name = "Тест СП {$unit->name} 1";

                $user = User::query()->updateOrCreate(
                    ['ad_login' => $login],
                    [
                        'name' => $name,
                        'display_name' => $name,
                        'email' => $email,
                        'password' => Hash::make('password'),
                        'role' => 'structural',
                        'role_id' => (int) $structuralRoleId,
                        'faculty_id' => null,
                        'department_id' => null,
                        'position_title' => 'Руководитель структурного подразделения',
                        'ad_title' => 'Руководитель структурного подразделения',
                        'ad_department' => $unit->name,
                        'ad_division' => $unit->code,
                        'email_verified_at' => now(),
                    ]
                );

                $user->kpiStructuralUnits()->syncWithoutDetaching([$unit->id]);

                $this->command?->info("Created/updated fallback structural test user: {$user->name} ({$login}) -> {$unit->code}");
                continue;
            }

            $unitCodeSlug = Str::slug(Str::lower((string) ($unit->code ?: 'unit' . $unit->id)), '_');

            foreach ($sourceUsers as $index => $sourceUser) {
                $sequence = $index + 1;
                $login = "test_structural_{$unitCodeSlug}_{$sequence}";
                $email = $login . '@kaztbu.edu.kz';
                $name = "Тест СП {$unit->name} {$sequence}";

                $user = User::query()->updateOrCreate(
                    ['ad_login' => $login],
                    [
                        'name' => $name,
                        'display_name' => $name,
                        'email' => $email,
                        'password' => Hash::make('password'),
                        'role' => 'structural',
                        'role_id' => (int) $structuralRoleId,
                        'faculty_id' => $sourceUser->faculty_id,
                        'department_id' => $sourceUser->department_id,
                        'position_title' => 'Руководитель структурного подразделения',
                        'ad_title' => 'Руководитель структурного подразделения',
                        'ad_department' => $sourceUser->ad_department,
                        'ad_division' => $sourceUser->ad_division,
                        'email_verified_at' => now(),
                    ]
                );

                $user->kpiStructuralUnits()->syncWithoutDetaching([$unit->id]);

                $this->command?->info("Created/updated structural test user: {$user->name} ({$login}) -> {$unit->code}");
            }
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
                'faculty_name' => 'Факультет «Технология и инжиниринг»',
                'department_code' => null,
                'department_name' => null,
                'target_role_slug' => 'dean',
            ],
            [
                'full_name' => 'Оразов Аян Жарилкасинович',
                'faculty_code' => 'TF',
                'faculty_name' => 'Факультет «Технология и инжиниринг»',
                'department_code' => 'TST',
                'department_name' => 'Технология и стандартизация',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Байжанова Жазира Болатбековна',
                'faculty_code' => 'TF',
                'faculty_name' => 'Факультет «Технология и инжиниринг»',
                'department_code' => 'TLPD',
                'department_name' => 'Технология легкой промышленности и дизайна',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Акишев Каршыга Максутович',
                'faculty_code' => 'TF',
                'faculty_name' => 'Факультет «Технология и инжиниринг»',
                'department_code' => 'KIA',
                'department_name' => 'Автоматизация и инженерных систем',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Мақыш Мулдир Кикбаевна',
                'faculty_code' => 'FEB',
                'faculty_name' => 'Факультет «Экономика и бизнес»',
                'department_code' => null,
                'department_name' => null,
                'target_role_slug' => 'dean',
            ],
            [
                'full_name' => 'Жунусова Алия Анархановна',
                'faculty_code' => 'FEB',
                'faculty_name' => 'Факультет «Экономика и бизнес»',
                'department_code' => 'TS',
                'department_name' => 'Туризм и сервис',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Абдильдинова Найля Ермухановна',
                'faculty_code' => 'FEB',
                'faculty_name' => 'Факультет «Экономика и бизнес»',
                'department_code' => 'EU',
                'department_name' => 'Менеджмент',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Бекбусинова Гульнафиз Кенжебековна',
                'faculty_code' => 'FEB',
                'faculty_name' => 'Факультет «Экономика и бизнес»',
                'department_code' => 'FA',
                'department_name' => 'Экономика и финансы',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Канафиева Куланда Кабылсеитовна',
                'faculty_code' => 'FEB',
                'faculty_name' => 'Факультет «Экономика и бизнес»',
                'department_code' => 'GIY',
                'department_name' => 'Государственный и иностранные языки',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Серимбетов Булат Абуталибович',
                'faculty_code' => 'FEIT',
                'faculty_name' => 'Факультет «Инжиниринг и информационных технологий»',
                'department_code' => null,
                'department_name' => null,
                'target_role_slug' => 'dean',
            ],
            [
                'full_name' => 'Абдукаримова Алия Амировна',
                'faculty_code' => 'FEIT',
                'faculty_name' => 'Факультет «Инжиниринг и информационных технологий»',
                'department_code' => 'IT',
                'department_name' => 'Информационные технологии',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Магауянов Даурен Абильтаевич',
                'faculty_code' => 'FEIT',
                'faculty_name' => 'Факультет «Инжиниринг и информационных технологий»',
                'department_code' => 'SHD',
                'department_name' => 'Социально-гуманитарные дисциплины',
                'target_role_slug' => 'hod',
            ],
            [
                'full_name' => 'Нұртай Жадыра Тастенбековна',
                'faculty_code' => 'FEIT',
                'faculty_name' => 'Факультет «Инжиниринг и информационных технологий»',
                'department_code' => 'HHTE',
                'department_name' => 'Химическая технология и рационального природопользования',
                'target_role_slug' => 'hod',
            ],
        ];
    }
}