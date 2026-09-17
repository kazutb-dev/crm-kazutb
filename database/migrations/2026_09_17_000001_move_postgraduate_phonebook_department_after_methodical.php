<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const TARGET_DEPARTMENT = 'ОТДЕЛ ПОСЛЕВУЗОВСКОГО ОБРАЗОВАНИЯ';

    private const DESIRED_PREVIOUS_DEPARTMENT = 'МЕТОДИЧЕСКИЙ ОТДЕЛ';

    private const ORIGINAL_PREVIOUS_DEPARTMENT = 'ОТДЕЛ НАУКИ И КОММЕРЦИАЛИЗАЦИИ';

    public function up(): void
    {
        $this->moveDepartmentAfter(self::TARGET_DEPARTMENT, self::DESIRED_PREVIOUS_DEPARTMENT);
    }

    public function down(): void
    {
        $this->moveDepartmentAfter(self::TARGET_DEPARTMENT, self::ORIGINAL_PREVIOUS_DEPARTMENT);
    }

    private function moveDepartmentAfter(string $targetDepartmentName, string $anchorDepartmentName): void
    {
        DB::transaction(function () use ($targetDepartmentName, $anchorDepartmentName): void {
            $departmentIds = DB::table('phonebook_departments')
                ->whereIn('name', [$targetDepartmentName, $anchorDepartmentName])
                ->pluck('id', 'name');

            $targetDepartmentId = $departmentIds->get($targetDepartmentName);
            $anchorDepartmentId = $departmentIds->get($anchorDepartmentName);

            if ($targetDepartmentId === null || $anchorDepartmentId === null) {
                throw new RuntimeException('Required phonebook departments were not found.');
            }

            /** @var Collection<int, object> $orderedUsers */
            $orderedUsers = DB::table('phonebook_users')
                ->whereNotNull('sort_order')
                ->orderBy('sort_order')
                ->orderBy('full_name')
                ->orderBy('id')
                ->lockForUpdate()
                ->get(['id', 'department_id', 'sort_order']);

            $targetUsers = $orderedUsers
                ->filter(fn (object $user): bool => (int) $user->department_id === (int) $targetDepartmentId)
                ->values();

            if ($targetUsers->isEmpty()) {
                throw new RuntimeException('The target phonebook department has no ordered users.');
            }

            $remainingUsers = $orderedUsers
                ->reject(fn (object $user): bool => (int) $user->department_id === (int) $targetDepartmentId)
                ->values();

            $anchorIndex = $remainingUsers->search(
                fn (object $user): bool => (int) $user->department_id === (int) $anchorDepartmentId
            );

            if ($anchorIndex === false) {
                throw new RuntimeException('The anchor phonebook department has no ordered users.');
            }

            while (isset($remainingUsers[$anchorIndex + 1])
                && (int) $remainingUsers[$anchorIndex + 1]->department_id === (int) $anchorDepartmentId) {
                $anchorIndex++;
            }

            $remainingUsers->splice($anchorIndex + 1, 0, $targetUsers->all());

            $temporaryOffset = ((int) $orderedUsers->max('sort_order')) + $orderedUsers->count() + 1000;

            DB::table('phonebook_users')
                ->whereIn('id', $orderedUsers->pluck('id'))
                ->increment('sort_order', $temporaryOffset);

            foreach ($remainingUsers as $sortOrder => $user) {
                DB::table('phonebook_users')
                    ->where('id', $user->id)
                    ->update(['sort_order' => $sortOrder]);
            }
        });
    }
};
