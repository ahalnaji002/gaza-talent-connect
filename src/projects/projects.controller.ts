import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../../generated/prisma/client';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto, ProjectResponseDto } from '../swagger-responses';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description: 'Only student accounts can use this route',
})
@ApiTags('Projects')
@ApiBearerAuth('bearer')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a project for the authenticated student' })
  @ApiCreatedResponse({ type: ProjectResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Student profile not found',
  })
  @ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateProjectDto) {
    return this.projectsService.createByUserId(request.user.userId, dto);
  }

  @Get('me')
  @ApiOperation({
    summary: 'List the authenticated student’s projects, newest first',
  })
  @ApiOkResponse({ type: ProjectResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
  findMine(@Req() request: AuthenticatedRequest) {
    return this.projectsService.findByUserId(request.user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an owned project' })
  @ApiOkResponse({ type: ProjectResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Project not found or not owned by the authenticated student',
  })
  @ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.updateByUserId(request.user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an owned project' })
  @ApiNoContentResponse({ description: 'Project deleted; no response body' })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Project not found or not owned by the authenticated student',
  })
  @ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.projectsService.deleteByUserId(request.user.userId, id);
  }
}
