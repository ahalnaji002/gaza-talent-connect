import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SkillsModule } from '../src/skills/skills.module';
import { INITIAL_SKILL_NAMES, seedSkills } from '../prisma/seed';

describe('Skills catalog (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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
  });

  it('seeds idempotently and lists public skills with the approved shape and order', async () => {
    await seedSkills(prisma);

    const firstSeed = await prisma.skill.findMany({
      where: { name: { in: [...INITIAL_SKILL_NAMES] } },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    expect(firstSeed).toHaveLength(INITIAL_SKILL_NAMES.length);
    expect(firstSeed.map(({ name }) => name).sort()).toEqual(
      [...INITIAL_SKILL_NAMES].sort(),
    );

    const email = `e2e-skills-${randomUUID()}@example.com`;
    createdUserEmails.add(email);
    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Student123!', fullName: 'Skills Test Student' })
      .expect(201);
    const profileId = registration.body.profile.id as string;

    const customSkill = await prisma.skill.create({
      data: { name: `e2e-skills-preserve-${randomUUID()}` },
      select: { id: true, name: true },
    });
    createdSkillIds.add(customSkill.id);
    await prisma.studentSkill.create({
      data: { studentProfileId: profileId, skillId: customSkill.id },
    });

    await seedSkills(prisma);

    const secondSeed = await prisma.skill.findMany({
      where: { name: { in: [...INITIAL_SKILL_NAMES] } },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    expect(secondSeed).toEqual(firstSeed);

    const preservedSkill = await prisma.skill.findUnique({
      where: { id: customSkill.id },
      select: { id: true, name: true },
    });
    expect(preservedSkill).toEqual(customSkill);
    const preservedLink = await prisma.studentSkill.findUnique({
      where: {
        studentProfileId_skillId: {
          studentProfileId: profileId,
          skillId: customSkill.id,
        },
      },
    });
    expect(preservedLink).not.toBeNull();

    const response = await request(app.getHttpServer())
      .get('/api/skills')
      .expect(200);
    const expectedOrder = await prisma.skill.findMany({
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const responseNames = response.body.map(
      (skill: { name: string }) => skill.name,
    );

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toEqual(expectedOrder);
    expect(responseNames).toContain(customSkill.name);
    for (const name of INITIAL_SKILL_NAMES) {
      expect(
        responseNames.filter((responseName: string) => responseName === name),
      ).toHaveLength(1);
    }
    for (const skill of response.body as Array<Record<string, unknown>>) {
      expect(Object.keys(skill).sort()).toEqual(['id', 'name']);
    }
    expect(
      response.body.every(
        (skill: { id: string; name: string }) =>
          typeof skill.id === 'string' && typeof skill.name === 'string',
      ),
    ).toBe(true);
  });

  it('does not expose public skill write routes', async () => {
    await request(app.getHttpServer())
      .post('/api/skills')
      .send({ name: 'New Skill' })
      .expect(404);
    await request(app.getHttpServer())
      .put('/api/skills')
      .send({ name: 'New Skill' })
      .expect(404);
    await request(app.getHttpServer())
      .patch('/api/skills')
      .send({ name: 'New Skill' })
      .expect(404);
    await request(app.getHttpServer()).delete('/api/skills').expect(404);
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

describe('Empty skills catalog (e2e)', () => {
  let app: INestApplication<App>;
  const findMany = jest.fn().mockResolvedValue([]);

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [PrismaModule, SkillsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ skill: { findMany } })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns 200 and an empty array without a JWT when Prisma has no skills', async () => {
    await request(app.getHttpServer()).get('/api/skills').expect(200, []);
    expect(findMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  });
});
