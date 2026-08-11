import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  // Quantos socios têm codTipo?
  const count = await p.socio.count({ where: { codTipo: { not: null } } })
  console.log('Socios com codTipo:', count)
  
  // Valores distintos de codTipo
  const distinct = await p.socio.groupBy({ by: ['codTipo'], _count: { codTipo: true }, orderBy: { codTipo: 'asc' } })
  console.log('Valores distintos de codTipo:', JSON.stringify(distinct))
  
  // Listar primeiros 20 setores ordenados por id
  const setores = await p.setor.findMany({ orderBy: { id: 'asc' }, take: 20, select: { id: true, codigo: true, setores: true } })
  console.log('Primeiros 20 setores (por id):', JSON.stringify(setores))
}
main().catch(console.error).finally(() => p.$disconnect())
