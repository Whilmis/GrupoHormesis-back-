const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function run() {
  const leads = await prisma.lead.findMany();
  for (const lead of leads) {
    if (lead.metadata && lead.metadata.referredByUserId && !lead.metadata.referredByName) {
      const user = await prisma.user.findUnique({ where: { id: lead.metadata.referredByUserId } });
      if (user) {
        const metadata = { ...lead.metadata, referredByName: user.name || user.businessName };
        await prisma.lead.update({
          where: { id: lead.id },
          data: { metadata }
        });
        console.log(`Updated lead ${lead.id} with referredByName: ${user.name || user.businessName}`);
      }
    }
  }
}
run().then(() => prisma.$disconnect());
