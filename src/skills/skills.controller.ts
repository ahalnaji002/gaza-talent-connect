import { Controller, Get } from '@nestjs/common';
import { SkillsService } from './skills.service';
import {
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SkillResponseDto } from '../swagger-responses';
import { ApiErrorResponseDto } from '../swagger-responses';

@Controller('skills')
@ApiTags('Skills')
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
