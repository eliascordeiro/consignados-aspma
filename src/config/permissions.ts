import { 
  LayoutDashboard, 
  Building2,
  Users,
  Store,
  LucideIcon
} from "lucide-react"

export interface Permission {
  id: string
  name: string
  description: string
  href: string
  icon: LucideIcon
}

// Lista centralizada de permissões baseada no sidebar do cliente
export const AVAILABLE_PERMISSIONS: Permission[] = [
  { 
    id: "dashboard", 
    name: "Dashboard", 
    description: "Visualizar painel principal",
    href: "/cliente/dashboard", 
    icon: LayoutDashboard 
  },
  { 
    id: "consignatarias", 
    name: "Consignatárias", 
    description: "Gerenciar consignatárias",
    href: "/cliente/consignatarias", 
    icon: Building2 
  },
  { 
    id: "funcionarios", 
    name: "Funcionários", 
    description: "Gerenciar funcionários",
    href: "/cliente/funcionarios", 
    icon: Users 
  },
  { 
    id: "convenios", 
    name: "Convênios", 
    description: "Gerenciar convênios/locais",
    href: "/cliente/locais", 
    icon: Store 
  },
]

// Helper para verificar se usuário tem permissão
export function hasPermission(userPermissions: string[], permissionId: string): boolean {
  return userPermissions.includes(permissionId)
}

// Helper para obter permissões do usuário filtradas
export function getUserPermissions(userPermissions: string[]): Permission[] {
  return AVAILABLE_PERMISSIONS.filter(p => userPermissions.includes(p.id))
}
