import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Production-hardening checks over real HTTP: CORS allowlist and preflight,
 * security headers, Swagger toggle, rate limits, client-IP spoofing and
 * startup validation. Each scenario builds its own application with the
 * environment it needs and restores process.env afterwards. Requests only
 * read data or are rejected before reaching a database write.
 */

type Env = Record<string, string | undefined>;

const ALLOWED_ORIGIN = 'https://app.example.com';
const SECOND_ORIGIN = 'https://www.example.com';
const STRONG_SECRET = randomBytes(48).toString('base64url');

const PRODUCTION_ENV: Env = {
  NODE_ENV: 'production',
  CORS_ORIGIN: `${ALLOWED_ORIGIN}, ${SECOND_ORIGIN}/`,
  JWT_SECRET: STRONG_SECRET,
  SWAGGER_ENABLED: undefined,
  CLIENT_IP_HEADER: undefined,
  RENDER: undefined,
};

/** A production deployment on a public Render web service. */
const RENDER_PRODUCTION_ENV: Env = {
  ...PRODUCTION_ENV,
  RENDER: 'true',
  CLIENT_IP_HEADER: 'cf-connecting-ip',
};

function withEnv<T>(overrides: Env, run: () => Promise<T>): Promise<T> {
  const saved = { ...process.env };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return run().finally(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) delete process.env[key];
    }
    Object.assign(process.env, saved);
  });
}

async function createApp(overrides: Env): Promise<INestApplication<App>> {
  return withEnv(overrides, async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication<INestApplication<App>>();
    configureApp(app, process.env);
    await app.init();

    const result = await app.get(PrismaService).$queryRaw<
      Array<{ database_name: string }>
    >`SELECT current_database() AS database_name`;
    if (result[0]?.database_name !== 'gaza_talent_connect_test') {
      await app.close();
      throw new Error('E2E safety check: unexpected database');
    }
    return app;
  });
}

/** Builds an app that is expected to fail startup; returns the error message. */
async function startupError(overrides: Env): Promise<string> {
  return withEnv(overrides, async () => {
    let app: INestApplication<App> | undefined;
    try {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication<INestApplication<App>>();
      configureApp(app, process.env);
      return 'no error';
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    } finally {
      await app?.close();
    }
  });
}

const badLogin = () => ({
  email: `nobody-${randomUUID()}@example.com`,
  password: 'WrongPass123',
});

