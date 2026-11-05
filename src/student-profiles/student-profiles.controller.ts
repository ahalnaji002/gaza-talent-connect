import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StudentProfilesService } from './student-profiles.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('students')
export class StudentProfilesController {
  constructor(private readonly studentProfilesService: StudentProfilesService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyProfile(@Req() request: AuthenticatedRequest) {
    return this.studentProfilesService.getByUserId(request.user.userId);
  }
}
