import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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
  matcher: ['/portal/:path*', '/convenio/:path*'],
}
