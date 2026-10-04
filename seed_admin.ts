import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'whilmis21@gmail.com';
  const password = 'Hormesis199659';
  
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'admin',
      name: 'Admin',
      company: 'Grupo Hormesis'
    },
    create: {
      email,
      passwordHash,
      role: 'admin',
      name: 'Admin',
      company: 'Grupo Hormesis'
    }
  });

  console.log('Usuario Admin creado exitosamente:');
  console.log({ id: user.id, email: user.email, role: user.role });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
