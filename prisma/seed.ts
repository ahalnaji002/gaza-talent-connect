import { PrismaService } from '../src/prisma/prisma.service';
import type { PrismaClient } from '../generated/prisma/client';

// The predefined catalog (50 skills). The seed only inserts missing names, so
// existing skills keep their IDs and student selections. Never rename or remove
// an entry here: a renamed entry would be inserted as a new skill.
export const INITIAL_SKILL_NAMES = [
  // Original catalog
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
  // Catalog expansion
  'Angular',
  'Vue.js',
  'Tailwind CSS',
  'Bootstrap',
  'Sass',
  'Redux',
  'Express.js',
  'Django',
  'Flask',
  'FastAPI',
  'Laravel',
  'PHP',
  'C#',
  '.NET',
  'Spring Boot',
  'Kotlin',
  'Swift',
  'Dart',
  'Flutter',
  'React Native',
  'MongoDB',
  'Redis',
  'SQLite',
  'Prisma',
  'GraphQL',
  'REST APIs',
  'AWS',
  'Azure',
  'Linux',
  'Kubernetes',
  'CI/CD',
  'Figma',
  'UI/UX Design',
  'Software Testing',
  'Cybersecurity',
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
