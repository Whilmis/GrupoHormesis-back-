const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function run() {
  const latestLeads = await prisma.lead.findMany({ take: 3, orderBy: { createdAt: 'desc' } });
  console.log("Latest Leads:", JSON.stringify(latestLeads, null, 2));

  const latestActivities = await prisma.activity.findMany({ take: 3, orderBy: { createdAt: 'desc' }, where: { type: 'AUTO_EMAIL' } });
  console.log("Latest Activities:", JSON.stringify(latestActivities, null, 2));
}
run().then(() => prisma.$disconnect());
