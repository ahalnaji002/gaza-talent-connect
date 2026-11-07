import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'Feedback123!';

interface StudentFixture {
  email: string;
  userId: string;
  profileId: string;
  token: string;
}

interface CompanyFixture {
  email: string;
  userId: string;
  companyId: string;
  name: string;
  token: string;
}

type Body = Record<string, unknown>;

/** Typed view of a JSON response body, so tests avoid untyped any access. */
const body = (response: { body: unknown }): Body => response.body as Body;

/** Jest matcher for any string, held as unknown so object literals stay typed. */
const anyString: unknown = expect.any(String);

describe('Job titles and private company feedback (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let publishedStudent: StudentFixture;
  let otherStudent: StudentFixture;
  let hiddenStudent: StudentFixture;
  let company: CompanyFixture;
  let otherCompany: CompanyFixture;
  let skillId: string;
  let feedbackId: string;

  const runId = randomUUID().slice(0, 8);
  const privateMessage = `Private feedback ${runId}: strong NestJS fundamentals.`;
  const createdUserEmails = new Set<string>();
  const createdSkillIds = new Set<string>();

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

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

    publishedStudent = await createStudent('Published Feedback Student');
    otherStudent = await createStudent('Other Feedback Student');
    hiddenStudent = await createStudent('Hidden Feedback Student');
    company = await createCompany(`Acme Hiring ${runId}`);
    otherCompany = await createCompany(`Other Corp ${runId}`);

    const skill = await prisma.skill.create({
      data: { name: `e2e-feedback-skill-${randomUUID()}` },
      select: { id: true },
    });
    skillId = skill.id;
    createdSkillIds.add(skill.id);

    await http()
      .patch('/api/students/me')
      .set(auth(publishedStudent.token))
      .send({
        contactEmail: `published-${runId}@public.example.com`,
        isPublic: true,
      })
      .expect(200);
    await http()
      .put('/api/students/me/skills')
      .set(auth(publishedStudent.token))
      .send({ skillIds: [skillId] })
      .expect(200);
    await http()
      .patch('/api/students/me')
      .set(auth(otherStudent.token))
      .send({
        contactEmail: `other-${runId}@public.example.com`,
        isPublic: true,
      })
      .expect(200);
  }, 60_000);

  async function createStudent(fullName: string): Promise<StudentFixture> {
    const email = `e2e-fb-student-${randomUUID()}@example.com`;
    createdUserEmails.add(email);

    const registration = await http()
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, fullName })
      .expect(201);
    const login = await http()
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    return {
      email,
      userId: body(registration).id as string,
      profileId: (body(registration).profile as { id: string }).id,
      token: body(login).accessToken as string,
    };
  }

  async function createCompany(name: string): Promise<CompanyFixture> {
    const email = `e2e-fb-company-${randomUUID()}@example.com`;
    createdUserEmails.add(email);

    const registration = await http()
      .post('/api/auth/register/company')
      .send({ email, password: PASSWORD, companyName: name })
      .expect(201);
    const login = await http()
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    return {
      email,
      name,
      userId: body(registration).id as string,
      companyId: (body(registration).companyProfile as { id: string }).id,
      token: body(login).accessToken as string,
    };
  }

  describe('accounts and roles', () => {
    it('registers a company with a server-assigned role and no secrets in the response', async () => {
      const email = `e2e-fb-company-${randomUUID()}@example.com`;
      createdUserEmails.add(email);

      const response = await http()
        .post('/api/auth/register/company')
        .send({ email, password: PASSWORD, companyName: '  Trimmed Co  ' })
        .expect(201);

      expect(response.body).toEqual({
        id: anyString,
        email,
        role: 'COMPANY',
        companyProfile: { id: anyString, name: 'Trimmed Co' },
      });
      expect(JSON.stringify(response.body)).not.toMatch(/password/i);
    });

    it('rejects a client-supplied role on either registration route', async () => {
      await http()
        .post('/api/auth/register')
        .send({
          email: `e2e-fb-role-${randomUUID()}@example.com`,
          password: PASSWORD,
          fullName: 'Role Injector',
          role: 'COMPANY',
        })
        .expect(400);

      await http()
        .post('/api/auth/register/company')
        .send({
          email: `e2e-fb-role-${randomUUID()}@example.com`,
          password: PASSWORD,
          companyName: 'Role Injector Co',
          role: 'ADMIN',
        })
        .expect(400);
    });

    it('validates company registration input', async () => {
      const cases: Body[] = [
        { email: 'not-an-email', password: PASSWORD, companyName: 'Valid Co' },
        {
          email: `e2e-fb-${randomUUID()}@example.com`,
          password: 'short1',
          companyName: 'Valid Co',
        },
        {
          email: `e2e-fb-${randomUUID()}@example.com`,
          password: PASSWORD,
          companyName: ' A ',
        },
        {
          email: `e2e-fb-${randomUUID()}@example.com`,
          password: PASSWORD,
          companyName: 'C'.repeat(151),
        },
        { email: `e2e-fb-${randomUUID()}@example.com`, password: PASSWORD },
      ];

      for (const body of cases) {
        await http().post('/api/auth/register/company').send(body).expect(400);
      }
    });

    it('rejects a company registration using an existing student email', async () => {
      const response = await http()
        .post('/api/auth/register/company')
        .send({
          email: publishedStudent.email.toUpperCase(),
          password: PASSWORD,
          companyName: 'Duplicate Co',
        })
        .expect(409);

      expect(body(response).message).toBe('Email is already registered');
    });

    it('keeps student registration and login working and reports roles on login', async () => {
      const studentLogin = await http()
        .post('/api/auth/login')
        .send({ email: publishedStudent.email, password: PASSWORD })
        .expect(200);
      expect(studentLogin.body).toMatchObject({
        accessToken: anyString,
        tokenType: 'Bearer',
        expiresIn: 3600,
        role: 'STUDENT',
      });

      const companyLogin = await http()
        .post('/api/auth/login')
        .send({ email: company.email.toUpperCase(), password: PASSWORD })
        .expect(200);
      expect(body(companyLogin).role).toBe('COMPANY');

      // The token format is unchanged: only the user ID is signed, never the role.
      const payload = await app
        .get(JwtService)
        .verifyAsync<Body>(body(companyLogin).accessToken as string, {
          algorithms: ['HS256'],
        });
      expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
    });

    it('returns the authenticated company identity only to companies', async () => {
      const response = await http()
        .get('/api/companies/me')
        .set(auth(company.token))
        .expect(200);
      expect(response.body).toEqual({
        id: company.companyId,
        name: company.name,
      });

      await http()
        .get('/api/companies/me')
        .set(auth(publishedStudent.token))
        .expect(403);
      await http().get('/api/companies/me').expect(401);
    });

    it('rejects a valid token whose account no longer exists', async () => {
      const ghost = await createCompany(`Ghost Co ${runId}`);
      await prisma.user.delete({ where: { id: ghost.userId } });

      await http().get('/api/companies/me').set(auth(ghost.token)).expect(401);
    });
  });

  describe('job title', () => {
    it('trims and stores the job title, returning it on the own profile', async () => {
      const response = await http()
        .patch('/api/students/me')
        .set(auth(publishedStudent.token))
        .send({ jobTitle: '   Backend Developer   ' })
        .expect(200);

      expect(body(response).jobTitle).toBe('Backend Developer');

      const own = await http()
        .get('/api/students/me')
        .set(auth(publishedStudent.token))
        .expect(200);
      expect(body(own).jobTitle).toBe('Backend Developer');
    });

    it('accepts exactly 100 characters and rejects longer or non-string values', async () => {
      const hundred = 'J'.repeat(100);
      const ok = await http()
        .patch('/api/students/me')
        .set(auth(otherStudent.token))
        .send({ jobTitle: `  ${hundred}  ` })
        .expect(200);
      expect(body(ok).jobTitle).toBe(hundred);

      await http()
        .patch('/api/students/me')
        .set(auth(otherStudent.token))
        .send({ jobTitle: 'J'.repeat(101) })
        .expect(400);
      await http()
        .patch('/api/students/me')
        .set(auth(otherStudent.token))
        .send({ jobTitle: 42 })
        .expect(400);

      const unchanged = await http()
        .get('/api/students/me')
        .set(auth(otherStudent.token))
        .expect(200);
      expect(body(unchanged).jobTitle).toBe(hundred);
    });

    it('clears the job title with an empty string or null', async () => {
      const blank = await http()
        .patch('/api/students/me')
        .set(auth(otherStudent.token))
        .send({ jobTitle: '    ' })
        .expect(200);
      expect(body(blank).jobTitle).toBeNull();

      await http()
        .patch('/api/students/me')
        .set(auth(otherStudent.token))
        .send({ jobTitle: 'Data Analyst' })
        .expect(200);
      const cleared = await http()
        .patch('/api/students/me')
        .set(auth(otherStudent.token))
        .send({ jobTitle: null })
        .expect(200);
      expect(body(cleared).jobTitle).toBeNull();
    });

    it('is not required to publish a profile', async () => {
      const response = await http()
        .get('/api/students/me')
        .set(auth(otherStudent.token))
        .expect(200);
      expect(response.body).toMatchObject({ isPublic: true, jobTitle: null });
    });

    it('appears in public discovery and public detail for published profiles', async () => {
      const discovery = await http()
        .get(`/api/students?skillIds=${skillId}`)
        .expect(200);
      expect(body(discovery).data).toEqual([
        expect.objectContaining({
          id: publishedStudent.profileId,
          jobTitle: 'Backend Developer',
        }),
      ]);

      const detail = await http()
        .get(`/api/students/${publishedStudent.profileId}`)
        .expect(200);
      expect(body(detail).jobTitle).toBe('Backend Developer');
    });

    it('never exposes the job title of a hidden profile', async () => {
      const hiddenTitle = `Hidden Title ${runId}`;
      await http()
        .patch('/api/students/me')
        .set(auth(hiddenStudent.token))
        .send({ jobTitle: hiddenTitle })
        .expect(200);

      await http().get(`/api/students/${hiddenStudent.profileId}`).expect(404);
      const discovery = await http().get('/api/students?limit=50').expect(200);
      expect(JSON.stringify(discovery.body)).not.toContain(hiddenTitle);
    });
  });

  describe('feedback creation', () => {
    it('lets a company write feedback for a published student', async () => {
      const response = await http()
        .post('/api/feedback')
        .set(auth(company.token))
        .send({
          studentProfileId: publishedStudent.profileId,
          message: `   ${privateMessage}   `,
        })
        .expect(201);

      expect(response.body).toEqual({
        id: anyString,
        message: privateMessage,
        createdAt: anyString,
        updatedAt: anyString,
        student: {
          id: publishedStudent.profileId,
          fullName: 'Published Feedback Student',
        },
      });
      feedbackId = body(response).id as string;
    });

    it('rejects empty, blank, oversized and malformed feedback', async () => {
      const cases: Body[] = [
        { studentProfileId: publishedStudent.profileId, message: '' },
        { studentProfileId: publishedStudent.profileId, message: '   \n  ' },
        {
          studentProfileId: publishedStudent.profileId,
          message: 'M'.repeat(2001),
        },
        { studentProfileId: publishedStudent.profileId, message: 123 },
        { studentProfileId: publishedStudent.profileId },
        { message: 'Missing student' },
        { studentProfileId: 'not-a-uuid', message: 'Hello' },
        {
          studentProfileId: publishedStudent.profileId,
          message: 'Hello',
          companyProfileId: otherCompany.companyId,
        },
      ];

      for (const body of cases) {
        await http()
          .post('/api/feedback')
          .set(auth(company.token))
          .send(body)
          .expect(400);
      }
    });

    it('accepts a message of exactly 2,000 characters', async () => {
      const response = await http()
        .post('/api/feedback')
        .set(auth(otherCompany.token))
        .send({
          studentProfileId: otherStudent.profileId,
          message: 'M'.repeat(2000),
        })
        .expect(201);
      expect(body(response).message).toHaveLength(2000);
    });

    it('returns the same 404 for hidden and nonexistent students', async () => {
      const hidden = await http()
        .post('/api/feedback')
        .set(auth(company.token))
        .send({ studentProfileId: hiddenStudent.profileId, message: 'Hello' })
        .expect(404);
      const missing = await http()
        .post('/api/feedback')
        .set(auth(company.token))
        .send({ studentProfileId: randomUUID(), message: 'Hello' })
        .expect(404);

      expect(body(hidden).message).toBe(body(missing).message);
      expect(
        await prisma.companyFeedback.count({
          where: { studentProfileId: hiddenStudent.profileId },
        }),
      ).toBe(0);
    });
  });

  describe('feedback privacy', () => {
    it('shows the student only feedback addressed to them, with the company name', async () => {
      const response = await http()
        .get('/api/students/me/feedback')
        .set(auth(publishedStudent.token))
        .expect(200);

      expect(response.body).toEqual({
        data: [
          {
            id: feedbackId,
            message: privateMessage,
            createdAt: anyString,
            updatedAt: anyString,
            company: { name: company.name },
          },
        ],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
      expect(JSON.stringify(response.body)).not.toContain(company.email);
      expect(JSON.stringify(response.body)).not.toContain(company.companyId);
    });

    it('shows the company only its own feedback', async () => {
      const response = await http()
        .get('/api/feedback/sent')
        .set(auth(company.token))
        .expect(200);

      expect(body(response).meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      expect(body(response).data).toEqual([
        expect.objectContaining({
          id: feedbackId,
          message: privateMessage,
          student: {
            id: publishedStudent.profileId,
            fullName: 'Published Feedback Student',
          },
        }),
      ]);
      expect(JSON.stringify(response.body)).not.toContain(
        publishedStudent.email,
      );
    });

    it('hides the feedback from another company', async () => {
      const sent = await http()
        .get('/api/feedback/sent')
        .set(auth(otherCompany.token))
        .expect(200);
      expect(JSON.stringify(sent.body)).not.toContain(privateMessage);
      expect(
        (body(sent).data as Array<{ id: string }>).map(({ id }) => id),
      ).not.toContain(feedbackId);

      await http()
        .patch(`/api/feedback/${feedbackId}`)
        .set(auth(otherCompany.token))
        .send({ message: 'Hijacked' })
        .expect(404);
      await http()
        .delete(`/api/feedback/${feedbackId}`)
        .set(auth(otherCompany.token))
        .expect(404);

      const stored = await prisma.companyFeedback.findUnique({
        where: { id: feedbackId },
        select: { message: true },
      });
      expect(stored?.message).toBe(privateMessage);
    });

    it('hides the feedback from another student', async () => {
      const response = await http()
        .get('/api/students/me/feedback')
        .set(auth(otherStudent.token))
        .expect(200);

      expect(JSON.stringify(response.body)).not.toContain(privateMessage);
      expect(
        (body(response).data as Array<{ id: string }>).map(({ id }) => id),
      ).not.toContain(feedbackId);
    });

    it('rejects anonymous access to every feedback and company route', async () => {
      await http().get('/api/students/me/feedback').expect(401);
      await http().get('/api/feedback/sent').expect(401);
      await http()
        .post('/api/feedback')
        .send({ studentProfileId: publishedStudent.profileId, message: 'Hi' })
        .expect(401);
      await http()
        .patch(`/api/feedback/${feedbackId}`)
        .send({ message: 'Hi' })
        .expect(401);
      await http().delete(`/api/feedback/${feedbackId}`).expect(401);
      await http()
        .get('/api/students/me/feedback')
        .set('Authorization', 'Bearer not.a.token')
        .expect(401);
    });

    it('forbids students from company-only routes', async () => {
      const token = publishedStudent.token;
      await http()
        .post('/api/feedback')
        .set(auth(token))
        .send({ studentProfileId: otherStudent.profileId, message: 'Hi' })
        .expect(403);
      await http().get('/api/feedback/sent').set(auth(token)).expect(403);
      await http()
        .patch(`/api/feedback/${feedbackId}`)
        .set(auth(token))
        .send({ message: 'Changed by student' })
        .expect(403);
      await http()
        .delete(`/api/feedback/${feedbackId}`)
        .set(auth(token))
        .expect(403);
      await http().get('/api/companies/me').set(auth(token)).expect(403);
    });

    it('forbids companies from student-only routes', async () => {
      const token = company.token;
      await http().get('/api/students/me').set(auth(token)).expect(403);
      await http()
        .patch('/api/students/me')
        .set(auth(token))
        .send({ bio: 'Company should not edit this' })
        .expect(403);
      await http()
        .put('/api/students/me/skills')
        .set(auth(token))
        .send({ skillIds: [] })
        .expect(403);
      await http()
        .get('/api/students/me/feedback')
        .set(auth(token))
        .expect(403);
      await http()
        .post('/api/projects')
        .set(auth(token))
        .send({ title: 'Company project' })
        .expect(403);
      await http().get('/api/projects/me').set(auth(token)).expect(403);
      await http()
        .patch(`/api/projects/${randomUUID()}`)
        .set(auth(token))
        .send({ title: 'Nope' })
        .expect(403);
      await http()
        .delete(`/api/projects/${randomUUID()}`)
        .set(auth(token))
        .expect(403);
    });

    it('never exposes feedback through public discovery or public profiles', async () => {
      const discovery = await http()
        .get(`/api/students?skillIds=${skillId}`)
        .expect(200);
      const detail = await http()
        .get(`/api/students/${publishedStudent.profileId}`)
        .expect(200);
      const all = await http().get('/api/students?limit=50').expect(200);

      for (const payload of [discovery.body, detail.body, all.body]) {
        const json = JSON.stringify(payload);
        expect(json).not.toContain(privateMessage);
        expect(json).not.toContain(company.name);
        expect(json).not.toContain('"feedback"');
      }
      expect(body(detail).feedback).toBeUndefined();
    });
  });

  describe('feedback management', () => {
    it('lets the authoring company edit its feedback', async () => {
      const response = await http()
        .patch(`/api/feedback/${feedbackId}`)
        .set(auth(company.token))
        .send({ message: '  Updated private note.  ' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: feedbackId,
        message: 'Updated private note.',
      });

      await http()
        .patch(`/api/feedback/${feedbackId}`)
        .set(auth(company.token))
        .send({ message: '   ' })
        .expect(400);
      await http()
        .patch('/api/feedback/not-a-uuid')
        .set(auth(company.token))
        .send({ message: 'Hello' })
        .expect(400);
    });

    it('paginates sent and received feedback', async () => {
      for (const text of ['Second note', 'Third note']) {
        await http()
          .post('/api/feedback')
          .set(auth(company.token))
          .send({ studentProfileId: publishedStudent.profileId, message: text })
          .expect(201);
      }

      const page = await http()
        .get('/api/students/me/feedback?page=2&limit=2')
        .set(auth(publishedStudent.token))
        .expect(200);
      expect(body(page).meta).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
      expect(body(page).data).toHaveLength(1);

      await http()
        .get('/api/feedback/sent?limit=51')
        .set(auth(company.token))
        .expect(400);
      await http()
        .get('/api/students/me/feedback?page=0')
        .set(auth(publishedStudent.token))
        .expect(400);
    });

    it('lets the authoring company delete its feedback', async () => {
      await http()
        .delete(`/api/feedback/${feedbackId}`)
        .set(auth(company.token))
        .expect(204);
      await http()
        .delete(`/api/feedback/${feedbackId}`)
        .set(auth(company.token))
        .expect(404);

      const received = await http()
        .get('/api/students/me/feedback')
        .set(auth(publishedStudent.token))
        .expect(200);
      expect(
        (body(received).data as Array<{ id: string }>).map(({ id }) => id),
      ).not.toContain(feedbackId);
    });

    it('keeps existing student profile, skills and projects behavior', async () => {
      const token = otherStudent.token;
      const project = await http()
        .post('/api/projects')
        .set(auth(token))
        .send({ title: 'Regression Project' })
        .expect(201);
      await http()
        .get('/api/projects/me')
        .set(auth(token))
        .expect(200)
        .expect((response) => {
          expect((response.body as Array<{ id: string }>)[0]?.id).toBe(
            body(project).id,
          );
        });
      await http()
        .put('/api/students/me/skills')
        .set(auth(token))
        .send({ skillIds: [skillId] })
        .expect(200);
      await http()
        .delete(`/api/projects/${body(project).id as string}`)
        .set(auth(token))
        .expect(204);
    });
  });

  afterAll(async () => {
    try {
      if (prisma) {
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
