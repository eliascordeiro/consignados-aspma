import crypto from 'crypto'

export function onlyDigits(v: string): string {
  return (v || '').replace(/\D/g, '')
}

export function isValidCpf(cpf: string): boolean {
  const c = onlyDigits(cpf)
  if (c.length !== 11) return false
  if (/^(\d)\1{10}$/.test(c)) return false
  const calc = (base: string, factorStart: number) => {
    let sum = 0
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i], 10) * (factorStart - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  const d1 = calc(c.slice(0, 9), 10)
  const d2 = calc(c.slice(0, 10), 11)
  return d1 === parseInt(c[9], 10) && d2 === parseInt(c[10], 10)
}

/** Aceita DD/MM/AAAA, DD-MM-AAAA, DDMMAAAA */
export function parseBirthDate(input: string): Date | null {
  const t = (input || '').trim()
  let m = t.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/)
  if (!m) m = t.match(/^(\d{2})(\d{2})(\d{4})$/)
  if (!m) return null
  const dd = parseInt(m[1], 10)
  const mm = parseInt(m[2], 10)
  const yyyy = parseInt(m[3], 10)
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > 2100) return null
  const d = new Date(Date.UTC(yyyy, mm - 1, dd))
  if (d.getUTCFullYear() !== yyyy || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return null
  return d
}

export function sameDateUTC(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function maskCpf(cpf: string): string {
  const c = onlyDigits(cpf)
  if (c.length !== 11) return '***'
  return `${c.slice(0, 3)}.***.***-${c.slice(9)}`
}

export function normalizePhoneE164BR(phone: string): string {
  const p = onlyDigits(phone)
  if (!p) return ''
  return p.startsWith('55') ? p : `55${p}`
}

export function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
