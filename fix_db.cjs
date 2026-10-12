const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function fix() {
  const acts = await prisma.activity.findMany({
    where: { title: { contains: "Correo autom" } }
  });
  for (const a of acts) {
    if (a.title !== "Correo automático enviado") {
      await prisma.activity.update({
        where: { id: a.id },
        data: { title: "Correo automático enviado" }
      });
      console.log("Fixed:", a.id);
    }
  }
}
fix().then(() => prisma.$disconnect());
