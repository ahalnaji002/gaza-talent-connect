import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isEmail } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { ReplaceStudentSkillsDto } from './dto/replace-student-skills.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';

const profileSelect = {
  id: true,
  fullName: true,
  bio: true,
  location: true,
  contactEmail: true,
  githubUrl: true,
  portfolioUrl: true,
  isPublic: true,
  skills: {
    select: {
      skill: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

type SelectedProfile = {
  id: string;
  fullName: string;
  bio: string | null;
  location: string | null;
  contactEmail: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  isPublic: boolean;
  skills: Array<{ skill: { id: string; name: string } }>;
};

@Injectable()
export class StudentProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getByUserId(userId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: profileSelect,
    });

    if (!profile) {
      throw new NotFoundException('Student profile not found');
    }

    return this.toResponse(profile);
  }

  async updateByUserId(userId: string, dto: UpdateStudentProfileDto) {
    return this.prisma.$transaction(async (transaction) => {
      const lockedProfiles = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM student_profiles
        WHERE user_id = ${userId}::uuid
        FOR UPDATE
      `;

      if (lockedProfiles.length === 0) {
        throw new NotFoundException('Student profile not found');
      }

      const current = await transaction.studentProfile.findUnique({
        where: { userId },
        select: profileSelect,
      });

      if (!current) {
        throw new NotFoundException('Student profile not found');
      }

      const resultingIsPublic =
        dto.isPublic === undefined ? current.isPublic : dto.isPublic;
      const resultingContactEmail =
        dto.contactEmail === undefined
          ? current.contactEmail
          : dto.contactEmail;

      if (
        resultingIsPublic &&
        (!resultingContactEmail || !isEmail(resultingContactEmail))
      ) {
        throw new BadRequestException(
          'A valid contactEmail is required to publish the profile',
        );
      }

      const data: {
        fullName?: string;
        bio?: string | null;
        location?: string | null;
        contactEmail?: string | null;
        githubUrl?: string | null;
        portfolioUrl?: string | null;
        isPublic?: boolean;
      } = {};

      if (dto.fullName !== undefined) data.fullName = dto.fullName;
      if (dto.bio !== undefined) data.bio = dto.bio;
      if (dto.location !== undefined) data.location = dto.location;
      if (dto.contactEmail !== undefined) data.contactEmail = dto.contactEmail;
      if (dto.githubUrl !== undefined) data.githubUrl = dto.githubUrl;
      if (dto.portfolioUrl !== undefined) data.portfolioUrl = dto.portfolioUrl;
      if (dto.isPublic !== undefined) data.isPublic = dto.isPublic;

      if (Object.keys(data).length === 0) {
        return this.toResponse(current);
      }

      const updated = await transaction.studentProfile.update({
        where: { userId },
        data,
        select: profileSelect,
      });

      return this.toResponse(updated);
    });
  }

  async replaceSkillsByUserId(userId: string, dto: ReplaceStudentSkillsDto) {
    return this.prisma.$transaction(async (transaction) => {
      const lockedProfiles = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM student_profiles
        WHERE user_id = ${userId}::uuid
        FOR UPDATE
      `;

      const profile = lockedProfiles[0];
      if (!profile) {
        throw new NotFoundException('Student profile not found');
      }

      if (dto.skillIds.length > 0) {
        const existingSkills = await transaction.skill.findMany({
          where: { id: { in: dto.skillIds } },
          select: { id: true },
        });

        if (existingSkills.length !== dto.skillIds.length) {
          throw new BadRequestException('One or more skillIds do not exist');
        }
      }

      await transaction.studentSkill.deleteMany({
        where: { studentProfileId: profile.id },
      });

      if (dto.skillIds.length > 0) {
        await transaction.studentSkill.createMany({
          data: dto.skillIds.map((skillId) => ({
            studentProfileId: profile.id,
            skillId,
          })),
        });
      }

      const assignedSkills = await transaction.studentSkill.findMany({
        where: { studentProfileId: profile.id },
        select: {
          skill: {
            select: { id: true, name: true },
          },
        },
        orderBy: { skillId: 'asc' },
      });

      return assignedSkills.map(({ skill }) => skill);
    });
  }

  private toResponse(profile: SelectedProfile) {
    return {
      id: profile.id,
      fullName: profile.fullName,
      bio: profile.bio,
      location: profile.location,
      contactEmail: profile.contactEmail,
      githubUrl: profile.githubUrl,
      portfolioUrl: profile.portfolioUrl,
      isPublic: profile.isPublic,
      skills: profile.skills.map(({ skill }) => skill),
    };
  }
}
