import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Users, Store } from "lucide-react"

export default async function ClienteDashboard() {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/login")
  }

  // Permitir MANAGER e USER (usuários subordinados)
  if (session.user.role !== "MANAGER" && session.user.role !== "USER") {
    redirect("/login")
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Portal do Cliente</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Gerencie suas consignatárias, sócios e conveniados
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-2 hover:shadow-lg transition-shadow cursor-pointer group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Consignatárias</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground group-hover:text-green-600 transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Empresas cadastradas</p>
          </CardContent>
        </Card>

        <Card className="border-2 hover:shadow-lg transition-shadow cursor-pointer group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sócios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Sócios ativos</p>
          </CardContent>
        </Card>

        <Card className="border-2 hover:shadow-lg transition-shadow cursor-pointer group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conveniados</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground group-hover:text-purple-600 transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Convênios ativos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bem-vindo!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Este é o portal de gestão de descontos em folha. Aqui você pode:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-green-600 mt-0.5" />
                <span><strong>Gerenciar Consignatárias:</strong> Cadastre e administre empresas públicas e privadas</span>
              </li>
              <li className="flex items-start gap-2">
                <Users className="h-4 w-4 text-blue-600 mt-0.5" />
                <span><strong>Cadastrar Sócios:</strong> Vincule sócios às consignatárias</span>
              </li>
              <li className="flex items-start gap-2">
                <Store className="h-4 w-4 text-purple-600 mt-0.5" />
                <span><strong>Autorizar Conveniados:</strong> Defina onde os sócios podem usar suas margens</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos Passos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <span className="text-sm font-bold text-green-600">1</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Cadastre suas consignatárias</p>
                <p className="text-xs text-muted-foreground">Adicione empresas ao sistema</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <span className="text-sm font-bold text-blue-600">2</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Importe sócios</p>
                <p className="text-xs text-muted-foreground">Vincule sócios às empresas</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <span className="text-sm font-bold text-purple-600">3</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Configure autorizações</p>
                <p className="text-xs text-muted-foreground">Defina os convênios autorizados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
