import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

export type AuditAction = 
  | "CREATE" 
  | "UPDATE" 
  | "DELETE" 
  | "LOGIN" 
  | "LOGOUT" 
  | "PASSWORD_RESET"
  | "EXPORT"
  | "IMPORT"
  | "VIEW"

export type AuditModule = 
  | "funcionarios" 
  | "consignatarias" 
  | "usuarios" 
  | "convenios"
  | "consignados"
  | "auth"
  | "sistema"

export interface AuditLogData {
  userId: string
  userName: string
  userRole: string
  action: AuditAction
  module: AuditModule
  entityId?: string
  entityName?: string
  description: string
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

/**
 * Registra uma ação no log de auditoria
 */
export async function createAuditLog(data: AuditLogData) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        userName: data.userName,
        userRole: data.userRole,
        action: data.action,
        module: data.module,
        entityId: data.entityId,
        entityName: data.entityName,
        description: data.description,
        metadata: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      }
    })
  } catch (error) {
    console.error("Erro ao criar log de auditoria:", error)
    // Não lançar erro para não quebrar a operação principal
  }
}

/**
 * Helper para extrair IP e User Agent da requisição
 */
export function getRequestInfo(request: NextRequest) {
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                    request.headers.get("x-real-ip") || 
                    "unknown"
  const userAgent = request.headers.get("user-agent") || "unknown"
  
  return { ipAddress, userAgent }
}

/**
 * Formata uma descrição de ação de CREATE
 */
export function formatCreateDescription(module: string, entityName: string) {
  const moduleNames: Record<string, string> = {
    funcionarios: "Funcionário",
    consignatarias: "Consignatária",
    usuarios: "Usuário",
    convenios: "Convênio",
    consignados: "Consignado"
  }
  
  return `${moduleNames[module] || module} "${entityName}" criado(a)`
}

/**
 * Formata uma descrição de ação de UPDATE
 */
export function formatUpdateDescription(module: string, entityName: string) {
  const moduleNames: Record<string, string> = {
    funcionarios: "Funcionário",
    consignatarias: "Consignatária",
    usuarios: "Usuário",
    convenios: "Convênio",
    consignados: "Consignado"
  }
  
  return `${moduleNames[module] || module} "${entityName}" atualizado(a)`
}

/**
 * Formata uma descrição de ação de DELETE
 */
export function formatDeleteDescription(module: string, entityName: string) {
  const moduleNames: Record<string, string> = {
    funcionarios: "Funcionário",
    consignatarias: "Consignatária",
    usuarios: "Usuário",
    convenios: "Convênio",
    consignados: "Consignado"
  }
  
  return `${moduleNames[module] || module} "${entityName}" excluído(a)`
}
