const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const w = await prisma.userWorkflow.findFirst({where:{name: 'Grupo Hormesis'}, include: {template: true}});
  console.log("Config del workflow:", w?.config);
}
main().catch(console.error).finally(() => prisma.$disconnect());
