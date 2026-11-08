import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const summary = configureApp(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  // Configuration summary only: never log secrets or connection strings.
  new Logger('Bootstrap').log(
    `Listening on port ${port} | environment=${summary.environment} | ` +
      `CORS origins=${summary.corsOrigins.join(', ')} | ` +
      `Swagger=${summary.swaggerEnabled ? 'enabled' : 'disabled'} | ` +
      `client IP source=${summary.clientIpHeader ?? 'TCP peer address'}`,
  );
}

void bootstrap();
