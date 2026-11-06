import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const projectSelect = {
  id: true,
  title: true,
  description: true,
  githubUrl: true,
  demoUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async createByUserId(userId: string, dto: CreateProjectDto) {
    return this.prisma.$transaction(async (transaction) => {
      const profiles = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM student_profiles
        WHERE user_id = ${userId}::uuid
        FOR UPDATE
      `;
      const profile = profiles[0];

      if (!profile) {
        throw new NotFoundException('Student profile not found');
      }

      return transaction.project.create({
        data: {
          studentProfileId: profile.id,
          title: dto.title,
          description: dto.description ?? null,
          githubUrl: dto.githubUrl ?? null,
          demoUrl: dto.demoUrl ?? null,
        },
        select: projectSelect,
      });
    });
  }

  findByUserId(userId: string) {
    return this.prisma.project.findMany({
      where: { studentProfile: { userId } },
      orderBy: { createdAt: 'desc' },
      select: projectSelect,
    });
  }

  async updateByUserId(
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const profiles = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM student_profiles
        WHERE user_id = ${userId}::uuid
        FOR UPDATE
      `;
      const profile = profiles[0];

      if (!profile) {
        throw new NotFoundException('Project not found');
      }

      const data: {
        title?: string;
        description?: string | null;
        githubUrl?: string | null;
        demoUrl?: string | null;
      } = {};
      if (dto.title !== undefined) data.title = dto.title;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.githubUrl !== undefined) data.githubUrl = dto.githubUrl;
      if (dto.demoUrl !== undefined) data.demoUrl = dto.demoUrl;

      if (Object.keys(data).length > 0) {
        const result = await transaction.project.updateMany({
          where: { id: projectId, studentProfileId: profile.id },
          data,
        });

        if (result.count === 0) {
          throw new NotFoundException('Project not found');
        }
      }

      const project = await transaction.project.findFirst({
        where: { id: projectId, studentProfileId: profile.id },
        select: projectSelect,
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      return project;
    });
  }

  async deleteByUserId(userId: string, projectId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const profiles = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM student_profiles
        WHERE user_id = ${userId}::uuid
        FOR UPDATE
      `;
      const profile = profiles[0];

      if (!profile) {
        throw new NotFoundException('Project not found');
      }

      const result = await transaction.project.deleteMany({
        where: { id: projectId, studentProfileId: profile.id },
      });

      if (result.count === 0) {
        throw new NotFoundException('Project not found');
      }
    });
  }
}
