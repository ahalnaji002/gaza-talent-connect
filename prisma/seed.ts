import { PrismaService } from '../src/prisma/prisma.service';
import type { PrismaClient } from '../generated/prisma/client';

export const INITIAL_SKILL_NAMES = [
  'JavaScript',
  'TypeScript',
  'Python',
  'Java',
  'C++',
  'React',
  'Next.js',
  'Node.js',
  'NestJS',
  'PostgreSQL',
  'MySQL',
  'HTML',
  'CSS',
  'Git',
  'Docker',
] as const;

type SkillSeedClient = Pick<PrismaClient, 'skill'>;

export async function seedSkills(prisma: SkillSeedClient): Promise<void> {
  for (const name of INITIAL_SKILL_NAMES) {
    await prisma.skill.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

async function main(): Promise<void> {
  const expectedDatabase = process.env.SKILLS_SEED_CONFIRM_DATABASE?.trim();

  if (!expectedDatabase) {
    throw new Error(
      'Set SKILLS_SEED_CONFIRM_DATABASE to the verified target database name before seeding.',
    );
  }

  const prisma = new PrismaService();

  try {
    await prisma.$connect();
    const result = await prisma.$queryRaw<
      Array<{ database_name: string }>
    >`SELECT current_database() AS database_name`;
    const actualDatabase = result[0]?.database_name;

    if (!actualDatabase || actualDatabase !== expectedDatabase) {
      throw new Error(
        'Skills seed safety check failed: database name did not match confirmation.',
      );
    }

    await seedSkills(prisma);
    process.stdout.write(
      `Seeded ${INITIAL_SKILL_NAMES.length} skills in the verified database.\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Skills seed failed'}\n`,
    );
    process.exitCode = 1;
  });
}
