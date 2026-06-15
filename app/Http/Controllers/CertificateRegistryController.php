<?php

namespace App\Http\Controllers;

use App\Models\Certificate;
use App\Models\CertificateNumberSequence;
use App\Models\CertificateTemplateVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class CertificateRegistryController extends Controller
{
    public function page(Request $request): InertiaResponse
    {
        $this->ensureCertificatesAccess($request);

        $templates = CertificateTemplateVersion::query()
            ->with(['template:id,name,code,is_active'])
            ->where('is_published', true)
            ->whereHas('template', function ($query): void {
                $query->where('is_active', true);
            })
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->get()
            ->map(function (CertificateTemplateVersion $version): array {
                return [
                    'id' => $version->id,
                    'template_id' => $version->template_id,
                    'template_name' => $version->template?->name,
                    'template_code' => $version->template?->code,
                    'version' => $version->version,
                    'auto_topic' => $version->template?->name,
                    'background_url' => $version->background_path
                        ? '/storage/' . ltrim((string) $version->background_path, '/')
                        : null,
                    'canvas_width' => (int) ($version->canvas_width ?? 1600),
                    'canvas_height' => (int) ($version->canvas_height ?? 1131),
                    'layout_json' => is_array($version->layout_json) ? $version->layout_json : [],
                    'published_at_human' => optional($version->published_at)?->format('d.m.Y H:i'),
                ];
            })
            ->values();

        return Inertia::render('Certificates/Generate', [
            'templates' => $templates,
        ]);
    }

    public function registryPage(Request $request): InertiaResponse
    {
        $this->ensureCertificatesAccess($request);

        return Inertia::render('Certificates/Registry');
    }

    public function show(Request $request, Certificate $certificate): InertiaResponse
    {
        $this->ensureCertificatesAccess($request);

        $certificate->load([
            'template:id,name,code',
            'templateVersion:id,template_id,version,background_path,canvas_width,canvas_height,layout_json',
        ]);

        return Inertia::render('Certificates/Show', [
            'certificate' => [
                'id' => $certificate->id,
                'certificate_number' => $certificate->certificate_number,
                'recipient_full_name' => $certificate->recipient_full_name,
                'topic' => $certificate->topic,
                'status' => $certificate->status,
                'issued_at_human' => optional($certificate->issued_at)?->format('d.m.Y H:i'),
                'generated_at_human' => optional($certificate->generated_at)?->format('d.m.Y H:i'),
                'template_name' => $certificate->template?->name,
                'template_code' => $certificate->template?->code,
                'template_version' => $certificate->templateVersion?->version,
                'template_background_url' => $certificate->templateVersion?->background_path
                    ? '/storage/' . ltrim((string) $certificate->templateVersion?->background_path, '/')
                    : null,
                'template_canvas_width' => (int) ($certificate->templateVersion?->canvas_width ?? 1600),
                'template_canvas_height' => (int) ($certificate->templateVersion?->canvas_height ?? 1131),
                'template_layout' => $this->resolveCertificateLayout($certificate),
                'qr_payload' => $certificate->qr_payload,
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureCertificatesAccess($request);

        $perPage = min(max((int) $request->query('per_page', 20), 1), 200);
        $query = trim((string) $request->query('q', ''));
        $status = trim((string) $request->query('status', ''));

        $certificates = $this->buildFilteredQuery($query, $status)
            ->with([
                'template:id,name,code',
                'templateVersion:id,template_id,version',
                'createdBy:id,name,display_name,email',
            ])
            ->latest('id')
            ->paginate($perPage)
            ->through(function (Certificate $certificate): array {
                return [
                    'id' => $certificate->id,
                    'certificate_number' => $certificate->certificate_number,
                    'recipient_full_name' => $certificate->recipient_full_name,
                    'topic' => $certificate->topic,
                    'qr_payload' => $certificate->qr_payload,
                    'status' => $certificate->status,
                    'issued_at_human' => optional($certificate->issued_at)?->format('d.m.Y H:i'),
                    'generated_at_human' => optional($certificate->generated_at)?->format('d.m.Y H:i'),
                    'template_name' => $certificate->template?->name,
                    'template_code' => $certificate->template?->code,
                    'template_version' => $certificate->templateVersion?->version,
                    'creator_name' => $certificate->createdBy?->display_name
                        ?? $certificate->createdBy?->name,
                ];
            })
            ->withQueryString();

        return response()->json([
            'data' => $certificates->items(),
            'meta' => [
                'current_page' => $certificates->currentPage(),
                'last_page' => $certificates->lastPage(),
                'per_page' => $certificates->perPage(),
                'total' => $certificates->total(),
            ],
            'filters' => [
                'q' => $query,
                'status' => $status,
            ],
        ]);
    }

    public function generate(Request $request): JsonResponse
    {
        $this->ensureCertificatesAccess($request);

        $data = $request->validate([
            'recipient_full_name' => ['required', 'string', 'max:255'],
            'topic' => ['required', 'string', 'max:255'],
            'template_version_id' => ['nullable', 'integer', 'exists:certificate_template_versions,id'],
            'layout_override' => ['nullable', 'array'],
        ]);

        $certificate = DB::transaction(function () use ($request, $data): Certificate {
            $templateVersion = $this->resolveTemplateVersion($data['template_version_id'] ?? null);
            $templateCode = (string) ($templateVersion->template?->code ?? 'CERT');
            $prefix = $this->normalizePrefix($templateCode);
            $year = (int) now()->format('Y');
            $number = $this->nextCertificateNumber($prefix, $year);

            return Certificate::query()->create([
                'template_id' => $templateVersion->template_id,
                'template_version_id' => $templateVersion->id,
                'certificate_number' => $number,
                'recipient_full_name' => trim((string) $data['recipient_full_name']),
                'topic' => trim((string) $data['topic']),
                'optional_json' => is_array($data['layout_override'] ?? null)
                    ? ['layout_override' => $data['layout_override']]
                    : null,
                'qr_payload' => route('certificates.verify', ['certificateNumber' => $number]),
                'status' => Certificate::STATUS_GENERATED,
                'generated_at' => now(),
                'created_by' => $request->user()?->id,
                'updated_by' => $request->user()?->id,
            ]);
        });

        return response()->json([
            'message' => 'Сертификат сгенерирован.',
            'certificate' => [
                'id' => $certificate->id,
                'certificate_number' => $certificate->certificate_number,
                'qr_payload' => $certificate->qr_payload,
                'status' => $certificate->status,
            ],
        ]);
    }

    public function bulkGenerate(Request $request): JsonResponse
    {
        $this->ensureCertificatesAccess($request);

        $data = $request->validate([
            'recipients'           => ['required', 'array', 'min:1', 'max:500'],
            'recipients.*'         => ['required', 'string', 'max:255'],
            'topic'                => ['required', 'string', 'max:255'],
            'template_version_id'  => ['nullable', 'integer', 'exists:certificate_template_versions,id'],
            'layout_override'      => ['nullable', 'array'],
        ]);

        $templateVersion = $this->resolveTemplateVersion($data['template_version_id'] ?? null);
        $templateCode    = (string) ($templateVersion->template?->code ?? 'CERT');
        $prefix          = $this->normalizePrefix($templateCode);
        $year            = (int) now()->format('Y');

        $generated = DB::transaction(function () use ($request, $data, $templateVersion, $prefix, $year): array {
            $results = [];

            foreach ($data['recipients'] as $name) {
                $name = trim((string) $name);
                if ($name === '') {
                    continue;
                }

                $number = $this->nextCertificateNumber($prefix, $year);

                $cert = Certificate::query()->create([
                    'template_id'          => $templateVersion->template_id,
                    'template_version_id'  => $templateVersion->id,
                    'certificate_number'   => $number,
                    'recipient_full_name'  => $name,
                    'topic'                => trim((string) $data['topic']),
                    'optional_json'        => is_array($data['layout_override'] ?? null)
                        ? ['layout_override' => $data['layout_override']]
                        : null,
                    'qr_payload'           => route('certificates.verify', ['certificateNumber' => $number]),
                    'status'               => Certificate::STATUS_GENERATED,
                    'generated_at'         => now(),
                    'created_by'           => $request->user()?->id,
                    'updated_by'           => $request->user()?->id,
                ]);

                $results[] = [
                    'id'                   => $cert->id,
                    'certificate_number'   => $cert->certificate_number,
                    'recipient_full_name'  => $cert->recipient_full_name,
                    'qr_payload'           => $cert->qr_payload,
                ];
            }

            return $results;
        });

        return response()->json([
            'message'      => 'Сертификаты сгенерированы: ' . count($generated),
            'count'        => count($generated),
            'certificates' => $generated,
        ]);
    }

    public function issue(Request $request, Certificate $certificate): JsonResponse
    {
        $this->ensureCertificatesAccess($request);

        if ($certificate->status !== Certificate::STATUS_GENERATED) {
            return response()->json([
                'message' => 'Выдать можно только сертификат со статусом "Сгенерирован".',
            ], 422);
        }

        $certificate->update([
            'status' => Certificate::STATUS_ISSUED,
            'issued_at' => now(),
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json([
            'message' => 'Сертификат помечен как выданный.',
            'status' => $certificate->status,
        ]);
    }

    public function revoke(Request $request, Certificate $certificate): JsonResponse
    {
        $this->ensureCertificatesAccess($request);

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        if (! in_array($certificate->status, [Certificate::STATUS_GENERATED, Certificate::STATUS_ISSUED], true)) {
            return response()->json([
                'message' => 'Отозвать можно только сертификат со статусом "Сгенерирован" или "Выдан".',
            ], 422);
        }

        $certificate->update([
            'status' => Certificate::STATUS_REVOKED,
            'revoked_at' => now(),
            'revoked_reason' => trim((string) ($data['reason'] ?? '')) ?: null,
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json([
            'message' => 'Сертификат отозван.',
            'status' => $certificate->status,
        ]);
    }

    public function exportCsv(Request $request): Response
    {
        $this->ensureCertificatesAccess($request);

        $query = trim((string) $request->query('q', ''));
        $status = trim((string) $request->query('status', ''));

        $items = $this->buildFilteredQuery($query, $status)
            ->orderBy('id', 'desc')
            ->limit(5000)
            ->get([
                'certificate_number',
                'recipient_full_name',
                'topic',
                'status',
                'issued_at',
                'generated_at',
            ]);

        $filename = 'certificates_registry_' . now()->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () use ($items): void {
            $handle = fopen('php://output', 'wb');

            if (! $handle) {
                return;
            }

            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['Number', 'Full name', 'Topic', 'Status', 'Issued at', 'Generated at']);

            foreach ($items as $item) {
                fputcsv($handle, [
                    $item->certificate_number,
                    $item->recipient_full_name,
                    $item->topic,
                    $item->status,
                    optional($item->issued_at)?->format('Y-m-d H:i:s'),
                    optional($item->generated_at)?->format('Y-m-d H:i:s'),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function verify(Request $request, string $certificateNumber): JsonResponse|InertiaResponse
    {
        $certificate = Certificate::query()
            ->with([
                'template:id,name,code',
                'templateVersion:id,template_id,version,background_path,canvas_width,canvas_height,layout_json',
            ])
            ->select([
                'id',
                'template_id',
                'template_version_id',
                'certificate_number',
                'recipient_full_name',
                'topic',
                'qr_payload',
                'status',
                'issued_at',
                'generated_at',
                'revoked_at',
                'optional_json',
            ])
            ->where('certificate_number', $certificateNumber)
            ->first();

        if (! $certificate) {
            if ($request->expectsJson()) {
                return response()->json([
                    'valid' => false,
                    'status' => 'not_found',
                    'message' => 'Сертификат не найден.',
                ], 404);
            }

            return Inertia::render('Certificates/Verify', [
                'valid' => false,
                'status' => 'not_found',
                'message' => 'Сертификат не найден.',
                'certificate' => null,
            ]);
        }

        if (! $request->expectsJson()) {
            return Inertia::render('Certificates/Verify', [
                'valid' => $certificate->status !== Certificate::STATUS_REVOKED,
                'status' => $certificate->status,
                'message' => $certificate->status === Certificate::STATUS_REVOKED
                    ? 'Сертификат отозван.'
                    : 'Сертификат действителен.',
                'certificate' => [
                    'id' => $certificate->id,
                    'certificate_number' => $certificate->certificate_number,
                    'recipient_full_name' => $certificate->recipient_full_name,
                    'topic' => $certificate->topic,
                    'status' => $certificate->status,
                    'issued_at_human' => optional($certificate->issued_at)?->format('d.m.Y H:i'),
                    'generated_at_human' => optional($certificate->generated_at)?->format('d.m.Y H:i'),
                    'template_name' => $certificate->template?->name,
                    'template_code' => $certificate->template?->code,
                    'template_version' => $certificate->templateVersion?->version,
                    'template_background_url' => $certificate->templateVersion?->background_path
                        ? '/storage/' . ltrim((string) $certificate->templateVersion?->background_path, '/')
                        : null,
                    'template_canvas_width' => (int) ($certificate->templateVersion?->canvas_width ?? 1600),
                    'template_canvas_height' => (int) ($certificate->templateVersion?->canvas_height ?? 1131),
                    'template_layout' => $this->resolveCertificateLayout($certificate),
                    'qr_payload' => $certificate->qr_payload,
                    'revoked_at_human' => optional($certificate->revoked_at)?->format('d.m.Y H:i'),
                ],
            ]);
        }

        return response()->json([
            'valid' => $certificate->status !== Certificate::STATUS_REVOKED,
            'status' => $certificate->status,
            'certificate' => [
                'full_name' => $certificate->recipient_full_name,
                'topic' => $certificate->topic,
                'number' => $certificate->certificate_number,
                'issued_at' => optional($certificate->issued_at)?->toAtomString(),
                'revoked_at' => optional($certificate->revoked_at)?->toAtomString(),
            ],
        ]);
    }

    private function ensureCertificatesAccess(Request $request): void
    {
        $user = $request->user();
        $role = $user?->resolvedRoleSlug();
        $email = mb_strtolower(trim((string) ($user?->email ?? '')));
        $allowedEmails = [
            'a.khastayeva@kaztbu.edu.kz',
        ];
        $hasRoleAccess = in_array($role, ['admin', 'superadmin', 'super_admin', 'certificates'], true);
        $hasEmailAccess = in_array($email, $allowedEmails, true);

        abort_unless($hasRoleAccess || $hasEmailAccess, 403);
    }

    private function resolveTemplateVersion(?int $templateVersionId): CertificateTemplateVersion
    {
        if ($templateVersionId) {
            return CertificateTemplateVersion::query()
                ->with('template:id,name,code,is_active')
                ->where('id', $templateVersionId)
                ->where('is_published', true)
                ->whereHas('template', function ($query): void {
                    $query->where('is_active', true);
                })
                ->firstOrFail();
        }

        return CertificateTemplateVersion::query()
            ->with('template:id,name,code,is_active')
            ->where('is_published', true)
            ->whereHas('template', function ($query): void {
                $query->where('is_active', true);
            })
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->firstOrFail();
    }

    private function normalizePrefix(string $code): string
    {
        $normalized = strtoupper(preg_replace('/[^A-Z0-9]/', '', $code) ?? '');

        if ($normalized === '') {
            return 'CERT';
        }

        return substr($normalized, 0, 12);
    }

    private function nextCertificateNumber(string $prefix, int $year): string
    {
        $sequence = CertificateNumberSequence::query()
            ->where('prefix', $prefix)
            ->where('year', $year)
            ->lockForUpdate()
            ->first();

        if (! $sequence) {
            CertificateNumberSequence::query()->create([
                'prefix' => $prefix,
                'year' => $year,
                'last_number' => 0,
            ]);

            $sequence = CertificateNumberSequence::query()
                ->where('prefix', $prefix)
                ->where('year', $year)
                ->lockForUpdate()
                ->firstOrFail();
        }

        $next = ((int) $sequence->last_number) + 1;
        $sequence->update(['last_number' => $next]);

        return sprintf('%s-%d-%04d', $prefix, $year, $next);
    }

    private function buildFilteredQuery(string $query, string $status)
    {
        return Certificate::query()
            ->when($query !== '', function ($builder) use ($query): void {
                $builder->where(function ($nested) use ($query): void {
                    $nested
                        ->where('certificate_number', 'like', "%{$query}%")
                        ->orWhere('recipient_full_name', 'like', "%{$query}%")
                        ->orWhere('topic', 'like', "%{$query}%");
                });
            })
            ->when($status !== '', function ($builder) use ($status): void {
                $builder->where('status', $status);
            });
    }

    private function resolveCertificateLayout(Certificate $certificate): array
    {
        $override = $certificate->optional_json['layout_override'] ?? null;
        if (is_array($override)) {
            return $override;
        }

        return is_array($certificate->templateVersion?->layout_json)
            ? $certificate->templateVersion?->layout_json
            : [];
    }
}
