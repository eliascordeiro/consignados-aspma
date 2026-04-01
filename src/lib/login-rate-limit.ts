import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutos

/**
 * Verifica e registra uma tentativa de login.
 * Retorna { blocked: true, minutosRestantes } se o usuário excedeu o limite.
 * @param key - login (email/usuario) ou celular normalizado
 */
export async function checkLoginRateLimit(
  key: string,
  ipAddress?: string
): Promise<{ blocked: boolean; minutosRestantes: number }> {
  const windowStart = new Date(Date.now() - WINDOW_MS)

  // Contar tentativas na janela
  const count = await prisma.loginAttempt.count({
    where: {
      key,
      createdAt: { gte: windowStart },
    },
  })

  if (count >= MAX_ATTEMPTS) {
    // Descobrir quanto tempo falta para a janela expirar
    const oldest = await prisma.loginAttempt.findFirst({
      where: { key, createdAt: { gte: windowStart } },
      orderBy: { createdAt: 'asc' },
    })
    const expiresAt = oldest
      ? new Date(oldest.createdAt.getTime() + WINDOW_MS)
      : new Date(Date.now() + WINDOW_MS)
    const minutosRestantes = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 60_000))
    return { blocked: true, minutosRestantes }
  }

  // Registrar esta tentativa
  await prisma.loginAttempt.create({
    data: {
      id: randomBytes(16).toString('hex'),
      key,
      ipAddress: ipAddress ?? null,
    },
  })

  return { blocked: false, minutosRestantes: 0 }
}

/**
 * Limpa as tentativas de login após sucesso.
 */
export async function clearLoginAttempts(key: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key } })
}

/**
 * Remove tentativas expiradas. Chamar periodicamente ou no startup.
 */
export async function purgeExpiredAttempts(): Promise<void> {
  const windowStart = new Date(Date.now() - WINDOW_MS)
  await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: windowStart } },
  })
}
