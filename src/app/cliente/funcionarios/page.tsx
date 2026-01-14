import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function FuncionariosPage() {
  const session = await auth()
  
  if (!session?.user || session.user.role !== "MANAGER") {
    redirect("/login")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Funcionários</h1>
        <p className="text-muted-foreground">Gerencie os funcionários das consignatárias</p>
      </div>

      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">Em desenvolvimento...</p>
      </div>
    </div>
  )
}
