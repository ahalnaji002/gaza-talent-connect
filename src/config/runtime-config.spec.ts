import {
  CLIENT_IP_HEADER_SETTING,
  ConfigurationError,
  DEFAULT_DEVELOPMENT_CORS_ORIGINS,
  MIN_PRODUCTION_JWT_SECRET_LENGTH,
  RATE_LIMITS,
  isAllowedOrigin,
  isSwaggerEnabled,
  normalizeOrigin,
  parseClientIpHeader,
  parseCorsOrigins,
  resolveClientIp,
  resolveEnvironment,
  validateJwtSecret,
} from './runtime-config';

describe('resolveEnvironment', () => {
  it('maps NODE_ENV to production, test or development', () => {
    expect(resolveEnvironment('production')).toBe('production');
    expect(resolveEnvironment(' PRODUCTION ')).toBe('production');
    expect(resolveEnvironment('test')).toBe('test');
    expect(resolveEnvironment(undefined)).toBe('development');
    expect(resolveEnvironment('staging')).toBe('development');
  });
});

describe('CORS origins', () => {
  it('normalizes whitespace, trailing slashes and host case', () => {
    expect(normalizeOrigin('  https://App.Example.com/  ')).toBe(
      'https://app.example.com',
    );
    expect(normalizeOrigin('http://localhost:5173///')).toBe(
      'http://localhost:5173',
    );
  });

  it('parses and de-duplicates comma-separated production origins', () => {
    expect(
      parseCorsOrigins(
        'https://app.example.com, https://APP.example.com/ ,https://www.example.com',
        'production',
      ),
    ).toEqual(['https://app.example.com', 'https://www.example.com']);
  });

  it('requires CORS_ORIGIN in production instead of allowing every origin', () => {
    for (const raw of [undefined, '', '  ', ' , ']) {
      expect(() => parseCorsOrigins(raw, 'production')).toThrow(
        /CORS_ORIGIN is required in production/,
      );
    }
  });

  it('rejects wildcards, malformed values, paths and non-http schemes', () => {
    const invalid = [
      '*',
      'https://*.example.com',
      'not a url',
      'null',
      'ftp://example.com',
      'https://example.com/app',
      'https://example.com?x=1',
      'https://user:pass@example.com',
    ];
    for (const raw of invalid) {
      expect(() => parseCorsOrigins(raw, 'development')).toThrow(
        ConfigurationError,
      );
    }
  });

  it('requires https origins in production', () => {
    expect(() =>
      parseCorsOrigins('http://app.example.com', 'production'),
    ).toThrow(/must use https in production/);
  });

  it('falls back to local Vite origins only outside production', () => {
    expect(parseCorsOrigins(undefined, 'development')).toEqual([
      ...DEFAULT_DEVELOPMENT_CORS_ORIGINS,
    ]);
    expect(parseCorsOrigins(undefined, 'test')).toEqual([
      ...DEFAULT_DEVELOPMENT_CORS_ORIGINS,
    ]);
    expect(
      DEFAULT_DEVELOPMENT_CORS_ORIGINS.every((origin) =>
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin),
      ),
    ).toBe(true);
  });

  it('matches request origins exactly', () => {
    const allowed = ['https://app.example.com'];
    expect(isAllowedOrigin('https://app.example.com', allowed)).toBe(true);
    expect(isAllowedOrigin('https://app.example.com.evil.test', allowed)).toBe(
      false,
    );
    expect(isAllowedOrigin('http://app.example.com', allowed)).toBe(false);
    expect(isAllowedOrigin('null', allowed)).toBe(false);
    expect(isAllowedOrigin(undefined, allowed)).toBe(false);
  });
});

describe('isSwaggerEnabled', () => {
  it('defaults to enabled locally and disabled in production', () => {
    expect(isSwaggerEnabled(undefined, 'development')).toBe(true);
    expect(isSwaggerEnabled(undefined, 'production')).toBe(false);
  });

  it('honours explicit values and rejects anything else', () => {
    expect(isSwaggerEnabled('true', 'production')).toBe(true);
    expect(isSwaggerEnabled('FALSE', 'development')).toBe(false);
    expect(isSwaggerEnabled('1', 'production')).toBe(true);
    expect(() => isSwaggerEnabled('yes', 'production')).toThrow(
      /SWAGGER_ENABLED must be "true" or "false"/,
    );
  });
});

