import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppModule } from '../src/app.module';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const createdUserEmails = new Set<string>();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);

    // Verify the actual PostgreSQL database before any writes.
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
  });

  it('POST /api/auth/register rejects duplicate emails', async () => {
    const email = `e2e-${randomUUID()}@example.com`;
    createdUserEmails.add(email);

    const firstResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'Student123!',
        fullName: 'First Student',
      })
      .expect(201);

    const duplicateResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'Another123!',
        fullName: 'Second Student',
      })
      .expect(409);

    expect(duplicateResponse.body.message).toBe('Email is already registered');
  });

  it('POST /api/auth/register rejects a password without digits', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `e2e-${randomUUID()}@example.com`,
        password: 'PasswordOnly!',
        fullName: 'Invalid Student',
      })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(response.body.message).toBeDefined();
  });

  it('POST /api/auth/login returns a JWT for valid credentials', async () => {
    const email = `e2e-${randomUUID()}@example.com`;
    createdUserEmails.add(email);
    const password = 'Student123!';

    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password,
        fullName: 'Login Test Student',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.tokenType).toBe('Bearer');
    expect(response.body.expiresIn).toBe(3600);

    const jwtService = app.get(JwtService);

    const payload = await jwtService.verifyAsync<{
      sub: string;
      iat: number;
      exp: number;
    }>(response.body.accessToken, {
      algorithms: ['HS256'],
    });

    expect(payload.sub).toBe(registration.body.id);
    expect(payload.exp - payload.iat).toBe(3600);

    expect(response.body.passwordHash).toBeUndefined();
    expect(response.body.password).toBeUndefined();
  });

  it('POST /api/auth/login rejects an incorrect password', async () => {
    const email = `e2e-${randomUUID()}@example.com`;
    createdUserEmails.add(email);

    const registration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'Student123!',
        fullName: 'Wrong Password Student',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email,
        password: 'WrongPassword123!',
      })
      .expect(401);

    expect(response.body.statusCode).toBe(401);
    expect(response.body.message).toBe('Invalid email or password');
    expect(response.body.accessToken).toBeUndefined();
  });

  it('POST /api/auth/login rejects an unknown email', async () => {
    const email = `e2e-unknown-${randomUUID()}@example.com`;

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email,
        password: 'Student123!',
      })
      .expect(401);

    expect(response.body.statusCode).toBe(401);
    expect(response.body.message).toBe('Invalid email or password');
    expect(response.body.accessToken).toBeUndefined();
  });

  it('POST /api/auth/register creates a private student account', async () => {
    const email = `e2e-${randomUUID()}@example.com`;
    createdUserEmails.add(email);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'Student123!',
        fullName: 'E2E Test Student',
      })
      .expect(201);

    expect(response.body.email).toBe(email);
    expect(response.body.profile.fullName).toBe('E2E Test Student');
    expect(response.body.profile.isPublic).toBe(false);

    expect(response.body.id).toBeDefined();
    expect(response.body.profile.id).toBeDefined();

    expect(response.body.passwordHash).toBeUndefined();
    expect(response.body.password).toBeUndefined();
  });

  it('normalizes email to lowercase during registration', async () => {
    const email = `e2e-${randomUUID()}@example.com`;
    const mixedCaseEmail = email.toUpperCase();

    createdUserEmails.add(email);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: mixedCaseEmail,
        password: 'Student123!',
        fullName: 'Email Normalization Student',
      })
      .expect(201);

    expect(response.body.email).toBe(email);

    const storedUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    expect(storedUser).not.toBeNull();
    expect(storedUser?.email).toBe(email);
  });

  it('allows login with uppercase email', async () => {
    const email = `e2e-${randomUUID()}@example.com`;
    const password = 'Student123!';

    createdUserEmails.add(email);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password,
        fullName: 'Case Insensitive Login Student',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: email.toUpperCase(),
        password,
      })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.tokenType).toBe('Bearer');
  });

  it('rejects duplicate registration regardless of email case', async () => {
    const email = `e2e-${randomUUID()}@example.com`;
    createdUserEmails.add(email);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'Student123!',
        fullName: 'First Student',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: email.toUpperCase(),
        password: 'Another123!',
        fullName: 'Second Student',
      })
      .expect(409);

    expect(response.body.message).toBe('Email is already registered');

    const count = await prisma.user.count({
      where: { email },
    });

    expect(count).toBe(1);
  });

  it('rejects login passwords exceeding 72 UTF-8 bytes', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: `e2e-unknown-${randomUUID()}@example.com`,
        password: 'a'.repeat(73),
      })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(response.body.message).toContain(
      'password must not exceed 72 UTF-8 bytes',
    );
  });

  it('accepts a password of exactly 72 UTF-8 bytes during registration', async () => {
    const email = `e2e-${randomUUID()}@example.com`;
    const password = 'Student1' + 'a'.repeat(64);

    expect(Buffer.byteLength(password, 'utf8')).toBe(72);
    createdUserEmails.add(email);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password,
        fullName: 'Password Boundary Student',
      })
      .expect(201);

    expect(response.body.email).toBe(email);
  });

  it('rejects a multibyte password exceeding 72 UTF-8 bytes', async () => {
    const password = 'Student1' + 'é'.repeat(33);

    expect(password.length).toBe(41);
    expect(Buffer.byteLength(password, 'utf8')).toBe(74);

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: `e2e-unknown-${randomUUID()}@example.com`,
        password,
      })
      .expect(400);

    expect(response.body.message).toContain(
      'password must not exceed 72 UTF-8 bytes',
    );
  });

  it('rejects registration passwords exceeding 72 UTF-8 bytes', async () => {
    const email = `e2e-${randomUUID()}@example.com`;
    const password = 'Student1' + 'a'.repeat(65);

    expect(Buffer.byteLength(password, 'utf8')).toBe(73);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password,
        fullName: 'Invalid Password Student',
      })
      .expect(400);

    expect(response.body.message).toContain(
      'password must not exceed 72 UTF-8 bytes',
    );

    const user = await prisma.user.findUnique({
      where: { email },
    });

    expect(user).toBeNull();
  });

  afterAll(async () => {
    try {
      if (prisma && createdUserEmails.size > 0) {
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
              where: {
                id: user.id,
                email,
              },
            });
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
