import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RATE_LIMITS } from '../config/runtime-config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { LoginDto } from './dto/login.dto';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ApiErrorResponseDto,
  CompanyRegisterResponseDto,
  LOGIN_RATE_LIMIT_RESPONSE,
  LoginResponseDto,
  REGISTRATION_RATE_LIMIT_RESPONSE,
  RegisterResponseDto,
} from '../swagger-responses';

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: RATE_LIMITS.registration })
  @ApiTooManyRequestsResponse(REGISTRATION_RATE_LIMIT_RESPONSE)
  @ApiOperation({ summary: 'Register a student account and private profile' })
  @ApiCreatedResponse({ type: RegisterResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'Email is already registered',
  })
  @ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register/company')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: RATE_LIMITS.registration })
  @ApiTooManyRequestsResponse(REGISTRATION_RATE_LIMIT_RESPONSE)
  @ApiOperation({
    summary: 'Register a company account',
    description:
      'Creates an account with the COMPANY role and a company profile. The role is assigned by the server; companies have no administrative privileges.',
  })
  @ApiCreatedResponse({ type: CompanyRegisterResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'Email is already registered',
  })
  @ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
  registerCompany(@Body() dto: RegisterCompanyDto) {
    return this.authService.registerCompany(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: RATE_LIMITS.login })
  @ApiTooManyRequestsResponse(LOGIN_RATE_LIMIT_RESPONSE)
  @ApiOperation({
    summary: 'Authenticate a student or company and receive a JWT access token',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({
    type: ApiErrorResponseDto,
    description: 'Invalid email or password',
  })
  @ApiInternalServerErrorResponse({ type: ApiErrorResponseDto })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
