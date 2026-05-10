import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Endpoint público chamado pelo botão "Sair" do portal da empresa
export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete('empresa_session')
  return NextResponse.json({ success: true })
}
