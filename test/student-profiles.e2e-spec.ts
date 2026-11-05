import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Student profiles (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerToken: string;
  let secondStudentToken: string;
  let ownerProfileId: string;
  let ownerEmail: string;
  let secondStudentEmail: string;
  let missingProfileToken: string;
  let ownerSkillId: string;

  const createdUserEmails = new Set<string>();
  const createdSkillIds = new Set<string>();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);

    const result = await prisma.$queryRaw<
      Array<{ database_name: string }>
    >`SELECT current_database() AS database_name`;

    if (result[0]?.database_name !== 'gaza_talent_connect_test') {
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

    const jwtService = app.get(JwtService);
    const owner = await createStudent('Owner Student');
    const secondStudent = await createStudent('Second Student');

    ownerEmail = owner.email;
    ownerProfileId = owner.profileId;
    ownerToken = owner.accessToken;
    secondStudentEmail = secondStudent.email;
    secondStudentToken = secondStudent.accessToken;
    const studentWithoutProfile = await createStudent('No Profile Student');
    missingProfileToken = studentWithoutProfile.accessToken;

    await prisma.studentProfile.delete({
      where: { id: studentWithoutProfile.profileId },
    });

    const skill = await prisma.skill.create({
      data: { name: `e2e-skill-${randomUUID()}` },
      select: { id: true },
    });
    ownerSkillId = skill.id;
    createdSkillIds.add(skill.id);

    await prisma.studentSkill.create({
      data: {
        studentProfileId: ownerProfileId,
        skillId: ownerSkillId,
      },
    });

    // Ensure both test credentials produce usable bearer tokens through the real auth flow.
    await jwtService.verifyAsync(ownerToken, { algorithms: ['HS256'] });
    await jwtService.verifyAsync(secondStudentToken, {
      algorithms: ['HS256'],
    });
  }, 30_000);

  async function createStudent(fullName: string) {
    const email = `e2e-profile-${randomUUID()}@example.com`;
    createdUserEmails.add(email);

    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Student123!', fullName })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'Student123!' })
      .expect(200);

    return {
      email,
      profileId: registration.body.profile.id as string,
      accessToken: login.body.accessToken as string,
    };
  }

  it('rejects requests without a JWT', async () => {
    await request(app.getHttpServer()).get('/api/students/me').expect(401);
  });

  it('rejects requests with an invalid JWT', async () => {
    await request(app.getHttpServer())
      .get('/api/students/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('returns 404 when the authenticated user has no profile', async () => {
    await request(app.getHttpServer())
      .get('/api/students/me')
      .set('Authorization', `Bearer ${missingProfileToken}`)
      .expect(404);
  });

  it('returns the authenticated student profile, including when hidden', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body).toEqual({
      id: ownerProfileId,
      fullName: 'Owner Student',
      bio: null,
      location: null,
      contactEmail: null,
      githubUrl: null,
      portfolioUrl: null,
      isPublic: false,
      skills: [{ id: ownerSkillId, name: expect.stringMatching(/^e2e-skill-/) }],
    });
  });

  it('returns only the profile belonging to the authenticated user', async () => {
    const ownerResponse = await request(app.getHttpServer())
      .get('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const secondStudentResponse = await request(app.getHttpServer())
      .get('/api/students/me')
      .set('Authorization', `Bearer ${secondStudentToken}`)
      .expect(200);

    expect(ownerResponse.body.id).toBe(ownerProfileId);
    expect(secondStudentResponse.body.id).not.toBe(ownerProfileId);
    expect(secondStudentResponse.body.fullName).toBe('Second Student');
    expect(secondStudentResponse.body.skills).toEqual([]);
  });

  it('returns only approved profile fields and does not leak account credentials', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

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
      ].sort(),
    );
    expect(JSON.stringify(response.body)).not.toContain(ownerEmail);
    expect(JSON.stringify(response.body)).not.toContain(secondStudentEmail);
    expect(response.body.email).toBeUndefined();
    expect(response.body.password).toBeUndefined();
    expect(response.body.passwordHash).toBeUndefined();
    expect(response.body.userId).toBeUndefined();
  });

  afterAll(async () => {
    try {
      if (prisma && (createdUserEmails.size > 0 || createdSkillIds.size > 0)) {
        const result = await prisma.$queryRaw<
          Array<{ database_name: string }>
        >`SELECT current_database() AS database_name`;

        if (result[0]?.database_name !== 'gaza_talent_connect_test') {
          throw new Error('E2E cleanup safety check failed');
        }

        for (const email of createdUserEmails) {
          const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true },
          });

          if (user) {
            await prisma.user.delete({
              where: { id: user.id, email },
            });
          }
        }

        for (const id of createdSkillIds) {
          const skill = await prisma.skill.findUnique({
            where: { id },
            select: { id: true },
          });

          if (skill) {
            await prisma.skill.delete({ where: { id: skill.id } });
          }
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });
});
