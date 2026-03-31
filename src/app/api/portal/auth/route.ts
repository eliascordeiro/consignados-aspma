import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutos

interface RateEntry {
  count: number
  firstAttempt: number
}

const rateLimitMap = new Map<string, RateEntry>()

// Limpa entradas expiradas periodicamente para não crescer indefinidamente
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.firstAttempt > WINDOW_MS) rateLimitMap.delete(key)
  }
}, WINDOW_MS)

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

function checkRateLimit(ip: string): { blocked: boolean; minutosRestantes: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, firstAttempt: now })
    return { blocked: false, minutosRestantes: 0 }
  }

  entry.count++
  if (entry.count > MAX_ATTEMPTS) {
    const expiresAt = entry.firstAttempt + WINDOW_MS
    const minutosRestantes = Math.ceil((expiresAt - now) / 60_000)
    return { blocked: true, minutosRestantes }
  }

  return { blocked: false, minutosRestantes: 0 }
}

function clearRateLimit(ip: string) {
  rateLimitMap.delete(ip)
}
// ─────────────────────────────────────────────────────────────────────────────

// Normaliza CPF/celular removendo pontuação
function normalizar(valor: string) {
  return valor.replace(/\D/g, '')
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const { blocked, minutosRestantes } = checkRateLimit(ip)

  if (blocked) {
    return NextResponse.json(
      { error: `Muitas tentativas de login. Aguarde ${minutosRestantes} minuto${minutosRestantes > 1 ? 's' : ''} e tente novamente.` },
      { status: 429 }
    )
  }

  try {
    const { celular, senha } = await request.json()

    if (!celular || !senha) {
      return NextResponse.json({ error: 'Celular e senha são obrigatórios' }, { status: 400 })
    }

    const celularLimpo = normalizar(celular.trim())

    // Busca somente por celular
    const socio = await prisma.socio.findFirst({
      where: {
        ativo: true,
        OR: [
          { celular: celularLimpo },
          { celular: celular.trim() },
        ],
      },
      select: {
        id: true,
        nome: true,
        cpf: true,
        email: true,
        celular: true,
        matricula: true,
        senha: true,
        bloqueio: true,
        motivoBloqueio: true,
        ativo: true,
      },
    })

    if (!socio) {
      return NextResponse.json({ error: 'Celular não encontrado ou não cadastrado.' }, { status: 401 })
    }

    if (socio.bloqueio === 'S') {
      return NextResponse.json({
        error: `Acesso bloqueado. ${socio.motivoBloqueio ? `Motivo: ${socio.motivoBloqueio}` : 'Entre em contato com a ASPMA.'}`,
      }, { status: 403 })
    }

    // Verificar senha — suporta bcrypt e texto puro (legado)
    if (!socio.senha) {
      return NextResponse.json({
        error: 'Você ainda não definiu uma senha. Use "Criar / Redefinir Senha" para cadastrar.',
        semSenha: true,
      }, { status: 401 })
    }

    let senhaOk = false
    const isBcrypt = socio.senha.startsWith('$2')
    if (isBcrypt) {
      senhaOk = await bcrypt.compare(senha, socio.senha)
    } else {
      // senha legada em texto puro
      senhaOk = socio.senha === senha
    }

    if (!senhaOk) {
      return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 })
    }

    // Gerar JWT
    const token = await new SignJWT({
      socioId: socio.id,
      nome: socio.nome,
      matricula: socio.matricula,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(JWT_SECRET)

    // Login bem-sucedido: limpa o contador de tentativas
    clearRateLimit(ip)

    const response = NextResponse.json({ ok: true, nome: socio.nome.split(' ')[0] })
    response.cookies.set('portal_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8h
      path: '/',
    })

    return response
  } catch (error) {
    console.error('[portal/auth]', error)
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('portal_token')
  return response
}
