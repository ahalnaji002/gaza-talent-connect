import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { StudentProfilesModule } from './student-profiles/student-profiles.module';
import { SkillsModule } from './skills/skills.module';
import { ProjectsModule } from './projects/projects.module';
import { CompaniesModule } from './companies/companies.module';
import {
  RATE_LIMITS,
  resolveClientIp,
  resolveEnvironment,
} from './config/runtime-config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // In-memory rate limiting: counters are per instance and reset on restart.
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        // Decided once per application instance. Only the automated test
        // environment skips limits (functional suites send many requests from
        // one address); development and production always enforce them.
        const skip = resolveEnvironment(process.env.NODE_ENV) === 'test';
        return {
          throttlers: [{ name: 'default', ...RATE_LIMITS.default }],
          getTracker: (req) => resolveClientIp(req),
          skipIf: () => skip,
          errorMessage: 'Too many requests. Please wait and try again.',
        };
      },
    }),
    PrismaModule,
    AuthModule,
    StudentProfilesModule,
    SkillsModule,
    ProjectsModule,
    CompaniesModule,
  ],
  controllers: [AppController],
  // A global guard so every API route has the default limit; sensitive
  // routes tighten it with @Throttle.
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
