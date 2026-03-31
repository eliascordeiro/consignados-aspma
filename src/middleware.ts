import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

// ─── Rate Limiting — Login Administrativo ────────────────────────────────────
const ADMIN_MAX_ATTEMPTS = 5
const ADMIN_WINDOW_MS = 15 * 60 * 1000 // 15 minutos

interface RateEntry { count: number; firstAttempt: number }
const adminRateLimitMap = new Map<string, RateEntry>()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of adminRateLimitMap) {
    if (now - entry.firstAttempt > ADMIN_WINDOW_MS) adminRateLimitMap.delete(key)
  }
}, ADMIN_WINDOW_MS)

function checkAdminRateLimit(ip: string): { blocked: boolean; minutosRestantes: number } {
  const now = Date.now()
  const entry = adminRateLimitMap.get(ip)

  if (!entry || now - entry.firstAttempt > ADMIN_WINDOW_MS) {
    adminRateLimitMap.set(ip, { count: 1, firstAttempt: now })
    return { blocked: false, minutosRestantes: 0 }
  }

  entry.count++
  if (entry.count > ADMIN_MAX_ATTEMPTS) {
    const minutosRestantes = Math.ceil((entry.firstAttempt + ADMIN_WINDOW_MS - now) / 60_000)
    return { blocked: true, minutosRestantes }
  }

  return { blocked: false, minutosRestantes: 0 }
}
// ─────────────────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Rate Limiting no login administrativo (NextAuth) ─────────────────────
  if (pathname === '/api/auth/callback/credentials' && request.method === 'POST') {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const { blocked, minutosRestantes } = checkAdminRateLimit(ip)
    if (blocked) {
      return NextResponse.json(
        { error: `Muitas tentativas de login. Aguarde ${minutosRestantes} minuto${minutosRestantes > 1 ? 's' : ''}.` },
        { status: 429 }
      )
    }
  }

  // Forward pathname to server components via header
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  // ── Portal do Sócio ──────────────────────────────────────────────────────
  if (pathname.startsWith('/portal')) {
    // Rotas públicas do portal
    const publicPortalRoutes = ['/portal/login', '/portal/primeiro-acesso', '/portal/redefinir-senha']
    if (publicPortalRoutes.some(r => pathname.startsWith(r))) {
      return NextResponse.next({ request: { headers: requestHeaders } })
    }

    // Verificar token do portal
    const token = request.cookies.get('portal_token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/portal/login', request.url))
    }

    try {
      await jwtVerify(token, JWT_SECRET)
      return NextResponse.next({ request: { headers: requestHeaders } })
    } catch {
      const response = NextResponse.redirect(new URL('/portal/login', request.url))
      response.cookies.delete('portal_token')
      return response
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/portal/:path*', '/convenio/:path*', '/api/auth/callback/credentials'],
}
