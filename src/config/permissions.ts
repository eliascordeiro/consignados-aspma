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
  UserCog,
  FileText,
  ShoppingCart,
  BarChart3,
  Wallet
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
  displayName: string // Nome exibido no sidebar (fonte única de verdade)
  href: string // Rota no portal MANAGER
  icon: LucideIcon
  permissions: Permission[]
}

// Permissões granulares organizadas por módulo
export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: "consignatarias",
    name: "Consignatárias",
    displayName: "Consignatárias",
    href: "/cliente/consignatarias",
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
    name: "Sócios",
    displayName: "Sócios",
    href: "/cliente/funcionarios",
    icon: Users,
    permissions: [
      { id: "funcionarios.view", name: "Consultar", description: "Visualizar lista e detalhes", icon: Eye },
      { id: "funcionarios.create", name: "Incluir", description: "Criar novos sócios", icon: Plus },
      { id: "funcionarios.edit", name: "Editar", description: "Modificar sócios existentes", icon: Edit },
      { id: "funcionarios.delete", name: "Excluir", description: "Remover sócios", icon: Trash2 },
      { id: "funcionarios.export", name: "Exportar", description: "Exportar dados para arquivo", icon: Download },
    ]
  },
  {
    id: "margem",
    name: "Margem Consignada",
    displayName: "Margem Consignada",
    href: "/cliente/margem-consignada",
    icon: Wallet,
    permissions: [
      { id: "margem.view", name: "Consultar", description: "Visualizar margens e históricos", icon: Eye },
      { id: "margem.create", name: "Incluir", description: "Definir margem para sócios", icon: Plus },
      { id: "margem.edit", name: "Editar", description: "Alterar limite e margem consignável", icon: Edit },
      { id: "margem.delete", name: "Excluir", description: "Remover registros de margem", icon: Trash2 },
      { id: "margem.export", name: "Exportar", description: "Exportar dados para arquivo", icon: Download },
    ]
  },
  {
    id: "convenios",
    name: "Conveniados",
    displayName: "Conveniados",
    href: "/cliente/locais",
    icon: Store,
    permissions: [
      { id: "convenios.view", name: "Consultar", description: "Visualizar lista e detalhes", icon: Eye },
      { id: "convenios.create", name: "Incluir", description: "Criar novos conveniados", icon: Plus },
      { id: "convenios.edit", name: "Editar", description: "Modificar conveniados existentes", icon: Edit },
      { id: "convenios.delete", name: "Excluir", description: "Remover conveniados", icon: Trash2 },
      { id: "convenios.export", name: "Exportar", description: "Exportar dados para arquivo", icon: Download },
    ]
  },
  {
    id: "vendas",
    name: "Vendas",
    displayName: "Vendas",
    href: "/cliente/vendas",
    icon: ShoppingCart,
    permissions: [
      { id: "vendas.view", name: "Consultar", description: "Visualizar lista e detalhes de vendas", icon: Eye },
      { id: "vendas.create", name: "Incluir", description: "Lançar novas vendas", icon: Plus },
      { id: "vendas.edit", name: "Editar", description: "Modificar vendas e parcelas", icon: Edit },
      { id: "vendas.delete", name: "Excluir", description: "Cancelar vendas", icon: Trash2 },
      { id: "vendas.export", name: "Exportar", description: "Exportar dados para arquivo", icon: Download },
    ]
  },
  {
    id: "relatorios",
    name: "Relatórios",
    displayName: "Relatórios",
    href: "/cliente/relatorios",
    icon: BarChart3,
    permissions: [
      { id: "relatorios.view", name: "Consultar", description: "Visualizar e gerar relatórios", icon: Eye },
      { id: "relatorios.export", name: "Exportar", description: "Exportar relatórios para arquivo", icon: Download },
    ]
  },
  {
    id: "usuarios",
    name: "Usuários e Permissões",
    displayName: "Usuários e Permissões",
    href: "/cliente/usuarios",
    icon: UserCog,
    permissions: [
      { id: "usuarios.view", name: "Consultar", description: "Visualizar lista e detalhes", icon: Eye },
      { id: "usuarios.create", name: "Incluir", description: "Criar novos usuários", icon: Plus },
      { id: "usuarios.edit", name: "Editar", description: "Modificar usuários existentes", icon: Edit },
      { id: "usuarios.delete", name: "Excluir", description: "Remover usuários", icon: Trash2 },
    ]
  },
  {
    id: "logs",
    name: "Log de Auditoria",
    displayName: "Log de Auditoria",
    href: "/cliente/logs",
    icon: FileText,
    permissions: [
      { id: "logs.view", name: "Consultar", description: "Visualizar histórico de auditoria", icon: Eye },
      { id: "logs.export", name: "Exportar", description: "Exportar logs para arquivo", icon: Download },
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

