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

  async function waitForProfileLockWaiters(
    blockerPid: number,
    minimum: number,
  ) {
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      const result = await prisma.$queryRaw<
        Array<{
          waiter_pid: number;
          wait_event: string | null;
          database_name: string;
          blocking_chain: number[];
        }>
      >`WITH RECURSIVE profile_lock_waiters AS (
          SELECT pid, current_database() AS database_name, wait_event, query
          FROM pg_stat_activity
          WHERE datname = current_database()
            AND pid <> pg_backend_pid()
            AND wait_event_type = 'Lock'
            AND state = 'active'
            AND query ILIKE '%FROM student_profiles%'
            AND query ILIKE '%FOR UPDATE%'
        ), blocking_chain(waiter_pid, blocking_pid, path) AS (
          SELECT pid, pid, ARRAY[pid]::int[]
          FROM profile_lock_waiters
          UNION ALL
          SELECT chain.waiter_pid,
                 blocker.pid,
                 chain.path || blocker.pid
          FROM blocking_chain AS chain
          CROSS JOIN LATERAL unnest(
            pg_blocking_pids(chain.blocking_pid)
          ) AS blocker(pid)
          WHERE chain.blocking_pid <> ${blockerPid}::int
            AND NOT blocker.pid = ANY(chain.path)
            AND cardinality(chain.path) < 8
        )
        SELECT waiter.pid AS waiter_pid,
               waiter.wait_event,
               waiter.database_name,
               chain.path AS blocking_chain
        FROM profile_lock_waiters AS waiter
        JOIN blocking_chain AS chain ON chain.waiter_pid = waiter.pid
        WHERE chain.blocking_pid = ${blockerPid}::int
        ORDER BY waiter.pid`;

      if (
        result.some(
          (waiter) => waiter.database_name !== 'gaza_talent_connect_test',
        )
      ) {
        throw new Error('Lock waiter is connected to an unexpected database');
      }

      if (result.length >= minimum) {
        return result;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    return [];
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
      skills: [
        { id: ownerSkillId, name: expect.stringMatching(/^e2e-skill-/) },
      ],
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

  it('rejects profile updates without a JWT', async () => {
    await request(app.getHttpServer())
      .patch('/api/students/me')
      .send({ bio: 'unauthorized update' })
      .expect(401);
  });

  it('updates the authenticated profile and returns the approved shape', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        fullName: 'Updated Owner',
        bio: 'Backend developer',
        location: 'Gaza',
        contactEmail: 'owner.contact@example.com',
        githubUrl: 'https://github.com/owner',
        portfolioUrl: 'http://owner.example.com',
        isPublic: false,
      })
      .expect(200);

    expect(response.body).toEqual({
      id: ownerProfileId,
      fullName: 'Updated Owner',
      bio: 'Backend developer',
      location: 'Gaza',
      contactEmail: 'owner.contact@example.com',
      githubUrl: 'https://github.com/owner',
      portfolioUrl: 'http://owner.example.com',
      isPublic: false,
      skills: [
        { id: ownerSkillId, name: expect.stringMatching(/^e2e-skill-/) },
      ],
    });
    expect(JSON.stringify(response.body)).not.toContain(ownerEmail);
    expect(response.body.userId).toBeUndefined();
    expect(response.body.passwordHash).toBeUndefined();
  });

  it('updates only the profile belonging to the authenticated user', async () => {
    await request(app.getHttpServer())
      .patch('/api/students/me')
      .set('Authorization', `Bearer ${secondStudentToken}`)
      .send({ fullName: 'Updated Second Student' })
      .expect(200);

    const ownerResponse = await request(app.getHttpServer())
      .get('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const secondStudentResponse = await request(app.getHttpServer())
      .get('/api/students/me')
      .set('Authorization', `Bearer ${secondStudentToken}`)
      .expect(200);

    expect(ownerResponse.body.fullName).toBe('Updated Owner');
    expect(secondStudentResponse.body.fullName).toBe('Updated Second Student');
  });

  it('rejects fields outside the profile update contract', async () => {
    await request(app.getHttpServer())
      .patch('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        fullName: 'Must Not Be Applied',
        id: 'attacker-id',
        userId: 'attacker-user-id',
        skills: [],
        email: 'attacker@example.com',
      })
      .expect(400);

    const response = await request(app.getHttpServer())
      .get('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(response.body.fullName).toBe('Updated Owner');
  });

  it('accepts the approved maximum profile field lengths', async () => {
    const fullName = 'N'.repeat(150);
    const bio = 'b'.repeat(1000);
    const location = 'l'.repeat(150);

    const response = await request(app.getHttpServer())
      .patch('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ fullName, bio, location })
      .expect(200);

    expect(response.body.fullName).toHaveLength(150);
    expect(response.body.bio).toHaveLength(1000);
    expect(response.body.location).toHaveLength(150);

    const minimumName = await request(app.getHttpServer())
      .patch('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ fullName: 'AB' })
      .expect(200);
    expect(minimumName.body.fullName).toBe('AB');
  });

  it('rejects invalid profile values and values beyond approved limits', async () => {
    const invalidPayloads: Array<Record<string, unknown>> = [
      { fullName: null },
      { fullName: 'A' },
      { fullName: 'N'.repeat(151) },
      { bio: 'b'.repeat(1001) },
      { location: 'l'.repeat(151) },
      { contactEmail: 'not-an-email' },
      { contactEmail: 'x'.repeat(256) },
      { githubUrl: 'http://github.com/owner' },
      { githubUrl: `https://github.com/${'a'.repeat(2049)}` },
      { portfolioUrl: 'ftp://owner.example.com' },
      { portfolioUrl: `https://example.com/${'a'.repeat(2049)}` },
      { isPublic: null },
    ];

    for (const payload of invalidPayloads) {
      await request(app.getHttpServer())
        .patch('/api/students/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(payload)
        .expect(400);
    }
  }, 15_000);

  it('allows null to clear nullable profile fields', async () => {
    await request(app.getHttpServer())
      .patch('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        bio: 'Temporary bio',
        location: 'Temporary location',
        contactEmail: 'temporary.contact@example.com',
        githubUrl: 'https://github.com/temporary',
        portfolioUrl: 'https://temporary.example.com',
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        bio: null,
        location: null,
        contactEmail: null,
        githubUrl: null,
        portfolioUrl: null,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      bio: null,
      location: null,
      contactEmail: null,
      githubUrl: null,
      portfolioUrl: null,
      isPublic: false,
    });
  });

  it('validates the final publication state after applying the patch', async () => {
    await request(app.getHttpServer())
      .patch('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isPublic: true })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ contactEmail: 'publish.contact@example.com' })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isPublic: true })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ contactEmail: null })
      .expect(400);

    const stillPublished = await request(app.getHttpServer())
      .get('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(stillPublished.body.isPublic).toBe(true);
    expect(stillPublished.body.contactEmail).toBe(
      'publish.contact@example.com',
    );

    const hiddenAndCleared = await request(app.getHttpServer())
      .patch('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ isPublic: false, contactEmail: null })
      .expect(200);
    expect(hiddenAndCleared.body.isPublic).toBe(false);
    expect(hiddenAndCleared.body.contactEmail).toBeNull();
  });

  it('preserves the publication invariant across concurrent updates', async () => {
    await prisma.studentProfile.update({
      where: { id: ownerProfileId },
      data: {
        isPublic: true,
        contactEmail: 'concurrent.contact@example.com',
      },
    });

    let releaseBlocker!: () => void;
    let signalBlockerReady!: (pid: number) => void;
    let rejectBlockerReady!: (error: unknown) => void;
    const blockerRelease = new Promise<void>((resolve) => {
      releaseBlocker = resolve;
    });
    const blockerReady = new Promise<number>((resolve, reject) => {
      signalBlockerReady = resolve;
      rejectBlockerReady = reject;
    });

    const blocker = prisma
      .$transaction(
        async (transaction) => {
          const lock = await transaction.$queryRaw<
            Array<{ backend_pid: number; database_name: string }>
          >`
          SELECT pg_backend_pid() AS backend_pid,
                 current_database() AS database_name
          FROM student_profiles
          WHERE id = ${ownerProfileId}::uuid
          FOR UPDATE
        `;
          if (lock.length !== 1) {
            throw new Error('Could not lock the test student profile');
          }
          if (lock[0].database_name !== 'gaza_talent_connect_test') {
            throw new Error(
              'Blocking transaction is in an unexpected database',
            );
          }

          signalBlockerReady(lock[0].backend_pid);
          await blockerRelease;
        },
        { timeout: 25_000 },
      )
      .catch((error: unknown) => {
        rejectBlockerReady(error);
        throw error;
      });

    let hideResponse:
      Promise<{ status: number; body: Record<string, unknown> }> | undefined;
    let publishResponse:
      Promise<{ status: number; body: Record<string, unknown> }> | undefined;

    try {
      const blockerPid = await blockerReady;

      // Only the hide request has been started at the first checkpoint.
      hideResponse = request(app.getHttpServer())
        .patch('/api/students/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ isPublic: false, contactEmail: null })
        .then((response) => response);

      const firstWaiterPids = await waitForProfileLockWaiters(blockerPid, 1);
      expect(firstWaiterPids).toHaveLength(1);
      expect(firstWaiterPids[0].blocking_chain).toContain(blockerPid);

      // The publish request is the only additional profile-lock operation.
      publishResponse = request(app.getHttpServer())
        .patch('/api/students/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ isPublic: true })
        .then((response) => response);

      const bothWaiterPids = await waitForProfileLockWaiters(blockerPid, 2);
      expect(bothWaiterPids).toHaveLength(2);
      const waiterPids = bothWaiterPids.map(({ waiter_pid }) => waiter_pid);
      expect(new Set(waiterPids).size).toBe(2);
      expect(waiterPids).toContain(firstWaiterPids[0].waiter_pid);
      for (const waiter of bothWaiterPids) {
        expect(waiter.blocking_chain).toContain(blockerPid);
        expect(waiter.wait_event).toBeTruthy();
      }
    } finally {
      releaseBlocker();
      const pendingResponses: Array<
        Promise<{ status: number; body: Record<string, unknown> }>
      > = [];
      if (hideResponse) pendingResponses.push(hideResponse);
      if (publishResponse) pendingResponses.push(publishResponse);
      await Promise.allSettled([blocker, ...pendingResponses]);
    }

    if (!hideResponse || !publishResponse) {
      throw new Error('Concurrent PATCH requests were not started');
    }

    const [hideResult, publishResult] = await Promise.all([
      hideResponse,
      publishResponse,
    ]);

    expect(hideResult.status).toBe(200);
    expect(publishResult.status).toBe(400);

    const finalProfile = await request(app.getHttpServer())
      .get('/api/students/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(
      finalProfile.body.isPublic !== true ||
        finalProfile.body.contactEmail === 'concurrent.contact@example.com',
    ).toBe(true);
    expect(finalProfile.body.isPublic).toBe(false);
    expect(finalProfile.body.contactEmail).toBeNull();
  }, 30_000);

  afterAll(async () => {
    try {
      if (prisma && (createdUserEmails.size > 0 || createdSkillIds.size > 0)) {
        const result = await prisma.$queryRaw<
          Array<{ database_name: string }>
        >`SELECT current_database() AS database_name`;

        if (result[0]?.database_name !== 'gaza_talent_connect_test') {
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
              await prisma.user.delete({
                where: { id: user.id, email },
              });
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
