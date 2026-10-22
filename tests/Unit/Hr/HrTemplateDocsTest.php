<?php

namespace Tests\Unit\Hr;

use App\Services\Hr\Docx\HrTemplateCatalog;
use PHPUnit\Framework\TestCase;

/**
 * The HR instruction lists every tag the templates may use; a tag added to the catalog must be documented.
 */
class HrTemplateDocsTest extends TestCase
{
    public function test_every_catalog_tag_is_documented_for_the_hr_department(): void
    {
        $readme = file_get_contents(dirname(__DIR__, 3).'/docs/hr-module/README-ОУП.md');

        $tags = array_merge(
            array_keys(HrTemplateCatalog::VALUES),
            array_keys(HrTemplateCatalog::IMAGES),
            array_keys(HrTemplateCatalog::BLOCKS),
            array_merge(...array_values(HrTemplateCatalog::ROWS)),
        );

        foreach ($tags as $tag) {
            $this->assertStringContainsString('`${'.$tag.'}`', $readme, "tag {$tag} is missing from README-ОУП.md");
        }
    }
}
