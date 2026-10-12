const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function run() {
  const latestLeads = await prisma.lead.findMany({ take: 3, orderBy: { createdAt: 'desc' } });
  console.log("Latest Leads:", JSON.stringify(latestLeads.map(l => ({ id: l.id, name: l.businessName, metadata: l.metadata })), null, 2));
}
run().then(() => prisma.$disconnect());
