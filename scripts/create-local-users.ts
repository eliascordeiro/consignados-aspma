import { PrismaClient } from "@prisma/client"
import bcrypt from "bcrypt"
import { randomUUID } from "crypto"

const prisma = new PrismaClient()

async function main() {
  console.log("🔧 Criando usuários ADMIN e MANAGER no banco local...")

  try {
    // Deletar usuários existentes se houver
    await prisma.users.deleteMany({
      where: {
        email: {
          in: ["admin@consigexpress.com", "elias157508@gmail.com"]
        }
      }
    })

    // Criar usuário ADMIN
    const adminPassword = await bcrypt.hash("admin123", 10)
    const admin = await prisma.users.create({
      data: {
        id: randomUUID(),
        email: "admin@consigexpress.com",
        password: adminPassword,
        role: "ADMIN",
        name: "Administrador",
        updatedAt: new Date(),
      },
    })
    console.log("✅ ADMIN criado:", admin.email)

    // Criar usuário MANAGER (A.S.P.M.A)
    const managerPassword = await bcrypt.hash("aspma2024", 10)
    const manager = await prisma.users.create({
      data: {
        id: randomUUID(),
        email: "elias157508@gmail.com",
        password: managerPassword,
        role: "MANAGER",
        name: "A.S.P.M.A",
        updatedAt: new Date(),
      },
    })
    console.log("✅ MANAGER criado:", manager.email)

    console.log("\n📋 Credenciais de acesso:")
    console.log("\n🔐 ADMIN:")
    console.log("   Email: admin@consigexpress.com")
    console.log("   Senha: admin123")
    console.log("\n👤 MANAGER:")
    console.log("   Email: elias157508@gmail.com")
    console.log("   Senha: aspma2024")
  } catch (error) {
    console.error("❌ Erro:", error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
