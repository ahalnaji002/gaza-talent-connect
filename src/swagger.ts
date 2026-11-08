import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RATE_LIMITS } from './config/runtime-config';
import { describeRateLimit as describeLimit } from './swagger-responses';

/** Overview shown at the top of Swagger UI (Markdown). */
export const API_DESCRIPTION = [
  'REST API for Gaza Talent Connect: students publish profiles, skills and projects; companies discover published students and send them private feedback.',
  '',
  '### Roles',
  '- **Student** accounts (`POST /api/auth/register`) manage their own profile, job title, skills and projects, and read private feedback addressed to them.',
  '- **Company** accounts (`POST /api/auth/register/company`) read their company identity and write, edit and delete private feedback for published students.',
  '- The role is assigned by the server at registration and checked on every protected request. Calling an endpoint for the other role returns `403`.',
  '',
  '### Authentication',
  '1. Log in with `POST /api/auth/login` (students and companies use the same route) and copy `accessToken` from the response. Tokens expire after 1 hour.',
  '2. Click **Authorize**, paste the token (without the `Bearer ` prefix) and confirm.',
  '3. Protected endpoints (marked with a lock) then send `Authorization: Bearer <token>`. Without a valid token they return `401`.',
  '',
  '### Public and protected endpoints',
  '- **Public:** registration, login, `GET /api/skills`, `GET /api/students` (discovery) and `GET /api/students/{id}` (published profiles only). Private feedback never appears in public responses.',
  '- **Protected:** everything under `/api/students/me`, `/api/projects`, `/api/companies` and `/api/feedback`.',
  '',
  '### Rate limits',
  `- Every endpoint: ${describeLimit(RATE_LIMITS.default)} per client.`,
  `- \`POST /api/auth/login\`: ${describeLimit(RATE_LIMITS.login)}.`,
  `- \`POST /api/auth/register\` and \`POST /api/auth/register/company\`: ${describeLimit(RATE_LIMITS.registration)} each.`,
  `- \`POST /api/feedback\`: ${describeLimit(RATE_LIMITS.feedback)}.`,
  '- Exceeding a limit returns `429` with a `Retry-After` header; responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`. Failed attempts count too.',
  '',
  'Requests made with **Try it out** run against this live API and its real data.',
].join('\n');

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Gaza Talent Connect API')
    .setDescription(API_DESCRIPTION)
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Paste the accessToken returned by POST /api/auth/login (without the "Bearer " prefix).',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    raw: ['json'],
    customSiteTitle: 'Gaza Talent Connect API',
    swaggerOptions: { persistAuthorization: true },
  });

  return document;
}
