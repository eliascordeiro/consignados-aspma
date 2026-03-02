import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SignJWT } from 'jose'
import { sendWhatsApp } from '@/lib/whatsgw'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

function normalizar(v: string) { return v.replace(/\D/g, '') }

function gerarOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(request: NextRequest) {
  try {
    const { celular } = await request.json()
    if (!celular) {
      return NextResponse.json({ error: 'Celular obrigatório' }, { status: 400 })
    }

    const celularLimpo = normalizar(celular.trim())

    const socio = await prisma.socio.findFirst({
      where: {
        ativo: true,
        OR: [
          { celular: celularLimpo },
          { celular: celular.trim() },
        ],
      },
      select: { id: true, nome: true, celular: true },
    })

    if (!socio || !socio.celular) {
      return NextResponse.json({ error: 'Celular não encontrado. Verifique o número ou entre em contato com a secretaria.' }, { status: 404 })
    }

    const otp = gerarOTP()
    const primeiroNome = socio.nome.split(' ')[0]

    // Token JWT com OTP embutido — stateless, sem coluna extra no banco
    const sessionToken = await new SignJWT({ socioId: socio.id, otp, type: 'otp_request' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(JWT_SECRET)

    const texto = `*ASPMA - Portal do Sócio*\n\nOlá, ${primeiroNome}!\n\nSeu código de verificação é:\n\n*${otp}*\n\n⏱ Válido por 10 minutos.\n\nNão compartilhe este código.`
    const whatsOk = await sendWhatsApp(socio.celular, texto)

    if (!whatsOk.success) {
      console.error('[solicitar-otp] Falha WhatsApp:', whatsOk.error)
    }

    const celularNum = socio.celular.replace(/\D/g, '')
    const celularMask = celularNum.length >= 8
      ? `(${celularNum.slice(-10, -8) || '??'}) ****-${celularNum.slice(-4)}`
      : '****'

    return NextResponse.json({
      sessionToken,
      celularMask,
    })
  } catch (err) {
    console.error('[solicitar-otp]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
