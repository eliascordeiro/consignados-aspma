import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🔍 Verificando usuário A.S.P.M.A...\n")

  const user = await prisma.user.findUnique({
    where: { email: "elias157508@gmail.com" },
  })

  if (!user) {
    console.log("❌ Usuário não encontrado!")
    return
  }

  console.log("✅ Usuário encontrado:")
  console.log("   ID:", user.id)
  console.log("   Email:", user.email)
  console.log("   Nome:", user.name)
  console.log("   Role:", user.role)
  console.log("   Ativo:", user.active)

  // Verificar dados
  const empresas = await prisma.empresa.count()
  const funcionarios = await prisma.socio.count()
  const convenios = await prisma.convenio.count()

  console.log("\n📊 Estatísticas do banco:")
  console.log("   Empresas:", empresas)
  console.log("   Funcionários:", funcionarios)
  console.log("   Convênios:", convenios)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
