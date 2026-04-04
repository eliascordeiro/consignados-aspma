import { prisma } from "./prisma"

/**
 * Retorna o userId correto para filtrar dados.
 * 
 * - ADMIN/MANAGER: retorna o próprio ID (veem seus dados)
 * - USER subordinado: retorna o ID do MANAGER que o criou (herda dados do manager)
 * - Se não tem createdById: retorna o próprio ID
 * 
 * Isso garante que usuários criados por um MANAGER vejam os mesmos dados do MANAGER,
 * conforme as permissões atribuídas.
 */
export async function getDataUserId(session: {
  user: { id: string; role?: string }
}): Promise<string> {
  const { id, role } = session.user

  // ADMIN vê seus próprios dados
  if (role === "ADMIN") {
    return id
  }

  // MANAGER: pode ser sub-conta de outro MANAGER
  if (role === "MANAGER") {
    try {
      const mgr = await prisma.users.findUnique({
        where: { id },
        select: { managerPrincipalId: true } as any,
      }) as any
      // Se é sub-conta, herda os dados do manager principal
      if (mgr?.managerPrincipalId) return mgr.managerPrincipalId
    } catch {
      // Coluna managerPrincipalId ainda não existe no DB (migration pendente) — ignora
    }
    return id
  }

  // Para subordinados, buscar o MANAGER que o criou
  const currentUser = await prisma.users.findUnique({
    where: { id },
    select: { createdById: true }
  })

  // Se tem manager criador, usar o ID dele para ver os mesmos dados
  if (currentUser?.createdById) {
    // Se o criador é um sub-manager (tem managerPrincipalId), escalar para o principal
    // Isso garante que usuários criados por sub-managers vejam os dados do principal
    try {
      const creator = await prisma.users.findUnique({
        where: { id: currentUser.createdById },
        select: { managerPrincipalId: true } as any,
      }) as any
      if (creator?.managerPrincipalId) return creator.managerPrincipalId
    } catch {
      // Coluna managerPrincipalId ainda não existe no DB (migration pendente) — ignora
    }
    return currentUser.createdById
  }

  // Fallback: retorna o próprio ID
  return id
}
