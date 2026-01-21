import { 
  LayoutDashboard, 
  Building2,
  Users,
  Store,
  LucideIcon,
  Eye,
  Plus,
  Edit,
  Trash2,
  Download,
  UserCog
} from "lucide-react"

export interface Permission {
  id: string
  name: string
  description: string
  module?: string
  icon?: LucideIcon
}

export interface PermissionModule {
  id: string
  name: string
  icon: LucideIcon
  permissions: Permission[]
}

// Permissões granulares organizadas por módulo
export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: "consignatarias",
    name: "Consignatárias",
    icon: Building2,
    permissions: [
      { id: "consignatarias.view", name: "Consultar", description: "Visualizar lista e detalhes", icon: Eye },
      { id: "consignatarias.create", name: "Incluir", description: "Criar novas consignatárias", icon: Plus },
      { id: "consignatarias.edit", name: "Editar", description: "Modificar consignatárias existentes", icon: Edit },
      { id: "consignatarias.delete", name: "Excluir", description: "Remover consignatárias", icon: Trash2 },
      { id: "consignatarias.export", name: "Exportar", description: "Exportar dados para arquivo", icon: Download },
    ]
  },
  {
    id: "funcionarios",
    name: "Funcionários",
    icon: Users,
    permissions: [
      { id: "funcionarios.view", name: "Consultar", description: "Visualizar lista e detalhes", icon: Eye },
      { id: "funcionarios.create", name: "Incluir", description: "Criar novos funcionários", icon: Plus },
      { id: "funcionarios.edit", name: "Editar", description: "Modificar funcionários existentes", icon: Edit },
      { id: "funcionarios.delete", name: "Excluir", description: "Remover funcionários", icon: Trash2 },
      { id: "funcionarios.export", name: "Exportar", description: "Exportar dados para arquivo", icon: Download },
    ]
  },
  {
    id: "convenios",
    name: "Convênios",
    icon: Store,
    permissions: [
      { id: "convenios.view", name: "Consultar", description: "Visualizar lista e detalhes", icon: Eye },
      { id: "convenios.create", name: "Incluir", description: "Criar novos convênios", icon: Plus },
      { id: "convenios.edit", name: "Editar", description: "Modificar convênios existentes", icon: Edit },
      { id: "convenios.delete", name: "Excluir", description: "Remover convênios", icon: Trash2 },
      { id: "convenios.export", name: "Exportar", description: "Exportar dados para arquivo", icon: Download },
    ]
  },
  {
    id: "usuarios",
    name: "Usuários",
    icon: UserCog,
    permissions: [
      { id: "usuarios.view", name: "Consultar", description: "Visualizar lista e detalhes", icon: Eye },
      { id: "usuarios.create", name: "Incluir", description: "Criar novos usuários", icon: Plus },
      { id: "usuarios.edit", name: "Editar", description: "Modificar usuários existentes", icon: Edit },
      { id: "usuarios.delete", name: "Excluir", description: "Remover usuários", icon: Trash2 },
    ]
  },
]

// Lista plana de todas as permissões (gerada automaticamente)
export const AVAILABLE_PERMISSIONS: Permission[] = PERMISSION_MODULES.flatMap(module => 
  module.permissions.map(p => ({ ...p, module: module.id }))
)

// Helper para verificar se usuário tem permissão
export function hasPermission(userPermissions: string[], permissionId: string): boolean {
  return userPermissions.includes(permissionId)
}

// Helper para verificar se usuário tem acesso ao módulo (pelo menos uma permissão)
export function hasModuleAccess(userPermissions: string[], moduleId: string): boolean {
  return userPermissions.some(p => p.startsWith(`${moduleId}.`))
}

// Helper para obter permissões do usuário filtradas
export function getUserPermissions(userPermissions: string[]): Permission[] {
  return AVAILABLE_PERMISSIONS.filter(p => userPermissions.includes(p.id))
}

// Helper para obter módulos com acesso
export function getUserModules(userPermissions: string[]): PermissionModule[] {
  return PERMISSION_MODULES.filter(module => hasModuleAccess(userPermissions, module.id))
}

