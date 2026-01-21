"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Search, UserPlus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { UserDialog } from "@/components/user-dialog"
import { toast } from "sonner"
import { hasPermission } from "@/config/permissions"

interface User {
  id: string
  name: string
  email: string
  role: string
  cpf?: string
  phone?: string
  active: boolean
  createdAt: string
  permissions?: string[]
}

export default function UsuariosPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const userPermissions = (session?.user as any)?.permissions || []
  const canView = hasPermission(userPermissions, "usuarios.view")
  const canCreate = hasPermission(userPermissions, "usuarios.create")
  const canEdit = hasPermission(userPermissions, "usuarios.edit")
  const canDelete = hasPermission(userPermissions, "usuarios.delete")

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/cliente/usuarios?search=${searchTerm}`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error("Erro ao carregar usuários:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canView) {
      loadUsers()
    }
  }, [canView])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (canView) {
        loadUsers()
      }
    }, 500)
    return () => clearTimeout(debounce)
  }, [searchTerm, canView])

  const handleEdit = (user: User) => {
    if (!canEdit) {
      toast.error("Você não tem permissão para editar usuários")
      return
    }
    setSelectedUser(user)
    setDialogOpen(true)
  }

  const handleNew = () => {
    if (!canCreate) {
      toast.error("Você não tem permissão para criar usuários")
      return
    }
    setSelectedUser(null)
    setDialogOpen(true)
  }

  const handleDelete = async (user: User) => {
    if (!canDelete) {
      toast.error("Você não tem permissão para excluir usuários")
      return
    }

    if (!confirm(`Tem certeza que deseja excluir o usuário ${user.name}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/cliente/usuarios/${user.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Usuário excluído com sucesso!")
        loadUsers()
      } else {
        const error = await response.json()
        toast.error(error.error || "Erro ao excluir usuário")
      }
    } catch (error) {
      console.error("Erro ao excluir usuário:", error)
      toast.error("Erro ao excluir usuário")
    }
  }

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">
          Você não tem permissão para visualizar usuários.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Gerencie os usuários com acesso ao sistema
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleNew} className="w-full md:w-auto">
            <UserPlus className="mr-2 h-4 w-4" />
            Novo Usuário
          </Button>
        )}
      </div>

      <div className="flex gap-4 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum usuário encontrado</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                {searchTerm
                  ? "Tente ajustar os termos de busca"
                  : "Comece adicionando o primeiro usuário ao sistema"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                    <TableHead className="font-semibold">Nome</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold hidden md:table-cell">CPF</TableHead>
                    <TableHead className="font-semibold hidden md:table-cell">Telefone</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    {(canEdit || canDelete) && (
                      <TableHead className="text-right font-semibold">Ações</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="hidden md:table-cell">{user.cpf || "-"}</TableCell>
                      <TableCell className="hidden md:table-cell">{user.phone || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={user.active ? "default" : "secondary"}>
                          {user.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(user)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(user)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <UserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={selectedUser}
        onSuccess={loadUsers}
        defaultRole="USER"
        isClientPortal={true}
      />
    </div>
  )
}
