import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.skill.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }
}
