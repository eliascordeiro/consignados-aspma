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

  // ADMIN e MANAGER veem seus próprios dados
  if (role === "ADMIN" || role === "MANAGER") {
    return id
  }

  // Para subordinados, buscar o MANAGER que o criou
  const currentUser = await prisma.users.findUnique({
    where: { id },
    select: { createdById: true }
  })

  // Se tem manager criador, usar o ID dele para ver os mesmos dados
  if (currentUser?.createdById) {
    return currentUser.createdById
  }

  // Fallback: retorna o próprio ID
  return id
}
