<?php

namespace App\Services\Hr;

use App\Models\HrDocument;
use App\Models\HrDocumentTemplate;
use App\Models\HrHiring;
use App\Models\User;
use App\Services\Hr\Docx\HrTemplateProcessor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Fills the active template of a document type for a hiring. Every generation is stored as a new version;
 * signed versions are never touched. The contract's HR executor («М.Р. Тасполтаева» in the sample) defaults
 * to the person generating the document and is kept on the document, so a regeneration prints the same name.
 */
class HiringDocumentGenerator
{
    public function __construct(
        private readonly HiringDocumentContext $context,
        private readonly HiringSnapshot $snapshot,
        private readonly HrAuditLogger $audit,
    ) {}

    /**
     * @param  array{executor?: ?string, sensitive?: bool}  $options
     */
    public function generate(HrHiring $hiring, string $type, User $user, array $options = []): HrDocument
    {
        $executor = $options['executor'] ?? $this->defaultExecutor($hiring, $type, $user);

        $document = DB::transaction(function () use ($hiring, $type, $user, $options, $executor): HrDocument {
            HrHiring::query()->whereKey($hiring->id)->lockForUpdate()->first();

            $template = HrDocumentTemplate::active($type);
            $data = $this->prepareData($hiring, $type, ['executor' => $executor, 'sensitive' => $options['sensitive'] ?? false]);
            $version = (int) HrDocument::query()->where('hiring_id', $hiring->id)->where('type', $type)->max('version') + 1;

            $path = "hr/documents/{$hiring->id}/{$type}-v{$version}-".Str::random(8).'.docx';
            $tmp = $this->render($template, $data, $type);
            try {
                Storage::disk(config('hr.disk'))->put($path, file_get_contents($tmp));
                $sha256 = hash_file('sha256', $tmp);
            } finally {
                @unlink($tmp);
            }

            return HrDocument::query()->create([
                'hiring_id' => $hiring->id,
                'type' => $type,
                'version' => $version,
                'template_id' => $template->id,
                'file_path' => $path,
                'sha256' => $sha256,
                'status' => HrDocument::STATUS_DRAFT,
                'oup_executor' => $type === HrDocumentTemplate::TYPE_CONTRACT ? $executor : null,
                'missing_fields' => $data->missing,
                'warnings' => $data->warnings,
                'generated_by' => $user->id,
            ]);
        });

        $this->audit->document(HrAuditLogger::DOCUMENT_GENERATED, $document, $user);

        return $document;
    }

    /**
     * Fills the active template into a temp .docx (for previews); the caller deletes the file.
     *
     * @param  array{executor?: ?string, sensitive?: bool}  $options
     */
    public function renderToTemp(HrHiring $hiring, string $type, User $user, array $options = []): string
    {
        $data = $this->prepareData($hiring, $type, [
            'executor' => $options['executor'] ?? $this->defaultExecutor($hiring, $type, $user),
            'sensitive' => $options['sensitive'] ?? false,
        ]);

        return $this->render(HrDocumentTemplate::active($type), $data, $type);
    }

    /**
     * A signed document is final: it gets the scan of the signed copy and is never regenerated in place.
     */
    public function markSigned(HrDocument $document, User $user, string $scanPath): HrDocument
    {
        $document->forceFill([
            'status' => HrDocument::STATUS_SIGNED,
            'signed_at' => now(),
            'signed_by' => $user->id,
            'signed_scan_path' => $scanPath,
        ])->save();

        $this->audit->document(HrAuditLogger::DOCUMENT_SIGNED, $document, $user);

        return $document;
    }

    /**
     * The contract keeps the executor chosen for the previous version; otherwise it is the current user.
     */
    public function defaultExecutor(HrHiring $hiring, string $type, User $user): string
    {
        $previous = HrDocument::query()
            ->where('hiring_id', $hiring->id)
            ->where('type', $type)
            ->whereNotNull('oup_executor')
            ->orderByDesc('version')
            ->value('oup_executor');

        return $previous ?? self::initialsAndSurname($user);
    }

    /** «Тасполтаева Мария Руслановна» → «М.Р. Тасполтаева» (the way the sample signs the contract). */
    public static function initialsAndSurname(User $user): string
    {
        $parts = preg_split('/\s+/u', trim((string) $user->name)) ?: [];
        if (count($parts) < 2) {
            $parts = array_values(array_filter([trim((string) $user->last_name), trim((string) $user->first_name)]));
        }
        if ($parts === []) {
            return '';
        }

        $surname = array_shift($parts);
        $initials = implode('', array_map(static fn (string $part): string => mb_substr($part, 0, 1).'.', $parts));

        return trim($initials.' '.$surname);
    }

    /**
     * @param  array{executor?: ?string, sensitive?: bool}  $options
     */
    private function prepareData(HrHiring $hiring, string $type, array $options): HiringDocumentData
    {
        $this->snapshot->refresh($hiring);
        if ($hiring->isDirty()) {
            $hiring->save();
        }

        return $this->context->build($hiring, $type, $options);
    }

    private function render(HrDocumentTemplate $template, HiringDocumentData $data, string $type): string
    {
        $processor = new HrTemplateProcessor($template->absolutePath());
        $processor->prepare($data->flags);

        foreach ($data->rows as $firstTag => $rows) {
            $processor->fillRows($firstTag, $rows);
        }

        if (in_array('photo', $processor->getVariables(), true)) {
            $data->photoPath !== null
                ? $processor->setImageValue('photo', ['path' => $data->photoPath, 'width' => '3cm', 'height' => '4cm', 'ratio' => false])
                : $processor->fill(['photo' => 'Фото 3×4']);
        }

        $processor->fill($data->values);

        // A tag the catalog does not know (should not pass the upload check) is printed as a blank line.
        $leftover = array_diff($processor->getVariables(), array_keys($data->values));
        if ($leftover !== []) {
            $processor->fill(array_fill_keys($leftover, HiringDocumentContext::BLANK));
        }

        $tmp = tempnam(sys_get_temp_dir(), 'hr-'.$type.'-');
        $processor->saveAs($tmp);

        return $tmp;
    }
}
