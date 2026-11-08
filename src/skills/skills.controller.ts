import { Controller, Get } from '@nestjs/common';
import { SkillsService } from './skills.service';
import {
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import {
  ApiErrorResponseDto,
  GENERAL_RATE_LIMIT_RESPONSE,
  SkillResponseDto,
} from '../swagger-responses';

@Controller('skills')
@ApiTags('Skills')
@ApiTooManyRequestsResponse(GENERAL_RATE_LIMIT_RESPONSE)
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({ summary: 'List predefined skills' })
  @ApiOkResponse({
    type: SkillResponseDto,
    isArray: true,
    description: 'Skills ordered by name, then ID; an empty catalog returns []',
  })
  @ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
  findAll() {
    return this.skillsService.findAll();
  }
}
