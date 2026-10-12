const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const calendars = await prisma.calendar.findMany();
  console.log('Calendars count:', calendars.length);
  console.log('Calendars:', calendars);
}
main().catch(console.error).finally(() => prisma.$disconnect());
