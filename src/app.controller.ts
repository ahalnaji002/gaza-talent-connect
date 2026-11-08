import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';

@Controller()
@ApiExcludeController()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Static liveness response used by hosting health checks; it touches no
  // data, so it is exempt from rate limiting.
  @Get()
  @SkipThrottle()
  getHello(): string {
    return this.appService.getHello();
  }
}
