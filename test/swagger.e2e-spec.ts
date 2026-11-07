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

  it('documents exactly the 12 approved operations and correct access', async () => {
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
    ).toBe(12);
    expect(document.components.securitySchemes).toHaveProperty('bearer');

    const protectedOperations = [
      ['/api/students/me', 'get'],
      ['/api/students/me', 'patch'],
      ['/api/students/me/skills', 'put'],
      ['/api/projects', 'post'],
      ['/api/projects/me', 'get'],
      ['/api/projects/{id}', 'patch'],
      ['/api/projects/{id}', 'delete'],
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
      'location',
      'portfolioUrl',
      'skills',
    ]);
    expect(
      document.components.schemas.ProjectResponseDto.properties,
    ).not.toHaveProperty('studentProfileId');
  });
});
