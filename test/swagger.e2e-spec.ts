import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { setupSwagger } from '../src/swagger';

describe('Swagger / OpenAPI', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    setupSwagger(app);
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('serves Swagger UI at /api/docs', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs')
      .redirects(1);

    expect(response.status).toBe(200);
    expect(response.text).toContain('<title>Gaza Talent Connect API</title>');
  });

  it('documents exactly the 19 approved operations and correct access', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json');

    expect(response.status).toBe(200);

    const document = response.body as {
      paths: Record<
        string,
        Record<
          string,
          {
            security?: Array<Record<string, string[]>>;
            parameters?: Array<{ name: string }>;
            requestBody?: unknown;
          }
        >
      >;
      components: {
        securitySchemes: Record<string, unknown>;
        schemas: Record<string, { properties?: Record<string, unknown> }>;
      };
    };

    const expected: Record<string, string[]> = {
      '/api/auth/register': ['post'],
      '/api/auth/login': ['post'],
      '/api/students/me': ['get', 'patch'],
      '/api/skills': ['get'],
      '/api/students/me/skills': ['put'],
      '/api/projects': ['post'],
      '/api/projects/me': ['get'],
      '/api/projects/{id}': ['patch', 'delete'],
      '/api/students': ['get'],
      '/api/students/{id}': ['get'],
      '/api/auth/register/company': ['post'],
      '/api/companies/me': ['get'],
      '/api/feedback': ['post'],
      '/api/feedback/sent': ['get'],
      '/api/feedback/{id}': ['patch', 'delete'],
      '/api/students/me/feedback': ['get'],
    };
    const actual = Object.fromEntries(
      Object.entries(document.paths).map(([path, pathItem]) => [
        path,
        Object.keys(pathItem).filter((method) =>
          ['get', 'post', 'put', 'patch', 'delete'].includes(method),
        ),
      ]),
    );

    expect(actual).toEqual(expected);
    expect(
      Object.values(actual).reduce((sum, methods) => sum + methods.length, 0),
    ).toBe(19);
    expect(document.components.securitySchemes).toHaveProperty('bearer');

    const protectedOperations = [
      ['/api/students/me', 'get'],
      ['/api/students/me', 'patch'],
      ['/api/students/me/skills', 'put'],
      ['/api/projects', 'post'],
      ['/api/projects/me', 'get'],
      ['/api/projects/{id}', 'patch'],
      ['/api/projects/{id}', 'delete'],
      ['/api/companies/me', 'get'],
      ['/api/feedback', 'post'],
      ['/api/feedback/sent', 'get'],
      ['/api/feedback/{id}', 'patch'],
      ['/api/feedback/{id}', 'delete'],
      ['/api/students/me/feedback', 'get'],
    ] as const;
    for (const [path, method] of protectedOperations) {
      expect(document.paths[path][method].security).toEqual([{ bearer: [] }]);
    }

    const publicOperations = [
      ['/api/auth/register', 'post'],
      ['/api/auth/login', 'post'],
      ['/api/skills', 'get'],
      ['/api/students', 'get'],
      ['/api/students/{id}', 'get'],
      ['/api/auth/register/company', 'post'],
    ] as const;
    for (const [path, method] of publicOperations) {
      expect(document.paths[path][method].security).toBeUndefined();
    }

    expect(document.paths['/api/students'].get).toHaveProperty('parameters');
    const discoveryParams =
      document.paths['/api/students'].get.parameters ?? [];
    expect(discoveryParams.map(({ name }) => name).sort()).toEqual([
      'limit',
      'page',
      'skillIds',
    ]);
    expect(document.paths['/api/auth/register'].post).toHaveProperty(
      'requestBody',
    );
    expect(document.paths['/api/projects'].post).toHaveProperty('requestBody');

    const discoverySchema =
      document.components.schemas.StudentDiscoveryResponseDto;
    expect(Object.keys(discoverySchema.properties ?? {}).sort()).toEqual([
      'data',
      'meta',
    ]);
    const profileSchema = document.components.schemas.StudentProfileResponseDto;
    expect(Object.keys(profileSchema.properties ?? {}).sort()).toEqual([
      'bio',
      'contactEmail',
      'fullName',
      'githubUrl',
      'id',
      'isPublic',
      'jobTitle',
      'location',
      'portfolioUrl',
      'skills',
    ]);
    expect(
      document.components.schemas.ProjectResponseDto.properties,
    ).not.toHaveProperty('studentProfileId');

    // Private feedback is never part of public profile schemas.
    for (const name of [
      'StudentProfileResponseDto',
      'PublicStudentDetailResponseDto',
      'StudentDiscoveryResponseDto',
    ]) {
      expect(document.components.schemas[name].properties).not.toHaveProperty(
        'feedback',
      );
    }
    expect(
      document.components.schemas.LoginResponseDto.properties,
    ).toHaveProperty('role');
    expect(
      Object.keys(
        document.components.schemas.ReceivedFeedbackResponseDto.properties ??
          {},
      ).sort(),
    ).toEqual(['company', 'createdAt', 'id', 'message', 'updatedAt']);
  });

  async function openApi(): Promise<OpenApiDocument> {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    return response.body as OpenApiDocument;
  }

  it('documents nullable text fields as nullable strings, never as objects', async () => {
    const { components } = await openApi();
    const nullableStrings: Record<string, string[]> = {
      StudentProfileResponseDto: [
        'jobTitle',
        'bio',
        'location',
        'contactEmail',
        'githubUrl',
        'portfolioUrl',
      ],
      PublicStudentResponseDto: [
        'jobTitle',
        'bio',
        'location',
        'contactEmail',
        'githubUrl',
        'portfolioUrl',
      ],
      PublicStudentDetailResponseDto: [
        'jobTitle',
        'bio',
        'location',
        'contactEmail',
        'githubUrl',
        'portfolioUrl',
      ],
      UpdateStudentProfileDto: [
        'jobTitle',
        'bio',
        'location',
        'contactEmail',
        'githubUrl',
        'portfolioUrl',
      ],
      ProjectResponseDto: ['description', 'githubUrl', 'demoUrl'],
      CreateProjectDto: ['description', 'githubUrl', 'demoUrl'],
      UpdateProjectDto: ['description', 'githubUrl', 'demoUrl'],
    };

    let checked = 0;
    for (const [schema, properties] of Object.entries(nullableStrings)) {
      for (const property of properties) {
        expect(components.schemas[schema].properties?.[property]).toMatchObject(
          { type: 'string', nullable: true },
        );
        checked += 1;
      }
    }
    expect(checked).toBe(33);

    expect(
      components.schemas.UpdateStudentProfileDto.properties?.jobTitle,
    ).toMatchObject({ maxLength: 100 });
    expect(
      components.schemas.StudentProfileResponseDto.properties?.contactEmail,
    ).toMatchObject({ format: 'email' });

    const bareObjects: string[] = [];
    for (const [schema, definition] of Object.entries(components.schemas)) {
      for (const [property, value] of Object.entries(
        definition.properties ?? {},
      )) {
        if (
          value.type === 'object' &&
          !value.properties &&
          !value.$ref &&
          !value.allOf
        ) {
          bareObjects.push(`${schema}.${property}`);
        }
      }
    }
    expect(bareObjects).toEqual([]);
    expect(components.schemas).not.toHaveProperty('Object');
  });

  it('documents feedback pagination as bounded integers', async () => {
    const { paths } = await openApi();

    for (const path of ['/api/feedback/sent', '/api/students/me/feedback']) {
      const parameters = paths[path].get.parameters ?? [];
      const page = parameters.find(({ name }) => name === 'page');
      const limit = parameters.find(({ name }) => name === 'limit');

      expect(page).toMatchObject({
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, default: 1 },
      });
      expect(limit).toMatchObject({
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      });
    }
  });

  it('documents project IDs as UUID path parameters', async () => {
    const { paths } = await openApi();

    for (const method of ['patch', 'delete']) {
      const id = (paths['/api/projects/{id}'][method].parameters ?? []).find(
        ({ name }) => name === 'id',
      );
      expect(id).toMatchObject({
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      });
    }
  });

  it('explains roles, JWT authorization and rate limits in the overview', async () => {
    const { info, components } = await openApi();
    const description = info.description ?? '';

    for (const text of [
      '**Student**',
      '**Company**',
      '403',
      'POST /api/auth/login',
      '**Authorize**',
      'Authorization: Bearer <token>',
      '401',
      '**Public:**',
      '**Protected:**',
      '120 requests per minute',
      '10 requests per 15 minutes',
      '5 requests per hour',
      '20 requests per hour',
      '429',
      'Retry-After',
    ]) {
      expect(description).toContain(text);
    }
    expect(components.securitySchemes.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  });

  it('documents discovery pagination as bounded integers', async () => {
    const { paths } = await openApi();
    const parameters = paths['/api/students'].get.parameters ?? [];

    expect(parameters.find(({ name }) => name === 'page')).toMatchObject({
      in: 'query',
      required: false,
      schema: { type: 'integer', minimum: 1, default: 1 },
    });
    expect(parameters.find(({ name }) => name === 'limit')).toMatchObject({
      in: 'query',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
    });
  });

  it('documents 429 with the enforced limit and Retry-After on every operation', async () => {
    const { paths } = await openApi();
    const stricterLimits: Record<string, string> = {
      'post /api/auth/login': '10 requests per 15 minutes',
      'post /api/auth/register': '5 requests per hour',
      'post /api/auth/register/company': '5 requests per hour',
      'post /api/feedback': '20 requests per hour',
    };

    let operations = 0;
    for (const [path, pathItem] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
          continue;
        }
        operations += 1;
        const tooMany = operation.responses?.['429'];
        const key = `${method} ${path}`;

        expect(tooMany).toBeDefined();
        expect(tooMany?.description).toContain(
          stricterLimits[key] ?? '120 requests per minute',
        );
        expect(tooMany?.description).toContain('Retry-After');
        if (stricterLimits[key]) {
          expect(tooMany?.description).not.toContain('120 requests per minute');
        }
        expect(tooMany?.headers?.['Retry-After']?.schema).toEqual({
          type: 'integer',
        });
        expect(tooMany?.content?.['application/json']?.schema?.$ref).toBe(
          '#/components/schemas/ApiErrorResponseDto',
        );
      }
    }
    expect(operations).toBe(19);
  });

  it('contains no secrets or internal configuration', async () => {
    const text = JSON.stringify(await openApi());

    for (const value of [process.env.JWT_SECRET, process.env.DATABASE_URL]) {
      if (value && value.length >= 8) {
        expect(text).not.toContain(value);
      }
    }
    expect(text).not.toMatch(/postgres(ql)?:\/\//i);
    expect(text).not.toMatch(
      /DATABASE_URL|JWT_SECRET|CORS_ORIGIN|CLIENT_IP_HEADER|SKILLS_SEED/,
    );
    expect(text).not.toMatch(/passwordHash|password_hash/);
    expect(text).not.toContain('"userId"');
  });
});

type OpenApiSchemaProperty = {
  type?: string;
  nullable?: boolean;
  format?: string;
  maxLength?: number;
  properties?: Record<string, unknown>;
  $ref?: string;
  allOf?: unknown[];
};

type OpenApiDocument = {
  info: { description?: string };
  paths: Record<
    string,
    Record<
      string,
      {
        parameters?: Array<{
          name: string;
          in: string;
          required?: boolean;
          schema?: Record<string, unknown>;
        }>;
        responses?: Record<
          string,
          {
            description?: string;
            headers?: Record<string, { schema?: Record<string, unknown> }>;
            content?: Record<string, { schema?: { $ref?: string } }>;
          }
        >;
      }
    >
  >;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<
      string,
      { properties?: Record<string, OpenApiSchemaProperty> }
    >;
  };
};
