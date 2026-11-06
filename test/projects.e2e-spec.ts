import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Projects CRUD (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerToken: string;
  let otherStudentToken: string;

  const createdUserEmails = new Set<string>();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);

    const database = await prisma.$queryRaw<
      Array<{ database_name: string }>
    >`SELECT current_database() AS database_name`;
    if (database[0]?.database_name !== 'gaza_talent_connect_test') {
      throw new Error('E2E safety check: unexpected database');
    }

    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    ownerToken = await createStudent('Project Owner');
    otherStudentToken = await createStudent('Other Student');
  }, 30_000);

  async function createStudent(fullName: string): Promise<string> {
    const email = `e2e-project-${randomUUID()}@example.com`;
    createdUserEmails.add(email);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Student123!', fullName })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'Student123!' })
      .expect(200);

    return login.body.accessToken as string;
  }

  async function createProject(token: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);
  }

  it('requires a valid JWT for all project endpoints', async () => {
    const projectId = randomUUID();

    await request(app.getHttpServer())
      .post('/api/projects')
      .send({ title: 'Unauthorized Project' })
      .expect(401);
    await request(app.getHttpServer()).get('/api/projects/me').expect(401);
    await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}`)
      .send({ title: 'Unauthorized Update' })
      .expect(401);
    await request(app.getHttpServer())
      .delete(`/api/projects/${projectId}`)
      .expect(401);
  });

  it('creates a project with the approved response fields', async () => {
    const response = await createProject(ownerToken, {
      title: 'Portfolio Website',
      description: 'A personal portfolio project',
      githubUrl: 'https://github.com/student/portfolio',
      demoUrl: 'https://portfolio.example.com',
    });

    expect(response.body).toMatchObject({
      id: expect.any(String),
      title: 'Portfolio Website',
      description: 'A personal portfolio project',
      githubUrl: 'https://github.com/student/portfolio',
      demoUrl: 'https://portfolio.example.com',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(Object.keys(response.body).sort()).toEqual(
      [
        'id',
        'title',
        'description',
        'githubUrl',
        'demoUrl',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
    expect(response.body.studentProfileId).toBeUndefined();
  });

  it('validates required and optional project fields', async () => {
    const invalidCreateBodies: Array<Record<string, unknown>> = [
      {},
      { title: 'AB' },
      { title: 'T'.repeat(151) },
      { title: 'Valid title', description: 'd'.repeat(2001) },
      { title: 'Valid title', githubUrl: 'http://github.com/student' },
      { title: 'Valid title', demoUrl: 'ftp://example.com/demo' },
      {
        title: 'Valid title',
        githubUrl: `https://example.com/${'a'.repeat(2048)}`,
      },
      {
        title: 'Valid title',
        demoUrl: `https://example.com/${'a'.repeat(2048)}`,
      },
      { title: 'Valid title', studentProfileId: randomUUID() },
    ];

    for (const body of invalidCreateBodies) {
      await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(body)
        .expect(400);
    }

    const defaults = await createProject(ownerToken, {
      title: 'Minimal Project',
    });
    expect(defaults.body).toMatchObject({
      description: null,
      githubUrl: null,
      demoUrl: null,
    });

    const projectId = defaults.body.id as string;
    const invalidPatchBodies: Array<Record<string, unknown>> = [
      { title: null },
      { title: 'AB' },
      { title: 'T'.repeat(151) },
      { description: 'd'.repeat(2001) },
      { githubUrl: 'http://github.com/student' },
      { demoUrl: 'ftp://example.com/demo' },
      { studentProfileId: randomUUID() },
    ];

    for (const body of invalidPatchBodies) {
      await request(app.getHttpServer())
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(body)
        .expect(400);
    }
  });

  it('lists only the authenticated student projects, newest first', async () => {
    const older = await createProject(ownerToken, { title: 'Older Project' });
    const newer = await createProject(ownerToken, { title: 'Newer Project' });
    const foreign = await createProject(otherStudentToken, {
      title: 'Other Student Project',
    });

    const response = await request(app.getHttpServer())
      .get('/api/projects/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const projectIds = response.body.map(
      (project: { id: string }) => project.id,
    );

    expect(projectIds).toContain(older.body.id);
    expect(projectIds).toContain(newer.body.id);
    expect(projectIds).not.toContain(foreign.body.id);
    expect(projectIds.indexOf(newer.body.id)).toBeLessThan(
      projectIds.indexOf(older.body.id),
    );
  });

  it('updates only supplied fields and clears nullable fields with null', async () => {
    const project = await createProject(ownerToken, {
      title: 'Original Project',
      description: 'Description to clear',
      githubUrl: 'https://github.com/student/original',
      demoUrl: 'http://demo.example.com/original',
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/projects/${project.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Updated Project',
        description: null,
        githubUrl: null,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: project.body.id,
      title: 'Updated Project',
      description: null,
      githubUrl: null,
      demoUrl: 'http://demo.example.com/original',
    });
    expect(response.body.studentProfileId).toBeUndefined();
  });

  it('returns 404 and leaves a foreign project unchanged on update or delete', async () => {
    const foreign = await createProject(otherStudentToken, {
      title: 'Protected Foreign Project',
      description: 'Keep this description',
    });

    await request(app.getHttpServer())
      .patch(`/api/projects/${foreign.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Unauthorized Change' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/projects/${foreign.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);

    const otherProjects = await request(app.getHttpServer())
      .get('/api/projects/me')
      .set('Authorization', `Bearer ${otherStudentToken}`)
      .expect(200);
    expect(otherProjects.body).toContainEqual(foreign.body);
  });

  it('returns 404 for unknown project IDs', async () => {
    const unknownId = randomUUID();

    await request(app.getHttpServer())
      .patch(`/api/projects/${unknownId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Unknown Project Update' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/projects/${unknownId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });

  it('rejects invalid project UUIDs', async () => {
    await request(app.getHttpServer())
      .patch('/api/projects/not-a-uuid')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Invalid UUID Update' })
      .expect(400);
    await request(app.getHttpServer())
      .delete('/api/projects/not-a-uuid')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
  });

  it('deletes an owned project with 204 and returns 404 when deletion is repeated', async () => {
    const project = await createProject(ownerToken, {
      title: 'Project to Delete',
    });

    const deletion = await request(app.getHttpServer())
      .delete(`/api/projects/${project.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(204);
    expect(deletion.text).toBe('');

    await request(app.getHttpServer())
      .delete(`/api/projects/${project.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });

  afterAll(async () => {
    try {
      if (prisma && createdUserEmails.size > 0) {
        const database = await prisma.$queryRaw<
          Array<{ database_name: string }>
        >`SELECT current_database() AS database_name`;

        if (database[0]?.database_name !== 'gaza_talent_connect_test') {
          throw new Error('E2E cleanup safety check failed');
        }

        const cleanupErrors: unknown[] = [];
        for (const email of createdUserEmails) {
          try {
            const user = await prisma.user.findUnique({
              where: { email },
              select: { id: true },
            });
            if (user) {
              await prisma.user.delete({ where: { id: user.id, email } });
            }
          } catch (error: unknown) {
            cleanupErrors.push(error);
          }
        }

        if (cleanupErrors.length > 0) {
          throw new AggregateError(cleanupErrors, 'E2E cleanup failed');
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });
});
