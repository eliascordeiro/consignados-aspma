import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/**
 * Formata número de celular brasileiro conforme o usuário digita.
 * Aceita 10 dígitos (fixo)  → (XX) XXXX-XXXX
 * Aceita 11 dígitos (móvel) → (XX) XXXXX-XXXX
 * Remove DDI 55 se presente.
 */
export function formatarCelular(value: string): string {
  // Remove tudo que não é dígito e limita a 11 chars
  let d = value.replace(/\D/g, '')
  // Remove DDI 55 se o usuário colar número internacional
  if (d.startsWith('55') && d.length > 11) d = d.slice(2)
  d = d.slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2)  return `(${d}`
  if (d.length <= 6)  return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return                      `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
