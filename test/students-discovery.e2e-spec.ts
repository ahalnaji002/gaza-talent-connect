import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface StudentFixture {
  email: string;
  profileId: string;
  token: string;
}

describe('Public student discovery (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let zara: StudentFixture;
  let alice: StudentFixture;
  let bob: StudentFixture;
  let charlie: StudentFixture;
  let alexFirst: StudentFixture;
  let alexSecond: StudentFixture;
  let hidden: StudentFixture;
  let invalidContact: StudentFixture;
  let skillAId: string;
  let skillBId: string;

  const createdUserEmails = new Set<string>();
  const createdSkillIds = new Set<string>();

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

    const [skillA, skillB] = await Promise.all([
      prisma.skill.create({
        data: { name: `e2e-discovery-a-${randomUUID()}` },
        select: { id: true },
      }),
      prisma.skill.create({
        data: { name: `e2e-discovery-b-${randomUUID()}` },
        select: { id: true },
      }),
    ]);
    skillAId = skillA.id;
    skillBId = skillB.id;
    createdSkillIds.add(skillAId);
    createdSkillIds.add(skillBId);

    [zara, alice, bob, charlie, alexFirst, alexSecond, hidden, invalidContact] =
      await Promise.all([
        createStudent('Zara Match Two'),
        createStudent('Alice Match One'),
        createStudent('Bob Match One'),
        createStudent('Charlie No Match'),
        createStudent('Alex Same'),
        createStudent('Alex Same'),
        createStudent('Hidden Student', false),
        createStudent('Invalid Contact Student'),
      ]);

    await Promise.all([
      assignSkills(zara.profileId, [skillAId, skillBId]),
      assignSkills(alice.profileId, [skillAId]),
      assignSkills(bob.profileId, [skillBId]),
      assignSkills(alexFirst.profileId, [skillAId]),
      assignSkills(alexSecond.profileId, [skillAId]),
      assignSkills(hidden.profileId, [skillAId, skillBId]),
      assignSkills(invalidContact.profileId, [skillAId]),
    ]);

    await prisma.studentProfile.update({
      where: { id: invalidContact.profileId },
      data: { contactEmail: 'not-an-email' },
    });

    await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${zara.token}`)
      .send({ title: 'Public Portfolio A' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${zara.token}`)
      .send({ title: 'Public Portfolio B' })
      .expect(201);
  }, 45_000);

  async function createStudent(
    fullName: string,
    isPublic = true,
  ): Promise<StudentFixture> {
    const email = `e2e-discovery-${randomUUID()}@example.com`;
    createdUserEmails.add(email);

    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Student123!', fullName })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'Student123!' })
      .expect(200);
    const fixture: StudentFixture = {
      email,
      profileId: registration.body.profile.id as string,
      token: login.body.accessToken as string,
    };

    await request(app.getHttpServer())
      .patch('/api/students/me')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({
        contactEmail: `contact-${randomUUID()}@public.example.com`,
        isPublic,
        bio: `Public bio for ${fullName}`,
        location: 'Gaza',
        githubUrl: 'https://github.com/student',
        portfolioUrl: 'https://portfolio.example.com',
      })
      .expect(200);

    return fixture;
  }

  async function assignSkills(profileId: string, skillIds: string[]) {
    await prisma.studentSkill.createMany({
      data: skillIds.map((skillId) => ({
        studentProfileId: profileId,
        skillId,
      })),
    });
  }

  async function fetchAllPublicProfiles() {
    const profiles: Array<Record<string, unknown>> = [];
    let totalPages = 1;
    let total = 0;

    for (let page = 1; page <= totalPages; page += 1) {
      const response = await request(app.getHttpServer())
        .get('/api/students')
        .query({ page, limit: 50 })
        .expect(200);
      profiles.push(...(response.body.data as Array<Record<string, unknown>>));
      totalPages = response.body.meta.totalPages as number;
      total = response.body.meta.total as number;
    }

    return { profiles, total };
  }

  it('discovers only published profiles with valid contact emails without JWT', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/students')
      .expect(200);

    expect(response.body.meta).toEqual({
      page: 1,
      limit: 10,
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
    expect(response.body.meta.total).toBeGreaterThanOrEqual(6);
    expect(response.body.meta.totalPages).toBe(
      Math.ceil(response.body.meta.total / 10),
    );
    expect(response.body.data).toHaveLength(
      Math.min(response.body.meta.total, 10),
    );

    const allPublic = await fetchAllPublicProfiles();
    expect(allPublic.total).toBe(response.body.meta.total);
    const fixtureIds = new Set([
      zara.profileId,
      alice.profileId,
      bob.profileId,
      charlie.profileId,
      alexFirst.profileId,
      alexSecond.profileId,
    ]);
    const orderedFixtureIds = allPublic.profiles
      .map((profile) => profile.id as string)
      .filter((id) => fixtureIds.has(id));
    expect(orderedFixtureIds).toEqual([
      ...[alexFirst.profileId, alexSecond.profileId].sort(),
      alice.profileId,
      bob.profileId,
      charlie.profileId,
      zara.profileId,
    ]);

    for (const profile of allPublic.profiles) {
      expect(Object.keys(profile).sort()).toEqual(
        [
          'id',
          'fullName',
          'bio',
          'location',
          'contactEmail',
          'githubUrl',
          'portfolioUrl',
          'isPublic',
          'skills',
        ].sort(),
      );
      expect(profile.email).toBeUndefined();
      expect(profile.passwordHash).toBeUndefined();
      expect(profile.userId).toBeUndefined();
      expect(profile.isPublic).toBe(true);
      expect(JSON.stringify(profile)).not.toContain(zara.email);
      for (const skill of profile.skills as Array<Record<string, unknown>>) {
        expect(Object.keys(skill).sort()).toEqual(['id', 'name']);
      }
    }
  });

  it('applies OR skill filtering, match-count ranking, alphabetical ties, and pagination', async () => {
    const firstPage = await request(app.getHttpServer())
      .get('/api/students')
      .query({ skillIds: `${skillAId},${skillBId}`, page: 1, limit: 3 })
      .expect(200);

    expect(firstPage.body.meta).toEqual({
      page: 1,
      limit: 3,
      total: 5,
      totalPages: 2,
    });
    const firstPageProfiles = firstPage.body.data as Array<{
      id: string;
      fullName: string;
    }>;
    expect(firstPageProfiles.map(({ fullName }) => fullName)).toEqual([
      'Zara Match Two',
      'Alex Same',
      'Alex Same',
    ]);
    expect([firstPageProfiles[1].id, firstPageProfiles[2].id]).toEqual(
      [alexFirst.profileId, alexSecond.profileId].sort(),
    );

    const secondPage = await request(app.getHttpServer())
      .get('/api/students')
      .query({ skillIds: `${skillAId},${skillBId}`, page: 2, limit: 3 })
      .expect(200);
    expect(
      secondPage.body.data.map(
        (profile: { fullName: string }) => profile.fullName,
      ),
    ).toEqual(['Alice Match One', 'Bob Match One']);
    const filteredIds = [
      ...firstPage.body.data.map((profile: { id: string }) => profile.id),
      ...secondPage.body.data.map((profile: { id: string }) => profile.id),
    ];
    expect(filteredIds).not.toContain(hidden.profileId);
    expect(filteredIds).not.toContain(invalidContact.profileId);
  });

  it('returns a public profile with only approved profile, skill, and project fields', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/students/${zara.profileId}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: zara.profileId,
      fullName: 'Zara Match Two',
      contactEmail: expect.stringMatching(/@public\.example\.com$/),
      isPublic: true,
      skills: expect.arrayContaining([
        { id: skillAId, name: expect.stringMatching(/^e2e-discovery-a-/) },
        { id: skillBId, name: expect.stringMatching(/^e2e-discovery-b-/) },
      ]),
      projects: expect.arrayContaining([
        expect.objectContaining({ title: 'Public Portfolio A' }),
        expect.objectContaining({ title: 'Public Portfolio B' }),
      ]),
    });
    expect(Object.keys(response.body).sort()).toEqual(
      [
        'id',
        'fullName',
        'bio',
        'location',
        'contactEmail',
        'githubUrl',
        'portfolioUrl',
        'isPublic',
        'skills',
        'projects',
      ].sort(),
    );
    expect(response.body.email).toBeUndefined();
    expect(response.body.passwordHash).toBeUndefined();
    expect(response.body.userId).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain(zara.email);
    expect(response.body.projects).toHaveLength(2);
    for (const skill of response.body.skills as Array<
      Record<string, unknown>
    >) {
      expect(Object.keys(skill).sort()).toEqual(['id', 'name']);
    }
    for (const project of response.body.projects as Array<
      Record<string, unknown>
    >) {
      expect(Object.keys(project).sort()).toEqual(
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
      expect(project.studentProfileId).toBeUndefined();
    }
  });

  it('returns 404 for hidden profiles and profiles with invalid contact emails', async () => {
    await request(app.getHttpServer())
      .get(`/api/students/${hidden.profileId}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/students/${invalidContact.profileId}`)
      .expect(404);
  });

  it('returns 404 for nonexistent profiles and 400 for malformed profile UUIDs', async () => {
    await request(app.getHttpServer())
      .get(`/api/students/${randomUUID()}`)
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/students/not-a-uuid')
      .expect(400);
  });

  it('rejects invalid skill filters and pagination', async () => {
    const invalidQueries = [
      { skillIds: 'not-a-uuid' },
      { skillIds: '' },
      { page: 0 },
      { page: 1.5 },
      { page: 'nope' },
      { limit: 0 },
      { limit: 51 },
      { limit: 2.5 },
    ];

    for (const query of invalidQueries) {
      await request(app.getHttpServer())
        .get('/api/students')
        .query(query)
        .expect(400);
    }
  });

  it('keeps the authenticated own-profile route available', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/students/me')
      .set('Authorization', `Bearer ${zara.token}`)
      .expect(200);

    expect(response.body.id).toBe(zara.profileId);
    expect(response.body.fullName).toBe('Zara Match Two');
  });

  afterAll(async () => {
    try {
      if (prisma && (createdUserEmails.size > 0 || createdSkillIds.size > 0)) {
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

        for (const id of createdSkillIds) {
          try {
            const skill = await prisma.skill.findUnique({
              where: { id },
              select: { id: true },
            });
            if (skill) {
              await prisma.skill.delete({ where: { id: skill.id } });
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
