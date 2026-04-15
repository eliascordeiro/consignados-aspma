import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import sharp from "sharp"

const MAX_SIZE = 5 * 1024 * 1024 // 5MB (antes de processar)
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
const LOGO_MAX_DIM = 512 // dimensão máxima em pixels

// PUT - Upload logo (base64)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    const user = await prisma.users.findUnique({ where: { id }, select: { id: true } })
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("logo") as File | null

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de arquivo não permitido. Use PNG, JPG, WebP ou SVG." },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo 5MB." },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const inputBuffer = Buffer.from(bytes)

    let outputBuffer: Buffer
    let outputMime: string

    if (file.type === "image/svg+xml") {
      // SVG: manter original (já é vetorial)
      outputBuffer = inputBuffer
      outputMime = "image/svg+xml"
    } else {
      // Processar imagem com sharp:
      // - Redimensionar para max 512x512 mantendo proporção
      // - Converter para PNG (preserva transparência)
      // - Otimizar qualidade
      outputBuffer = await sharp(inputBuffer)
        .resize(LOGO_MAX_DIM, LOGO_MAX_DIM, {
          fit: "inside",         // mantém proporção, não corta
          withoutEnlargement: true, // não amplia imagens pequenas
        })
        .png({
          quality: 90,
          compressionLevel: 9,  // máxima compressão sem perda
          palette: true,        // otimiza para logos com poucas cores
        })
        .sharpen({              // nitidez para logos que ficam borradas
          sigma: 0.8,
        })
        .toBuffer()
      outputMime = "image/png"
    }

    const base64 = outputBuffer.toString("base64")
    const dataUrl = `data:${outputMime};base64,${base64}`

    await prisma.users.update({
      where: { id },
      data: { logo: dataUrl },
    })

    return NextResponse.json({ logo: dataUrl })
  } catch (error) {
    console.error("Erro ao fazer upload do logo:", error)
    return NextResponse.json({ error: "Erro ao fazer upload" }, { status: 500 })
  }
}

// DELETE - Remover logo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    await prisma.users.update({
      where: { id },
      data: { logo: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao remover logo:", error)
    return NextResponse.json({ error: "Erro ao remover logo" }, { status: 500 })
  }
}
