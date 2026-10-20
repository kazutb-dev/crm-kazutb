<?php

/**
 * Builds public/assets/teacher-ai/cover-photo.jpg, the building photo on the
 * cover slide of AI-generated lecture decks (PPTX exporter and React preview).
 *
 * Source: public/assets/images/main.png (2480x723 panorama of the main
 * building). A full-height square is cropped with the round tower on the left
 * (its centre at ~37 %, whole tower clear of the curve, "KULAZHANOV UNIVERSITY"
 * and the "KAZUTB" sign readable) and the right wing running to the right
 * edge, then scaled to 1440x1440 (drawn into a 720x720 box, i.e. 2x).
 * Everything left of a smooth curve through (185,0) → (78,360) → (140,720)
 * (720-box coordinates) becomes white; along the curve follow a 10-px white
 * band and a 2-px #1B2A4A line, then the photo.
 *
 * GD only. Run from the repository root:
 *   php scripts/teacher-ai/build-cover-photo.php [output.jpg]
 */
$root = dirname(__DIR__, 2);
$source = $root.'/public/assets/images/main.png';
$target = $argv[1] ?? $root.'/public/assets/teacher-ai/cover-photo.jpg';

const OUTPUT_SIZE = 1440;   // output pixels (2x the 720-px box)
const BOX_SIZE = 720;       // box the photo is drawn into, curve coordinates use it
const CROP_X = 965;         // left edge of the square crop in main.png (tower ≈ x 1040–1430)
const CURVE = [[185, 0], [78, 360], [140, 720]];   // points the curve passes through (box px)
const BAND = 10.0;          // white band right of the curve (box px)
const LINE = 2.0;           // dark line after the band (box px)
const LINE_RGB = [0x1B, 0x2A, 0x4A];
const JPEG_QUALITY = 85;

if (! extension_loaded('gd')) {
    fwrite(STDERR, "The GD extension is required.\n");
    exit(1);
}

$panorama = @imagecreatefrompng($source);

if ($panorama === false) {
    fwrite(STDERR, "Cannot read {$source}\n");
    exit(1);
}

$cropSize = min(imagesy($panorama), imagesx($panorama) - CROP_X);
$photo = imagecreatetruecolor(OUTPUT_SIZE, OUTPUT_SIZE);
imagecopyresampled($photo, $panorama, 0, 0, CROP_X, 0, OUTPUT_SIZE, OUTPUT_SIZE, $cropSize, $cropSize);
imagedestroy($panorama);

// Quadratic Bézier through the three points: the middle point is reached at
// t = 0.5, so the control point is 2·P1 − (P0 + P2) / 2. Its y is linear in t
// (y = 720·t), which makes x a smooth function of the row.
[$p0, $p1, $p2] = CURVE;
$control = [2 * $p1[0] - ($p0[0] + $p2[0]) / 2, 2 * $p1[1] - ($p0[1] + $p2[1]) / 2];
$scale = OUTPUT_SIZE / BOX_SIZE;
$white = imagecolorallocate($photo, 255, 255, 255);

for ($row = 0; $row < OUTPUT_SIZE; $row++) {
    $t = (($row + 0.5) / $scale) / BOX_SIZE;
    $x = (1 - $t) ** 2 * $p0[0] + 2 * $t * (1 - $t) * $control[0] + $t ** 2 * $p2[0];
    $dxdt = 2 * (1 - $t) * ($control[0] - $p0[0]) + 2 * $t * ($p2[0] - $control[0]);
    $dydt = 2 * (1 - $t) * ($control[1] - $p0[1]) + 2 * $t * ($p2[1] - $control[1]);

    // Band and line widths are measured across the curve, not along the row.
    $stretch = sqrt(1 + ($dxdt / $dydt) ** 2);
    $whiteEnd = ($x + BAND * $stretch) * $scale;
    $lineEnd = ($x + (BAND + LINE) * $stretch) * $scale;

    $solid = (int) floor($whiteEnd);

    if ($solid > 0) {
        imageline($photo, 0, $row, $solid - 1, $row, $white);
    }

    // Edge pixels get the exact share of white, line and photo they cover (anti-aliasing).
    for ($col = max(0, $solid); $col <= min(OUTPUT_SIZE - 1, (int) ceil($lineEnd)); $col++) {
        $whiteShare = max(0.0, min(1.0, $whiteEnd - $col));
        $lineShare = max(0.0, min(1.0, $lineEnd - $col)) - $whiteShare;
        $photoShare = 1.0 - $whiteShare - $lineShare;

        $rgb = imagecolorat($photo, $col, $row);
        $pixel = [($rgb >> 16) & 0xFF, ($rgb >> 8) & 0xFF, $rgb & 0xFF];
        $mixed = [];

        foreach ([0, 1, 2] as $channel) {
            $mixed[] = (int) round(255 * $whiteShare + LINE_RGB[$channel] * $lineShare + $pixel[$channel] * $photoShare);
        }

        imagesetpixel($photo, $col, $row, imagecolorallocate($photo, ...$mixed));
    }
}

if (! is_dir(dirname($target)) && ! mkdir(dirname($target), 0775, true)) {
    fwrite(STDERR, 'Cannot create '.dirname($target)."\n");
    exit(1);
}

imageinterlace($photo, true);

if (! imagejpeg($photo, $target, JPEG_QUALITY)) {
    fwrite(STDERR, "Cannot write {$target}\n");
    exit(1);
}

imagedestroy($photo);

printf("%s: %dx%d, %d bytes\n", $target, OUTPUT_SIZE, OUTPUT_SIZE, filesize($target));
