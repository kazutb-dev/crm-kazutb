<?php

namespace App\Http\Controllers;

use App\Models\CertificateTemplate;
use App\Models\CertificateTemplateVersion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CertificateTemplateController extends Controller
{
    public function index(Request $request): Response
    {
        $this->ensureAdmin($request);

        $templates = CertificateTemplate::query()
            ->with(['versions' => function ($query): void {
                $query->orderByDesc('version');
            }])
            ->orderByDesc('id')
            ->get()
            ->map(function (CertificateTemplate $template): array {
                return [
                    'id' => $template->id,
                    'name' => $template->name,
                    'code' => $template->code,
                    'is_active' => (bool) $template->is_active,
                    'created_at_human' => optional($template->created_at)?->format('d.m.Y H:i'),
                    'versions' => $template->versions->map(function (CertificateTemplateVersion $version): array {
                        return [
                            'id' => $version->id,
                            'version' => $version->version,
                            'background_url' => $version->background_path
                                ? '/storage/' . ltrim($version->background_path, '/')
                                : null,
                            'canvas_width' => (int) $version->canvas_width,
                            'canvas_height' => (int) $version->canvas_height,
                            'dpi' => (int) $version->dpi,
                            'is_published' => (bool) $version->is_published,
                            'published_at_human' => optional($version->published_at)?->format('d.m.Y H:i'),
                            'created_at_human' => optional($version->created_at)?->format('d.m.Y H:i'),
                        ];
                    })->values(),
                ];
            })
            ->values();

        return Inertia::render('Templates/Index', [
            'templates' => $templates,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:80', 'alpha_dash', Rule::unique('certificate_templates', 'code')],
            'is_active' => ['required', 'boolean'],
            'background' => ['nullable', 'image', 'max:10240'],
            'canvas_width' => ['nullable', 'integer', 'min:100', 'max:10000'],
            'canvas_height' => ['nullable', 'integer', 'min:100', 'max:10000'],
            'dpi' => ['nullable', 'integer', 'min:72', 'max:1200'],
            'layout_json' => ['nullable', 'string', 'max:65535'],
            'text_rules_json' => ['nullable', 'string', 'max:65535'],
            'qr_rules_json' => ['nullable', 'string', 'max:65535'],
        ]);

        $template = CertificateTemplate::query()->create([
            'name' => $data['name'],
            'code' => strtoupper($data['code']),
            'is_active' => (bool) $data['is_active'],
            'created_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
        ]);

        if ($request->hasFile('background')) {
            $backgroundPath = $request->file('background')->store('certificates/templates', 'public');
            $defaults = $this->defaultInitialLayout();

            $layout = array_key_exists('layout_json', $data) && trim((string) $data['layout_json']) !== ''
                ? $this->decodeJsonField($data['layout_json'], 'layout_json')
                : $defaults['layout_json'];

            $textRules = array_key_exists('text_rules_json', $data) && trim((string) $data['text_rules_json']) !== ''
                ? $this->decodeJsonField($data['text_rules_json'], 'text_rules_json', true)
                : $defaults['text_rules_json'];

            $qrRules = array_key_exists('qr_rules_json', $data) && trim((string) $data['qr_rules_json']) !== ''
                ? $this->decodeJsonField($data['qr_rules_json'], 'qr_rules_json', true)
                : $defaults['qr_rules_json'];

            $template->versions()->create([
                'version' => 1,
                'background_path' => $backgroundPath,
                'canvas_width' => (int) ($data['canvas_width'] ?? 1600),
                'canvas_height' => (int) ($data['canvas_height'] ?? 1131),
                'dpi' => (int) ($data['dpi'] ?? 300),
                'layout_json' => $layout,
                'text_rules_json' => $textRules,
                'qr_rules_json' => $qrRules,
                'is_published' => true,
                'published_at' => now(),
                'created_by' => $request->user()?->id,
            ]);
        }

        return back()->with('success', 'Шаблон сертификата создан.');
    }

    public function update(Request $request, CertificateTemplate $template): RedirectResponse
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:80', 'alpha_dash', Rule::unique('certificate_templates', 'code')->ignore($template->id)],
            'is_active' => ['required', 'boolean'],
        ]);

        $template->update([
            'name' => $data['name'],
            'code' => strtoupper($data['code']),
            'is_active' => (bool) $data['is_active'],
            'updated_by' => $request->user()?->id,
        ]);

        return back()->with('success', 'Шаблон обновлен.');
    }

    public function toggleActive(Request $request, CertificateTemplate $template): RedirectResponse
    {
        $this->ensureAdmin($request);

        $template->update([
            'is_active' => ! $template->is_active,
            'updated_by' => $request->user()?->id,
        ]);

        return back()->with('success', $template->is_active ? 'Шаблон активирован.' : 'Шаблон деактивирован.');
    }

    public function storeVersion(Request $request, CertificateTemplate $template): RedirectResponse
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'background' => ['nullable', 'image', 'max:10240'],
            'canvas_width' => ['required', 'integer', 'min:100', 'max:10000'],
            'canvas_height' => ['required', 'integer', 'min:100', 'max:10000'],
            'dpi' => ['nullable', 'integer', 'min:72', 'max:1200'],
            'layout_json' => ['required', 'string', 'max:65535'],
            'text_rules_json' => ['nullable', 'string', 'max:65535'],
            'qr_rules_json' => ['nullable', 'string', 'max:65535'],
        ]);

        $nextVersion = ((int) $template->versions()->max('version')) + 1;

        $backgroundPath = null;
        if ($request->hasFile('background')) {
            $backgroundPath = $request->file('background')->store('certificates/templates', 'public');
        }

        $layout = $this->decodeJsonField($data['layout_json'], 'layout_json');
        $textRules = $this->decodeJsonField($data['text_rules_json'] ?? null, 'text_rules_json', true);
        $qrRules = $this->decodeJsonField($data['qr_rules_json'] ?? null, 'qr_rules_json', true);

        $template->versions()->create([
            'version' => $nextVersion,
            'background_path' => $backgroundPath,
            'canvas_width' => (int) $data['canvas_width'],
            'canvas_height' => (int) $data['canvas_height'],
            'dpi' => (int) ($data['dpi'] ?? 300),
            'layout_json' => $layout,
            'text_rules_json' => $textRules,
            'qr_rules_json' => $qrRules,
            'is_published' => false,
            'created_by' => $request->user()?->id,
        ]);

        return back()->with('success', 'Версия шаблона создана.');
    }

    public function publishVersion(Request $request, CertificateTemplateVersion $version): RedirectResponse
    {
        $this->ensureAdmin($request);

        $template = $version->template;

        $template->versions()->update([
            'is_published' => false,
            'published_at' => null,
        ]);

        $version->update([
            'is_published' => true,
            'published_at' => now(),
        ]);

        return back()->with('success', 'Версия опубликована.');
    }

    /**
     * @return array<string, mixed>|null
     */
    private function decodeJsonField(?string $json, string $field, bool $nullable = false): ?array
    {
        $value = trim((string) $json);

        if ($value === '') {
            if ($nullable) {
                return null;
            }

            throw ValidationException::withMessages([
                $field => "Поле {$field} обязательно и должно быть валидным JSON.",
            ]);
        }

        $decoded = json_decode($value, true);

        if (! is_array($decoded)) {
            throw ValidationException::withMessages([
                $field => "Поле {$field} должно быть валидным JSON-объектом.",
            ]);
        }

        return $decoded;
    }

    private function ensureAdmin(Request $request): void
    {
        $user = $request->user();
        $role = $user?->resolvedRoleSlug();
        $email = mb_strtolower(trim((string) ($user?->email ?? '')));
        $allowedEmails = [
            'a.khastayeva@kaztbu.edu.kz',
        ];
        $hasRoleAccess = in_array($role, ['admin', 'superadmin', 'super_admin'], true);
        $hasEmailAccess = in_array($email, $allowedEmails, true);

        abort_unless($hasRoleAccess || $hasEmailAccess, 403);
    }

    /**
     * @return array{layout_json: array<string, mixed>, text_rules_json: array<string, mixed>, qr_rules_json: array<string, mixed>}
     */
    private function defaultInitialLayout(): array
    {
        return [
            'layout_json' => [
                'fio' => [
                    'x' => 320,
                    'y' => 320,
                    'w' => 900,
                    'h' => 90,
                    'font_family' => 'Arial',
                    'font_size' => 48,
                    'font_weight' => 'normal',
                    'font_style' => 'normal',
                    'min_font_size' => 24,
                    'color' => '#000000',
                    'align' => 'center',
                ],
                'topic' => [
                    'x' => 300,
                    'y' => 430,
                    'w' => 940,
                    'h' => 150,
                    'font_family' => 'Arial',
                    'font_size' => 30,
                    'font_weight' => 'normal',
                    'font_style' => 'normal',
                    'min_font_size' => 18,
                    'color' => '#222222',
                    'align' => 'center',
                    'max_lines' => 3,
                ],
                'number' => [
                    'x' => 980,
                    'y' => 700,
                    'w' => 260,
                    'h' => 45,
                    'font_family' => 'Arial',
                    'font_size' => 22,
                    'font_weight' => 'normal',
                    'font_style' => 'normal',
                    'color' => '#000000',
                    'align' => 'right',
                ],
                'qr' => [
                    'x' => 95,
                    'y' => 615,
                    'size' => 170,
                    'margin' => 2,
                    'ec_level' => 'M',
                ],
            ],
            'text_rules_json' => [
                'fio' => [
                    'auto_shrink' => true,
                    'min_font_size' => 24,
                ],
                'topic' => [
                    'wrap' => true,
                    'max_lines' => 3,
                ],
            ],
            'qr_rules_json' => [
                'format' => 'verify_url',
            ],
        ];
    }
}
