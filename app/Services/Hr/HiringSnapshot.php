<?php

namespace App\Services\Hr;

use App\Models\HrHiring;

/**
 * Keeps the hiring's copy of unit/position names and case forms in step with the catalog: for a linked
 * entry a non-empty catalog value wins; a form the catalog lacks keeps what HR typed in the hiring.
 * Signed hirings are frozen.
 */
final class HiringSnapshot
{
    public function refresh(HrHiring $hiring): void
    {
        if ($hiring->status === HrHiring::STATUS_SIGNED) {
            return;
        }

        $hiring->loadMissing(['topUnit', 'subUnit', 'position']);

        foreach (['top_unit' => $hiring->topUnit, 'sub_unit' => $hiring->subUnit] as $prefix => $unit) {
            if ($unit === null) {
                continue;
            }
            $this->take($hiring, "{$prefix}_name_ru", $unit->name);
            $this->take($hiring, "{$prefix}_name_ru_gen", $unit->name_ru_gen);
            $this->take($hiring, "{$prefix}_name_kz_gen", $unit->name_kz_gen);
        }

        if ($hiring->position !== null) {
            $this->take($hiring, 'position_name_ru', $hiring->position->name);
            $this->take($hiring, 'position_name_ru_gen', $hiring->position->name_ru_gen);
            $this->take($hiring, 'position_name_kz_poss', $hiring->position->name_kz_poss);
        }
    }

    private function take(HrHiring $hiring, string $attribute, ?string $catalogValue): void
    {
        if (trim((string) $catalogValue) !== '') {
            $hiring->setAttribute($attribute, trim($catalogValue));
        }
    }
}