describe('validateJwtSecret', () => {
  const strong = 'k'.repeat(MIN_PRODUCTION_JWT_SECRET_LENGTH);

  it('requires a secret in every environment', () => {
    expect(() => validateJwtSecret(undefined, 'development')).toThrow(
      /JWT_SECRET is not configured/,
    );
    expect(() => validateJwtSecret('   ', 'production')).toThrow(
      /JWT_SECRET is not configured/,
    );
  });

  it('keeps local development permissive', () => {
    expect(validateJwtSecret('short-dev-secret', 'development')).toBe(
      'short-dev-secret',
    );
  });

  it('requires 32+ characters and no placeholder in production, without leaking it', () => {
    const short = 'TopSecretValue-123';
    let message = '';
    try {
      validateJwtSecret(short, 'production');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/at least 32 characters/);
    expect(message).not.toContain(short);

    expect(() =>
      validateJwtSecret(
        'REPLACE_WITH_A_PRIVATE_RANDOM_SECRET_0123456',
        'production',
      ),
    ).toThrow(/placeholder/);
    expect(validateJwtSecret(strong, 'production')).toBe(strong);
  });
});

describe('client IP for rate limiting', () => {
  const request = (
    headers: Record<string, string>,
    remoteAddress: string,
    configuredHeader?: string,
  ) => ({
    headers,
    socket: { remoteAddress },
    app: {
      get: (setting: string) =>
        setting === CLIENT_IP_HEADER_SETTING ? configuredHeader : undefined,
    },
  });

  it('keeps the TCP peer when CLIENT_IP_HEADER is unset, in every environment', () => {
    for (const environment of ['production', 'development', 'test'] as const) {
      expect(parseClientIpHeader(undefined, environment, 'true')).toBeNull();
      expect(parseClientIpHeader('  ', environment, undefined)).toBeNull();
    }
  });

  it('accepts cf-connecting-ip only in production on Render', () => {
    expect(
      parseClientIpHeader(' CF-Connecting-IP ', 'production', 'true'),
    ).toBe('cf-connecting-ip');
    expect(
      parseClientIpHeader('cf-connecting-ip', 'production', ' TRUE '),
    ).toBe('cf-connecting-ip');
  });

  it('rejects the trusted header outside production', () => {
    for (const environment of ['development', 'test'] as const) {
      expect(() =>
        parseClientIpHeader('cf-connecting-ip', environment, 'true'),
      ).toThrow(/only allowed when NODE_ENV=production and RENDER=true/);
    }
  });

  it('rejects the trusted header in production without RENDER=true', () => {
    for (const renderFlag of [undefined, '', 'false', '1', 'yes']) {
      expect(() =>
        parseClientIpHeader('cf-connecting-ip', 'production', renderFlag),
      ).toThrow(/only allowed when NODE_ENV=production and RENDER=true/);
    }
  });

  it('rejects True-Client-IP, X-Forwarded-For and unknown headers in every environment', () => {
    for (const environment of ['production', 'development', 'test'] as const) {
      expect(() =>
        parseClientIpHeader('True-Client-IP', environment, 'true'),
      ).toThrow(/cannot be True-Client-IP/);
      expect(() =>
        parseClientIpHeader('x-forwarded-for', environment, 'true'),
      ).toThrow(/cannot be X-Forwarded-For/);
      expect(() =>
        parseClientIpHeader('x-real-ip', environment, 'true'),
      ).toThrow(ConfigurationError);
    }
  });

  it('ignores X-Forwarded-For and uses the TCP peer when no header is configured', () => {
    expect(
      resolveClientIp(
        request(
          {
            'x-forwarded-for': '198.51.100.7',
            'cf-connecting-ip': '198.51.100.8',
          },
          '10.0.0.5',
        ),
      ),
    ).toBe('10.0.0.5');
  });

  it('uses a configured edge header only when it holds one valid IP', () => {
    expect(
      resolveClientIp(
        request(
          { 'cf-connecting-ip': '203.0.113.9' },
          '10.0.0.5',
          'cf-connecting-ip',
        ),
      ),
    ).toBe('203.0.113.9');
    for (const spoof of ['not-an-ip', '203.0.113.9, 198.51.100.1', '']) {
      expect(
        resolveClientIp(
          request(
            { 'cf-connecting-ip': spoof },
            '10.0.0.5',
            'cf-connecting-ip',
          ),
        ),
      ).toBe('10.0.0.5');
    }
  });

  it('groups IPv6 clients by /64 so they cannot rotate addresses inside it', () => {
    const a = resolveClientIp(request({}, '2001:db8:1:2:aaaa::1'));
    const b = resolveClientIp(request({}, '2001:db8:1:2:bbbb::9'));
    const other = resolveClientIp(request({}, '2001:db8:1:3::1'));
    expect(a).toBe(b);
    expect(a).not.toBe(other);
  });
});

describe('RATE_LIMITS', () => {
  it('keeps the documented conservative values', () => {
    expect(RATE_LIMITS).toEqual({
      default: { ttl: 60_000, limit: 120 },
      login: { ttl: 900_000, limit: 10 },
      registration: { ttl: 3_600_000, limit: 5 },
      feedback: { ttl: 3_600_000, limit: 20 },
    });
  });
});
