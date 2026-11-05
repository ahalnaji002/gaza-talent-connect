import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudentProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getByUserId(userId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: {
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
      },
    });

    if (!profile) {
      throw new NotFoundException('Student profile not found');
    }

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
