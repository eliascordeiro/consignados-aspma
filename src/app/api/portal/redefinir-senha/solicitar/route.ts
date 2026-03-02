import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SignJWT } from 'jose'
import { sendWhatsApp } from '@/lib/whatsgw'
import { Resend } from 'resend'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)
const resend = new Resend(process.env.RESEND_API_KEY)

function normalizar(v: string) { return v.replace(/\D/g, '') }

function gerarOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function enviarEmailOTP(email: string, nome: string, otp: string): Promise<boolean> {
  try {
    await resend.emails.send({
      from: process.env.SMTP_FROM || 'aspma@aspma-consignados.com.br',
      to: email,
      subject: `${otp} — Código de verificação ASPMA`,
      html: `
        <!DOCTYPE html><html><head><meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
          .box { max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
          .header { background: linear-gradient(135deg, #059669, #0d9488); padding: 28px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 20px; }
          .body { padding: 28px; text-align: center; }
          .otp { display: inline-block; background: #f0fdf4; border: 2px solid #059669; border-radius: 12px; padding: 16px 40px; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #065f46; margin: 20px 0; }
          .info { color: #6b7280; font-size: 13px; margin-top: 16px; }
          .footer { text-align: center; padding: 16px; color: #9ca3af; font-size: 11px; }
        </style></head>
        <body>
          <div class="box">
            <div class="header"><h1>Portal do Sócio · ASPMA</h1></div>
            <div class="body">
              <p style="color:#374151">Olá, <strong>${nome}</strong>!</p>
              <p style="color:#374151">Seu código de verificação é:</p>
              <div class="otp">${otp}</div>
              <p class="info">⏱ Este código expira em <strong>10 minutos</strong>.<br>
              Não compartilhe com ninguém.</p>
            </div>
            <div class="footer">
              © 2026 A.S.P.M.A — Associação dos Servidores Municipais de Araucária
            </div>
          </div>
        </body></html>
      `,
    })
    return true
  } catch (err) {
    console.error('[solicitar-otp] email error:', err)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const { identificador } = await request.json()
    if (!identificador) {
      return NextResponse.json({ error: 'Identificador obrigatório' }, { status: 400 })
    }

    const id = identificador.trim()
    const idLimpo = normalizar(id)

    const socio = await prisma.socio.findFirst({
      where: {
        ativo: true,
        OR: [
          { email: id },
          { cpf: idLimpo },
          { cpf: id },
          { celular: idLimpo },
          { celular: id },
        ],
      },
      select: { id: true, nome: true, email: true, celular: true },
    })

    if (!socio) {
      return NextResponse.json({ error: 'Sócio não encontrado. Verifique CPF, e-mail ou celular.' }, { status: 404 })
    }

    if (!socio.email && !socio.celular) {
      return NextResponse.json({ error: 'Não há e-mail nem celular cadastrado. Entre em contato com a secretaria.' }, { status: 422 })
    }

    const otp = gerarOTP()

    // Token JWT com OTP embutido — stateless, sem coluna extra no banco
    const sessionToken = await new SignJWT({ socioId: socio.id, otp, type: 'otp_request' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(JWT_SECRET)

    // Enviar em paralelo
    const primeiroNome = socio.nome.split(' ')[0]
    const texto = `*ASPMA - Portal do Sócio*\n\nOlá, ${primeiroNome}!\n\nSeu código de verificação é:\n\n*${otp}*\n\n⏱ Válido por 10 minutos.\n\nNão compartilhe este código.`

    const [whatsOk, emailOk] = await Promise.all([
      socio.celular ? sendWhatsApp(socio.celular, texto) : Promise.resolve({ success: false }),
      socio.email ? enviarEmailOTP(socio.email, primeiroNome, otp) : Promise.resolve(false),
    ])

    // Se NENHUM canal funcionou, avisa
    if (!whatsOk.success && !emailOk) {
      console.error('[solicitar-otp] Falha em todos os canais')
      // Ainda retorna o token — o código está nele, pior caso o dev testa em staging
    }

    return NextResponse.json({
      sessionToken,
      canais: {
        whatsapp: whatsOk.success,
        email: emailOk,
        celularMask: socio.celular ? `(${socio.celular.replace(/\D/g, '').slice(2, 4)}) ****-${socio.celular.replace(/\D/g, '').slice(-4)}` : null,
        emailMask: socio.email ? `${socio.email.slice(0, 2)}***@${socio.email.split('@')[1]}` : null,
      },
    })
  } catch (err) {
    console.error('[solicitar-otp]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
