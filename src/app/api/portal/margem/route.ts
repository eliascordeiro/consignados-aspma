import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

const ZETRA_CONFIG = {
  phpUrl: 'http://200.98.112.240/aspma/php/zetra_desktop/consultaMargemZetra.php',
  cliente: 'ASPMA',
  convenio: 'ASPMA-ARAUCARIA',
  usuario: 'aspma_xml',
  senha: 'dcc0bd05',
}

function extractXmlValue(startTag: string, endTag: string, xml: string): string | null {
  const startIndex = xml.indexOf(startTag)
  if (startIndex === -1) return null
  const valueStart = startIndex + startTag.length
  const endIndex = xml.indexOf(endTag, valueStart)
  if (endIndex === -1) return null
  return xml.substring(valueStart, endIndex).trim()
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get('portal_token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let socioId: string
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    socioId = payload.socioId as string
  } catch {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const socio = await prisma.socio.findUnique({
    where: { id: socioId },
    select: { codTipo: true, matricula: true, cpf: true, margemConsig: true },
  })

  if (!socio) return NextResponse.json({ error: 'Sócio não encontrado' }, { status: 404 })

  // tipos 3/4 = cálculo local (não usa Zetra)
  const isZetra = socio.codTipo === 1 || socio.codTipo === 2
  if (!isZetra) return NextResponse.json({ fonte: 'local', margem: null })

  try {
    const cpfNum = (socio.cpf || '').replace(/\D/g, '')
    const queryParams = new URLSearchParams({
      cliente: ZETRA_CONFIG.cliente,
      convenio: ZETRA_CONFIG.convenio,
      usuario: ZETRA_CONFIG.usuario,
      senha: ZETRA_CONFIG.senha,
      matricula: socio.matricula || '',
      cpf: cpfNum,
      valorParcela: '0',
    })

    const url = `${ZETRA_CONFIG.phpUrl}?${queryParams.toString()}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: queryParams.toString(),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const xml = await res.text()
    const sucesso = extractXmlValue('<ns13:sucesso>', '</ns13:sucesso>', xml)
    const mensagem = extractXmlValue('<ns13:mensagem>', '</ns13:mensagem>', xml)

    if (sucesso === 'false') {
      return NextResponse.json({
        fonte: 'zetra_erro',
        margem: Number(socio.margemConsig || 0),
        mensagem,
      })
    }

    const margemStr = extractXmlValue(
      '<ns6:valorMargem xmlns:ns6="InfoMargem">',
      '</ns6:valorMargem>',
      xml
    )
    if (!margemStr) throw new Error('valorMargem ausente no XML')

    const margem = parseFloat(margemStr)
    return NextResponse.json({ fonte: 'zetra', margem: isNaN(margem) ? 0 : margem })
  } catch (err) {
    console.error('[PORTAL MARGEM ZETRA]', err)
    // fallback: valor armazenado no banco
    return NextResponse.json({ fonte: 'fallback', margem: Number(socio.margemConsig || 0) })
  }
}
