import {
  Body,
  Controller,
  Get,
  Patch,
  Put,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DiscoverStudentsQueryDto } from './dto/discover-students-query.dto';
import { ReplaceStudentSkillsDto } from './dto/replace-student-skills.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { StudentProfilesService } from './student-profiles.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('students')
export class StudentProfilesController {
  constructor(
    private readonly studentProfilesService: StudentProfilesService,
  ) {}

  @Get()
  discover(@Query() query: DiscoverStudentsQueryDto) {
    return this.studentProfilesService.discover(query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyProfile(@Req() request: AuthenticatedRequest) {
    return this.studentProfilesService.getByUserId(request.user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMyProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStudentProfileDto,
  ) {
    return this.studentProfilesService.updateByUserId(request.user.userId, dto);
  }

  @Put('me/skills')
  @UseGuards(JwtAuthGuard)
  replaceMySkills(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReplaceStudentSkillsDto,
  ) {
    return this.studentProfilesService.replaceSkillsByUserId(
      request.user.userId,
      dto,
    );
  }

  @Get(':id')
  getPublicProfile(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.studentProfilesService.getPublicProfileById(id);
  }
}
