"use client"

import { useState, useEffect } from "react"
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
import { Plus, Pencil, Trash2, Search, UserPlus, Users as UsersIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { UserDialog } from "@/components/user-dialog"

interface User {
  id: string
  name: string
  email: string
  role: string
  cpf?: string
  phone?: string
  active: boolean
  createdAt: string
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/usuarios?search=${searchTerm}`)
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
    loadUsers()
  }, [])

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadUsers()
    }, 500)
    return () => clearTimeout(debounce)
  }, [searchTerm])

  const handleEdit = (user: User) => {
    setSelectedUser(user)
    setDialogOpen(true)
  }

  const handleNew = () => {
    setSelectedUser(null)
    setDialogOpen(true)
  }

  const handleDelete = async (user: User) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário ${user.name}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/usuarios/${user.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        loadUsers()
      } else {
        const error = await response.json()
        alert(error.error || "Erro ao excluir usuário")
      }
    } catch (error) {
      alert("Erro ao excluir usuário")
    }
  }

  const roleLabels: Record<string, string> = {
    ADMIN: "Administrador",
    MANAGER: "Gerente",
    OPERATOR: "Operador",
    USER: "Usuário",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Gerencie os usuários da plataforma
          </p>
        </div>
        <button
          onClick={handleNew}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#6366f1',
            color: '#ffffff',
            fontWeight: '600',
            fontSize: '0.875rem',
            borderRadius: '0.375rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.3)',
            transition: 'all 0.2s',
            height: '2.25rem'
          }}
          className="w-full md:w-auto"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366f1'}
        >
          <UserPlus style={{ width: '16px', height: '16px' }} />
          Novo Usuário
        </button>
      </div>

      {/* Search bar */}
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

      {/* Table */}
      <Card className="border-gray-200 dark:border-gray-800">
        <CardHeader className="border-b border-gray-200 dark:border-gray-800">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UsersIcon className="h-5 w-5" />
            Lista de Usuários
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 px-4">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-6">
                  <UsersIcon className="h-12 w-12 text-muted-foreground" />
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhum usuário cadastrado</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Comece adicionando o primeiro usuário ao sistema
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                    <TableHead className="font-semibold">Nome</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">Função</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-medium">
                          {roleLabels[user.role] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={user.active ? "default" : "secondary"}
                          className={user.active ? "bg-green-500 hover:bg-green-600 text-white" : ""}
                        >
                          {user.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEdit(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                            onClick={() => handleDelete(user)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
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
      />
    </div>
  )
}
