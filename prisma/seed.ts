import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

async function main() {
  // Criar usuário admin padrão
  const hashedPassword = await bcrypt.hash("admin123", 10)
  
  const admin = await prisma.users.upsert({
    where: { email: "admin@consigexpress.com" },
    update: {},
    create: {
      email: "admin@consigexpress.com",
      name: "Administrador",
      password: hashedPassword,
      role: "ADMIN",
      active: true,
    },
  })

  console.log("✅ Admin criado:", admin.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
