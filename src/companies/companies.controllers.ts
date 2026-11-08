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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
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
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '../../generated/prisma/client';
import { RATE_LIMITS } from '../config/runtime-config';
import type { AuthenticatedRequest } from '../auth/authenticated-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  ApiErrorResponseDto,
  CompanySummaryDto,
  ReceivedFeedbackPageResponseDto,
  SentFeedbackPageResponseDto,
  SentFeedbackResponseDto,
} from '../swagger-responses';
import { CompanyFeedbackService } from './company-feedback.service';
import {
  CreateFeedbackDto,
  FeedbackPageQueryDto,
  UpdateFeedbackDto,
} from './dto/feedback.dto';

const companyOnly = {
  type: ApiErrorResponseDto,
  description: 'Only company accounts can use this route',
};

@Controller('companies')
@ApiTags('Companies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY)
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiForbiddenResponse(companyOnly)
@ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
export class CompaniesController {
  constructor(private readonly feedbackService: CompanyFeedbackService) {}

  @Get('me')
  @ApiOperation({ summary: 'Read the authenticated company’s identity' })
  @ApiOkResponse({ type: CompanySummaryDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Company profile not found',
  })
  getMyCompany(@Req() request: AuthenticatedRequest) {
    return this.feedbackService.getCompanyForUser(request.user.userId);
  }
}

@Controller('feedback')
@ApiTags('Company feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY)
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiForbiddenResponse(companyOnly)
@ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
export class CompanyFeedbackController {
  constructor(private readonly feedbackService: CompanyFeedbackService) {}

  @Post()
  @Throttle({ default: RATE_LIMITS.feedback })
  @ApiTooManyRequestsResponse({ type: ApiErrorResponseDto })
  @ApiOperation({
    summary: 'Write private feedback for a published student profile',
    description:
      'Visible only to the authoring company and the student. Never shown on public routes.',
  })
  @ApiCreatedResponse({ type: SentFeedbackResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Student profile is hidden, unpublished, or does not exist',
  })
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.create(request.user.userId, dto);
  }

  @Get('sent')
  @ApiOperation({
    summary: 'List feedback written by the authenticated company, newest first',
  })
  @ApiOkResponse({ type: SentFeedbackPageResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  listSent(
    @Req() request: AuthenticatedRequest,
    @Query() query: FeedbackPageQueryDto,
  ) {
    return this.feedbackService.listSent(request.user.userId, query);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit feedback written by the authenticated company',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SentFeedbackResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Feedback not found or not written by this company',
  })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFeedbackDto,
  ) {
    return this.feedbackService.update(request.user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete feedback written by the authenticated company',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Feedback deleted; no response body' })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Feedback not found or not written by this company',
  })
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.feedbackService.remove(request.user.userId, id);
  }
}

@Controller('students/me/feedback')
@ApiTags('Students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description: 'Only student accounts can use this route',
})
@ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
export class StudentFeedbackController {
  constructor(private readonly feedbackService: CompanyFeedbackService) {}

  @Get()
  @ApiOperation({
    summary:
      'List private company feedback addressed to the authenticated student, newest first',
  })
  @ApiOkResponse({ type: ReceivedFeedbackPageResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({
    type: ApiErrorResponseDto,
    description: 'Student profile not found',
  })
  listReceived(
    @Req() request: AuthenticatedRequest,
    @Query() query: FeedbackPageQueryDto,
  ) {
    return this.feedbackService.listReceived(request.user.userId, query);
  }
}
