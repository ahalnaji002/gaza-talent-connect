import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isEmail } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoverStudentsQueryDto } from './dto/discover-students-query.dto';
import { ReplaceStudentSkillsDto } from './dto/replace-student-skills.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';

const profileSelect = {
  id: true,
  fullName: true,
  jobTitle: true,
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
  jobTitle: string | null;
  bio: string | null;
  location: string | null;
  contactEmail: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  isPublic: boolean;
  skills: Array<{ skill: { id: string; name: string } }>;
};

const publicProfileSelect = {
  id: true,
  fullName: true,
  jobTitle: true,
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

const publicProfileDetailSelect = {
  ...publicProfileSelect,
  projects: {
    select: {
      id: true,
      title: true,
      description: true,
      githubUrl: true,
      demoUrl: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  },
} as const;

type PublicProfile = {
  id: string;
  fullName: string;
  jobTitle: string | null;
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

  async discover(query: DiscoverStudentsQueryDto) {
    const skillIds = [...new Set(query.skillIds ?? [])];
    const profiles = await this.prisma.studentProfile.findMany({
      where: {
        isPublic: true,
        contactEmail: { not: null },
        ...(skillIds.length > 0
          ? { skills: { some: { skillId: { in: skillIds } } } }
          : {}),
      },
      select: publicProfileSelect,
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });

    const validProfiles = profiles.filter(
      (profile) =>
        profile.contactEmail !== null && isEmail(profile.contactEmail),
    );
    const skillIdSet = new Set(skillIds);
    const rankedProfiles =
      skillIds.length === 0
        ? validProfiles
        : validProfiles.sort((left, right) => {
            const leftMatches = left.skills.filter(({ skill }) =>
              skillIdSet.has(skill.id),
            ).length;
            const rightMatches = right.skills.filter(({ skill }) =>
              skillIdSet.has(skill.id),
            ).length;
            return rightMatches - leftMatches;
          });

    const total = rankedProfiles.length;
    const offset = (query.page - 1) * query.limit;
    const data = rankedProfiles
      .slice(offset, offset + query.limit)
      .map((profile) => this.toPublicProfile(profile));

    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getPublicProfileById(profileId: string) {
    const profile = await this.prisma.studentProfile.findFirst({
      where: {
        id: profileId,
        isPublic: true,
        contactEmail: { not: null },
      },
      select: publicProfileDetailSelect,
    });

    if (
      !profile ||
      profile.contactEmail === null ||
      !isEmail(profile.contactEmail)
    ) {
      throw new NotFoundException('Student profile not found');
    }

    return {
      ...this.toPublicProfile(profile),
      projects: profile.projects,
    };
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
        jobTitle?: string | null;
        bio?: string | null;
        location?: string | null;
        contactEmail?: string | null;
        githubUrl?: string | null;
        portfolioUrl?: string | null;
        isPublic?: boolean;
      } = {};

      if (dto.fullName !== undefined) data.fullName = dto.fullName;
      if (dto.jobTitle !== undefined) data.jobTitle = dto.jobTitle;
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
      jobTitle: profile.jobTitle,
      bio: profile.bio,
      location: profile.location,
      contactEmail: profile.contactEmail,
      githubUrl: profile.githubUrl,
      portfolioUrl: profile.portfolioUrl,
      isPublic: profile.isPublic,
      skills: profile.skills.map(({ skill }) => skill),
    };
  }

  private toPublicProfile(profile: PublicProfile) {
    return {
      id: profile.id,
      fullName: profile.fullName,
      jobTitle: profile.jobTitle,
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
