import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { Express } from 'express';
import helmet from 'helmet';
import {
  AppEnvironment,
  CLIENT_IP_HEADER_SETTING,
  ClientIpHeader,
  isAllowedOrigin,
  isSwaggerEnabled,
  parseClientIpHeader,
  parseCorsOrigins,
  resolveEnvironment,
} from './config/runtime-config';
import { setupSwagger } from './swagger';

export interface AppRuntimeSummary {
  environment: AppEnvironment;
  corsOrigins: string[];
  swaggerEnabled: boolean;
  clientIpHeader: ClientIpHeader | null;
}

/**
 * Applies the HTTP-level configuration shared by production and the security
 * tests: global prefix, security headers, CORS allowlist, validation, proxy
 * handling and the optional Swagger UI. Throws ConfigurationError before the
 * server starts when the environment is invalid.
 */
export function configureApp(
  app: INestApplication,
  env: NodeJS.ProcessEnv = process.env,
): AppRuntimeSummary {
  const environment = resolveEnvironment(env.NODE_ENV);
  // Parse everything first so a bad value fails startup before any route is served.
  const corsOrigins = parseCorsOrigins(env.CORS_ORIGIN, environment);
  const swaggerEnabled = isSwaggerEnabled(env.SWAGGER_ENABLED, environment);
  const clientIpHeader = parseClientIpHeader(
    env.CLIENT_IP_HEADER,
    environment,
    env.RENDER,
  );

  const express = app.getHttpAdapter().getInstance() as Express;
  // Never derive the client IP from X-Forwarded-For (clients can forge it).
  express.set('trust proxy', false);
  express.set(CLIENT_IP_HEADER_SETTING, clientIpHeader ?? undefined);

  app.setGlobalPrefix('api');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Local Swagger runs over plain http; upgrading its assets would break it.
          upgradeInsecureRequests: environment === 'production' ? [] : null,
        },
      },
    }),
  );

  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => callback(null, isAllowedOrigin(requestOrigin, corsOrigins)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
    maxAge: 600,
    optionsSuccessStatus: 204,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (swaggerEnabled) {
    setupSwagger(app);
  }

  return { environment, corsOrigins, swaggerEnabled, clientIpHeader };
}
