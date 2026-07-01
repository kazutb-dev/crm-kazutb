<?php

namespace App\Modules\LanguageTestingModule\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Info(
	title: 'Language Testing API',
	version: '1.0.0',
	description: 'Base OpenAPI metadata for the LanguageTestingModule documentation generation.'
)]
#[OA\Server(
	url: 'https://dev-crm.kaztbu.edu.kz',
	description: 'Development CRM'
)]
#[OA\SecurityScheme(
	securityScheme: 'SanctumBearerAuth',
	type: 'http',
	scheme: 'bearer',
	bearerFormat: 'Sanctum',
	description: 'Bearer token for CRM authenticated users.'
)]
#[OA\SecurityScheme(
	securityScheme: 'ApiKeyAuth',
	type: 'apiKey',
	in: 'header',
	name: 'X-API-KEY',
	description: 'API key used by AI Students integration.'
)]
#[OA\PathItem(path: '/api/v1/tests')]
#[OA\Get(
	path: '/api/v1/tests',
	operationId: 'languageTestingOpenApiPlaceholder',
	tags: ['Language Testing'],
	responses: [
		new OA\Response(response: 200, description: 'Language Testing tests endpoint placeholder for Swagger generation')
	]
)]
final class LanguageTestingOpenApi
{
}