describe('Production hardening (e2e)', () => {
  describe('startup validation', () => {
    it('fails without CORS_ORIGIN in production instead of allowing every origin', async () => {
      expect(
        await startupError({ ...PRODUCTION_ENV, CORS_ORIGIN: undefined }),
      ).toMatch(/CORS_ORIGIN is required in production/);
    });

    it('rejects wildcard, malformed and insecure CORS origins in production', async () => {
      expect(
        await startupError({ ...PRODUCTION_ENV, CORS_ORIGIN: '*' }),
      ).toMatch(/wildcards are not allowed/);
      expect(
        await startupError({ ...PRODUCTION_ENV, CORS_ORIGIN: 'not a url' }),
      ).toMatch(/invalid origin/);
      expect(
        await startupError({
          ...PRODUCTION_ENV,
          CORS_ORIGIN: 'http://app.example.com',
        }),
      ).toMatch(/must use https in production/);
    });

    it('rejects a short or placeholder JWT secret in production without printing it', async () => {
      const shortSecret = 'short-secret-value';
      const shortMessage = await startupError({
        ...PRODUCTION_ENV,
        JWT_SECRET: shortSecret,
      });
      expect(shortMessage).toMatch(/JWT_SECRET must be at least 32 characters/);
      expect(shortMessage).not.toContain(shortSecret);

      expect(
        await startupError({
          ...PRODUCTION_ENV,
          JWT_SECRET: 'REPLACE_WITH_A_PRIVATE_RANDOM_SECRET_1234567890',
        }),
      ).toMatch(/placeholder/);
      expect(await startupError({ ...PRODUCTION_ENV, JWT_SECRET: '' })).toMatch(
        /JWT_SECRET is not configured/,
      );
    });

    it('rejects unsafe or unknown proxy and Swagger settings', async () => {
      expect(
        await startupError({
          ...RENDER_PRODUCTION_ENV,
          CLIENT_IP_HEADER: 'X-Forwarded-For',
        }),
      ).toMatch(/cannot be X-Forwarded-For/);
      expect(
        await startupError({ ...PRODUCTION_ENV, SWAGGER_ENABLED: 'maybe' }),
      ).toMatch(/SWAGGER_ENABLED must be "true" or "false"/);
    });

    it('accepts cf-connecting-ip only for production on Render', async () => {
      expect(await startupError(RENDER_PRODUCTION_ENV)).toBe('no error');

      for (const env of [
        // Development, even if RENDER happens to be set.
        { ...RENDER_PRODUCTION_ENV, NODE_ENV: 'development' },
        // Production without the Render platform flag.
        { ...RENDER_PRODUCTION_ENV, RENDER: undefined },
        { ...RENDER_PRODUCTION_ENV, RENDER: 'false' },
      ]) {
        expect(await startupError(env)).toMatch(
          /only allowed when NODE_ENV=production and RENDER=true/,
        );
      }
    });

    it('rejects True-Client-IP in every environment', async () => {
      for (const env of [
        { ...RENDER_PRODUCTION_ENV, CLIENT_IP_HEADER: 'True-Client-IP' },
        {
          ...RENDER_PRODUCTION_ENV,
          NODE_ENV: 'development',
          CLIENT_IP_HEADER: 'true-client-ip',
        },
      ]) {
        expect(await startupError(env)).toMatch(/cannot be True-Client-IP/);
      }
    });
  });

  describe('production defaults', () => {
    let app: INestApplication<App>;
    const http = () => request(app.getHttpServer());

    beforeAll(async () => {
      app = await createApp(PRODUCTION_ENV);
    }, 30_000);

    afterAll(async () => {
      await app?.close();
    });

    it('allows configured origins (normalized) and echoes only that origin', async () => {
      for (const origin of [ALLOWED_ORIGIN, SECOND_ORIGIN]) {
        const response = await http()
          .get('/api/skills')
          .set('Origin', origin)
          .expect(200);
        expect(response.headers['access-control-allow-origin']).toBe(origin);
        expect(response.headers['vary']).toMatch(/Origin/i);
        expect(
          response.headers['access-control-allow-credentials'],
        ).toBeUndefined();
      }
    });

    it('does not grant CORS to other or look-alike origins', async () => {
      for (const origin of [
        'https://evil.example',
        'https://app.example.com.evil.test',
        'http://app.example.com',
        'http://localhost:5173',
        'null',
      ]) {
        const response = await http().get('/api/skills').set('Origin', origin);
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
      }
    });

    it('answers allowed preflight requests with the permitted methods and headers', async () => {
      const response = await http()
        .options('/api/auth/login')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type,authorization')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe(
        ALLOWED_ORIGIN,
      );
      expect(response.headers['access-control-allow-methods']).toBe(
        'GET,POST,PUT,PATCH,DELETE',
      );
      expect(response.headers['access-control-allow-headers']).toBe(
        'Authorization,Content-Type',
      );
      expect(response.headers['access-control-max-age']).toBe('600');
    });

    it('withholds CORS headers from preflight requests by other origins', async () => {
      const response = await http()
        .options('/api/feedback')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'POST');
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(response.headers['access-control-allow-methods']).toBeUndefined();
    });

    it('sends security headers and hides the framework', async () => {
      const response = await http().get('/api').expect(200);
      const headers = response.headers;

      expect(headers['x-powered-by']).toBeUndefined();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(headers['strict-transport-security']).toMatch(/max-age=\d+/);
      expect(headers['referrer-policy']).toBe('no-referrer');
      expect(headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(headers['content-security-policy']).toContain(
        "default-src 'self'",
      );
      expect(headers['content-security-policy']).toContain(
        'upgrade-insecure-requests',
      );
    });

    it('disables Swagger by default in production', async () => {
      await http().get('/api/docs').expect(404);
      await http().get('/api/docs-json').expect(404);
    });
  });

  describe('Swagger explicitly enabled in production', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createApp({ ...PRODUCTION_ENV, SWAGGER_ENABLED: 'true' });
    }, 30_000);

    afterAll(async () => {
      await app?.close();
    });

    it('serves the UI and OpenAPI document with security headers', async () => {
      const ui = await request(app.getHttpServer())
        .get('/api/docs')
        .redirects(1)
        .expect(200);
      expect(ui.text).toContain('<title>Gaza Talent Connect API</title>');
      expect(ui.headers['content-security-policy']).toContain(
        "script-src 'self'",
      );

      const json = await request(app.getHttpServer())
        .get('/api/docs-json')
        .expect(200);
      expect(json.body).toHaveProperty('openapi');
      const text = JSON.stringify(json.body);
      expect(text).not.toContain(STRONG_SECRET);
      expect(text).not.toMatch(/postgres(ql)?:\/\//i);
    });
  });

  describe('local development defaults', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createApp({
        NODE_ENV: 'development',
        CORS_ORIGIN: undefined,
        SWAGGER_ENABLED: undefined,
        CLIENT_IP_HEADER: undefined,
      });
    }, 30_000);

    afterAll(async () => {
      await app?.close();
    });

    it('keeps Swagger and the local Vite origins working', async () => {
      await request(app.getHttpServer()).get('/api/docs-json').expect(200);

      const local = await request(app.getHttpServer())
        .get('/api/skills')
        .set('Origin', 'http://localhost:5173')
        .expect(200);
      expect(local.headers['access-control-allow-origin']).toBe(
        'http://localhost:5173',
      );

      const remote = await request(app.getHttpServer())
        .get('/api/skills')
        .set('Origin', 'https://app.example.com');
      expect(remote.headers['access-control-allow-origin']).toBeUndefined();

      expect(local.headers['content-security-policy']).toContain(
        "default-src 'self'",
      );
      expect(local.headers['content-security-policy']).not.toContain(
        'upgrade-insecure-requests',
      );
    });
  });

  describe('rate limiting', () => {
    let app: INestApplication<App>;
    const http = () => request(app.getHttpServer());

    beforeAll(async () => {
      app = await createApp(PRODUCTION_ENV);
    }, 30_000);

    afterAll(async () => {
      await app?.close();
    });

    it('limits login to 10 attempts per 15 minutes per client', async () => {
      for (let attempt = 1; attempt <= 10; attempt += 1) {
        const response = await http()
          .post('/api/auth/login')
          .send(badLogin())
          .expect(401);
        expect(response.headers['x-ratelimit-limit']).toBe('10');
      }

      const blocked = await http()
        .post('/api/auth/login')
        .send(badLogin())
        .expect(429);
      expect(blocked.body).toMatchObject({
        statusCode: 429,
        message: 'Too many requests. Please wait and try again.',
      });
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('limits student and company registration to 5 attempts per hour each', async () => {
      for (const path of ['/api/auth/register', '/api/auth/register/company']) {
        for (let attempt = 1; attempt <= 5; attempt += 1) {
          // Invalid bodies are rejected before any account is created, but
          // still count towards the limit because throttling runs first.
          await http().post(path).send({ email: 'invalid' }).expect(400);
        }
        await http().post(path).send({ email: 'invalid' }).expect(429);
      }
    });

    it('limits company feedback creation to 20 requests per hour, even before authentication', async () => {
      for (let attempt = 1; attempt <= 20; attempt += 1) {
        await http()
          .post('/api/feedback')
          .send({ studentProfileId: randomUUID(), message: 'Hello' })
          .expect(401);
      }
      await http()
        .post('/api/feedback')
        .send({ studentProfileId: randomUUID(), message: 'Hello' })
        .expect(429);
    });

    it('applies the 120 requests per minute default to other routes and exempts the health check', async () => {
      for (let attempt = 1; attempt <= 120; attempt += 1) {
        await http().get('/api/skills').expect(200);
      }
      await http().get('/api/skills').expect(429);

      for (let attempt = 1; attempt <= 130; attempt += 1) {
        await http().get('/api').expect(200);
      }
    });
  });

  describe('client IP spoofing', () => {
    it('ignores X-Forwarded-For and edge headers when no client IP header is configured', async () => {
      const app = await createApp(PRODUCTION_ENV);
      try {
        for (let attempt = 1; attempt <= 10; attempt += 1) {
          await request(app.getHttpServer())
            .post('/api/auth/login')
            .set('X-Forwarded-For', `198.51.100.${attempt}`)
            .set('CF-Connecting-IP', `203.0.113.${attempt}`)
            .send(badLogin())
            .expect(401);
        }
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .set('X-Forwarded-For', '198.51.100.250')
          .set('CF-Connecting-IP', '203.0.113.250')
          .send(badLogin())
          .expect(429);
      } finally {
        await app.close();
      }
    }, 30_000);

    it('keys on the configured edge header and cannot be bypassed by rotating X-Forwarded-For', async () => {
      const app = await createApp(RENDER_PRODUCTION_ENV);
      const login = (clientIp: string, forwardedFor: string) =>
        request(app.getHttpServer())
          .post('/api/auth/login')
          .set('CF-Connecting-IP', clientIp)
          .set('X-Forwarded-For', forwardedFor)
          .send(badLogin());

      try {
        for (let attempt = 1; attempt <= 10; attempt += 1) {
          await login('203.0.113.10', `198.51.100.${attempt}`).expect(401);
        }
        // Same edge-reported client, new forged X-Forwarded-For: still blocked.
        await login('203.0.113.10', '198.51.100.99').expect(429);
        // A different real client keeps its own budget.
        await login('203.0.113.20', '198.51.100.1').expect(401);
      } finally {
        await app.close();
      }
    }, 30_000);

    it('falls back to the TCP peer when the trusted header is missing or malformed', async () => {
      const app = await createApp(RENDER_PRODUCTION_ENV);
      // Rotating invalid values must not create fresh budgets: every one of
      // these requests is keyed on the same TCP peer address.
      const invalidValues = [
        undefined,
        'not-an-ip',
        '203.0.113.30, 198.51.100.30',
        '',
        '999.1.1.1',
        undefined,
        'localhost',
        '203.0.113.31 203.0.113.32',
        'unknown',
        '::ffff:zz',
      ];
      const login = (value: string | undefined) => {
        const req = request(app.getHttpServer())
          .post('/api/auth/login')
          .set(
            'X-Forwarded-For',
            `198.51.100.${Math.floor(Math.random() * 200)}`,
          );
        if (value !== undefined) req.set('CF-Connecting-IP', value);
        return req.send(badLogin());
      };

      try {
        for (const value of invalidValues) {
          await login(value).expect(401);
        }
        await login('still-not-an-ip').expect(429);
        await login(undefined).expect(429);
      } finally {
        await app.close();
      }
    }, 30_000);
  });
});
