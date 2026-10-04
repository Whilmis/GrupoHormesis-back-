import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const exec = await prisma.workflowExecution.findFirst({
    orderBy: { startedAt: 'desc' },
  });
  console.log(JSON.stringify(exec, null, 2));
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
