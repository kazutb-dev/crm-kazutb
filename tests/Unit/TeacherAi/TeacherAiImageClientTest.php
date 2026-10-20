<?php

namespace Tests\Unit\TeacherAi;

use App\Services\TeacherAi\TeacherAiException;
use App\Services\TeacherAi\TeacherAiImageClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TeacherAiImageClientTest extends TestCase
{
    private const ENDPOINT = 'https://images.test/v1/images/generations';

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.teacher_ai', [
            'enabled' => true,
            'api_key' => 'teacher-key',
            'images_enabled' => true,
            'image_endpoint' => self::ENDPOINT,
            'image_model' => 'gpt-image-1.5',
            'image_quality' => 'low',
            'image_timeout' => 60,
        ]);
    }

    public function test_generates_jpeg_images_concurrently_with_the_right_sizes(): void
    {
        Http::fake([self::ENDPOINT => Http::response(['data' => [['b64_json' => base64_encode($this->jpeg())]]])]);

        $results = (new TeacherAiImageClient)->generatePool([
            3 => ['prompt' => 'Servers', 'orientation' => TeacherAiImageClient::ORIENTATION_PORTRAIT],
            6 => ['prompt' => 'Panorama', 'orientation' => TeacherAiImageClient::ORIENTATION_LANDSCAPE],
        ]);

        $this->assertSame([3, 6], array_keys($results));
        $this->assertSame('image/jpeg', getimagesizefromstring($results[3]['bytes'])['mime']);
        $this->assertSame('gpt-image-1.5', $results[6]['model']);

        Http::assertSent(fn (Request $request): bool => $request['prompt'] === 'Servers'
            && $request['size'] === '1024x1536'
            && $request['quality'] === 'low'
            && $request['output_format'] === 'jpeg'
            && $request->hasHeader('Authorization', 'Bearer teacher-key'));
        Http::assertSent(fn (Request $request): bool => $request['prompt'] === 'Panorama' && $request['size'] === '1536x1024');
    }

    public function test_png_answers_are_converted_to_jpeg(): void
    {
        $image = imagecreatetruecolor(4, 4);
        ob_start();
        imagepng($image);
        $png = (string) ob_get_clean();

        Http::fake([self::ENDPOINT => Http::response(['data' => [['b64_json' => base64_encode($png)]]])]);

        $result = (new TeacherAiImageClient)->generatePool(['a' => ['prompt' => 'x']])['a'];

        $this->assertSame('image/jpeg', getimagesizefromstring($result['bytes'])['mime']);
    }

    public function test_dall_e_models_get_their_own_parameters(): void
    {
        config()->set('services.teacher_ai.image_model', 'dall-e-3');
        Http::fake([self::ENDPOINT => Http::response(['data' => [['b64_json' => base64_encode($this->jpeg())]]])]);

        (new TeacherAiImageClient)->generatePool(['a' => ['prompt' => 'x', 'orientation' => TeacherAiImageClient::ORIENTATION_LANDSCAPE]]);

        Http::assertSent(fn (Request $request): bool => $request['size'] === '1792x1024'
            && $request['response_format'] === 'b64_json'
            && ! array_key_exists('output_format', $request->data()));
    }

    public function test_failures_carry_codes_the_caller_can_act_on(): void
    {
        Http::fake(function (Request $request) {
            return match ($request['prompt']) {
                'limited' => Http::response(['error' => ['message' => 'slow down']], 429),
                'down' => Http::response(['error' => ['message' => 'oops']], 503),
                'rejected' => Http::response(['error' => ['message' => 'policy']], 400),
                'empty' => Http::response(['data' => [['b64_json' => base64_encode('not an image')]]]),
                default => throw new ConnectionException('timed out'),
            };
        });

        $results = (new TeacherAiImageClient)->generatePool([
            'limited' => ['prompt' => 'limited'],
            'down' => ['prompt' => 'down'],
            'rejected' => ['prompt' => 'rejected'],
            'empty' => ['prompt' => 'empty'],
            'timeout' => ['prompt' => 'timeout'],
        ]);

        $codes = array_map(fn ($result): int => $result instanceof TeacherAiException ? $result->getCode() : 0, $results);

        $this->assertSame([
            'limited' => TeacherAiImageClient::CODE_RATE_LIMITED,
            'down' => TeacherAiImageClient::CODE_UNAVAILABLE,
            'rejected' => TeacherAiImageClient::CODE_REJECTED,
            'empty' => TeacherAiImageClient::CODE_BAD_RESPONSE,
            'timeout' => TeacherAiImageClient::CODE_CONNECTION,
        ], $codes);
    }

    public function test_disabled_images_send_nothing(): void
    {
        config()->set('services.teacher_ai.images_enabled', false);
        Http::fake();

        $client = new TeacherAiImageClient;
        $results = $client->generatePool(['a' => ['prompt' => 'x']]);

        $this->assertFalse($client->isEnabled());
        $this->assertInstanceOf(TeacherAiException::class, $results['a']);
        Http::assertNothingSent();
    }

    public function test_falls_back_to_the_shared_openai_key(): void
    {
        config()->set('services.teacher_ai.api_key', '');
        config()->set('services.openai.api_key', 'openai-key');
        Http::fake([self::ENDPOINT => Http::response(['data' => [['b64_json' => base64_encode($this->jpeg())]]])]);

        (new TeacherAiImageClient)->generatePool(['a' => ['prompt' => 'x']]);

        Http::assertSent(fn (Request $request): bool => $request->hasHeader('Authorization', 'Bearer openai-key'));
    }

    private function jpeg(): string
    {
        $image = imagecreatetruecolor(8, 12);
        ob_start();
        imagejpeg($image);

        return (string) ob_get_clean();
    }
}
