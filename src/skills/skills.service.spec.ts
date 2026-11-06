jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import type { PrismaService } from '../prisma/prisma.service';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

describe('SkillsService', () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = {
    skill: { findMany },
  } as unknown as PrismaService;
  const service = new SkillsService(prisma);
  const controller = new SkillsController(service);

  it('returns an empty array when the catalog has no skills', async () => {
    await expect(controller.findAll()).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  });
});
