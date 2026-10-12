const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const latest = await prisma.meeting.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3
  });
  console.log(JSON.stringify(latest, null, 2));
}
test();
