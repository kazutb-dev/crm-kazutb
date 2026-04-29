<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HrPercoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);

        $search = trim((string) $request->query('q', ''));
        $divRaw = $request->query('division', '');
        $divNorm = is_string($divRaw) ? trim($divRaw) : $divRaw;
        $divisionId = ($divNorm === null || $divNorm === '' || (string) $divNorm === '0') ? null : (int) $divNorm;
        $perPage = min(max((int) $request->integer('per_page', 50), 1), 200);

        $query = DB::connection('perco')
            ->table('user as u')
            ->leftJoin('user_staff as s', 's.user_id', '=', 'u.id')
            ->leftJoin('division as d', 'd.id', '=', 'u.division_id')
            ->leftJoin('position as p', 'p.id', '=', 'u.position_id')
            ->select([
                'u.id',
                'u.last_name',
                'u.first_name',
                'u.middle_name',
                'd.name as division',
                'p.name as position',
                's.tabel_number',
                's.hiring_date',
                's.dismissed_date',
                's.is_dismissed',
                'u.is_active',
                'u.is_block',
                'u.division_id',
            ])
            ->where('u.is_removed', 0)
            ->where('u.user_type_id', 1)
            ->whereNotNull('s.user_id')
            ->where('s.is_dismissed', 0);

        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function (QueryBuilder $q) use ($like): void {
                $q->where('u.last_name', 'like', $like)
                    ->orWhere('u.first_name', 'like', $like)
                    ->orWhere('u.middle_name', 'like', $like)
                    ->orWhere('s.tabel_number', 'like', $like);
            });
        }

        if ($divisionId !== null) {
            $query->where('u.division_id', $divisionId);
        }

        $staff = $query
            ->orderBy('d.name')
            ->orderBy('u.last_name')
            ->orderBy('u.first_name')
            ->paginate($perPage)
            ->appends($request->query());

        $staff->setCollection(
            $staff->getCollection()->map(function (object $row): array {
                return [
                    'id' => $row->id,
                    'last_name' => $row->last_name,
                    'first_name' => $row->first_name,
                    'middle_name' => $row->middle_name,
                    'full_name' => trim(implode(' ', array_filter([
                        $row->last_name,
                        $row->first_name,
                        $row->middle_name,
                    ]))),
                    'division' => $row->division,
                    'position' => $row->position,
                    'tabel_number' => $row->tabel_number,
                    'hiring_date' => $row->hiring_date,
                    'dismissed_date' => $row->dismissed_date,
                    'is_dismissed' => (int) $row->is_dismissed,
                    'is_active' => (int) $row->is_active,
                    'is_block' => (int) $row->is_block,
                    'division_id' => $row->division_id,
                ];
            })
        );

        return response()->json($staff);
    }

    private function ensureAdmin(Request $request): void
    {
        $role = $request->user()?->resolvedRoleSlug();

        abort_unless(in_array($role, ['admin', 'superadmin'], true), 403, 'Недостаточно прав.');
    }
}
