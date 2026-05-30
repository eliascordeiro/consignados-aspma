import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  const tipos = await db.tipo.findMany({ orderBy: { tipo: "asc" } })
  return NextResponse.json(tipos)
}
