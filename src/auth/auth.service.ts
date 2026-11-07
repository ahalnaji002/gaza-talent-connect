import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          role: UserRole.STUDENT,
          profile: {
            create: {
              fullName: dto.fullName,
              isPublic: false,
            },
          },
        },
        select: {
          id: true,
          email: true,
          profile: {
            select: {
              id: true,
              fullName: true,
              isPublic: true,
            },
          },
        },
      });

      return user;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered');
      }

      throw error;
    }
  }

  /**
   * Creates a company account. The COMPANY role is set here on the server;
   * clients cannot choose a role, and no administrative privileges exist.
   */
  async registerCompany(dto: RegisterCompanyDto) {
    const email = dto.email.toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      return await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          role: UserRole.COMPANY,
          companyProfile: {
            create: { name: dto.companyName },
          },
        },
        select: {
          id: true,
          email: true,
          role: true,
          companyProfile: {
            select: { id: true, name: true },
          },
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered');
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
      // Informational for clients choosing which pages to show; every
      // protected route re-checks the role on the server.
      role: user.role,
    };
  }
}
