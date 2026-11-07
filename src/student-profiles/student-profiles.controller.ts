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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ApiErrorResponseDto,
  PublicStudentDetailResponseDto,
  SkillResponseDto,
  StudentDiscoveryResponseDto,
  StudentProfileResponseDto,
} from '../swagger-responses';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('students')
@ApiTags('Students')
export class StudentProfilesController {
  constructor(
    private readonly studentProfilesService: StudentProfilesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Discover public student profiles' })
  @ApiQuery({
    name: 'skillIds',
    required: false,
    type: String,
    example:
      '9d5df266-8597-4d68-8eb5-8c52927079c1,7f408d47-6bcd-44d7-a9f1-338291e962bb',
    description:
      'Comma-separated skill UUIDs; profiles matching any requested skill are included and ranked by matching-skill count.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    minimum: 1,
    default: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 50,
    default: 10,
  })
  @ApiOkResponse({ type: StudentDiscoveryResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
  discover(@Query() query: DiscoverStudentsQueryDto) {
    return this.studentProfilesService.discover(query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary:
      'Read the authenticated student’s own profile, including while hidden',
  })
  @ApiOkResponse({ type: StudentProfileResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Student profile not found',
  })
  @ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
  getMyProfile(@Req() request: AuthenticatedRequest) {
    return this.studentProfilesService.getByUserId(request.user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update the authenticated student’s own profile' })
  @ApiOkResponse({ type: StudentProfileResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Student profile not found',
  })
  @ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
  updateMyProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStudentProfileDto,
  ) {
    return this.studentProfilesService.updateByUserId(request.user.userId, dto);
  }

  @Put('me/skills')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Replace all skills assigned to the authenticated student',
  })
  @ApiOkResponse({
    type: SkillResponseDto,
    isArray: true,
    description: 'Resulting skills as {id, name} objects',
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Student profile not found',
  })
  @ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
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
  @ApiOperation({ summary: 'Read a published student profile by profile ID' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Student profile UUID (not the account user ID)',
  })
  @ApiOkResponse({ type: PublicStudentDetailResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Profile is hidden, unpublished, or does not exist',
  })
  @ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
  getPublicProfile(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.studentProfilesService.getPublicProfileById(id);
  }
}
