import { NextRequest, NextResponse } from 'next/server'
import { isRateLimited } from '@/lib/login-rate-limit'

/**
 * GET /api/auth/rate-limit-status?login=<login>
 * Endpoint público que informa se um login está bloqueado por rate limiting.
 * Não revela dados sensíveis — apenas blocked/minutosRestantes.
 */
export async function GET(request: NextRequest) {
  const login = request.nextUrl.searchParams.get('login')?.trim().toLowerCase()
  if (!login) {
    return NextResponse.json({ blocked: false, minutosRestantes: 0 })
  }

  try {
    const { blocked, minutosRestantes } = await isRateLimited(`admin:${login}`)
    return NextResponse.json({ blocked, minutosRestantes })
  } catch {
    // Falha aberta: erro técnico não bloqueia
    return NextResponse.json({ blocked: false, minutosRestantes: 0 })
  }
}
