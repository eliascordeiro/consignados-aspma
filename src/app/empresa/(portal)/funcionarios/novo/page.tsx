"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, UserPlus, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function NovoFuncionarioPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    rg: "",
    matricula: "",
    funcao: "",
    lotacao: "",
    sexo: "",
    estadoCivil: "",
    dataNascimento: "",
    dataAdmissao: "",
    celular: "",
    telefone: "",
    email: "",
    cep: "",
    endereco: "",
    bairro: "",
    cidade: "",
    uf: "",
    banco: "",
    agencia: "",
    conta: "",
    limite: "",
    margemConsig: "",
  })

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.nome.trim()) {
      setError("Nome é obrigatório")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/empresa/socios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Erro ao cadastrar")
        return
      }
      router.push(`/empresa/funcionarios/${data.socio.id}`)
    } catch (err) {
      setError("Erro de conexão")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <Link
        href="/empresa/funcionarios"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar à lista
      </Link>

      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          Cadastrar Funcionário
        </h2>
        <p className="text-sm text-muted-foreground">Preencha os dados para adicionar um novo sócio à sua consignatária.</p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900/60 px-4 py-3 text-sm text-rose-800 dark:text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wide">Dados Pessoais</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome completo *" required>
              <Input value={form.nome} onChange={(e) => update("nome", e.target.value)} required />
            </Field>
            <Field label="CPF">
              <Input value={form.cpf} onChange={(e) => update("cpf", e.target.value)} placeholder="000.000.000-00" />
            </Field>
            <Field label="RG">
              <Input value={form.rg} onChange={(e) => update("rg", e.target.value)} />
            </Field>
            <Field label="Matrícula">
              <Input value={form.matricula} onChange={(e) => update("matricula", e.target.value)} />
            </Field>
            <Field label="Data de Nascimento">
              <Input type="date" value={form.dataNascimento} onChange={(e) => update("dataNascimento", e.target.value)} />
            </Field>
            <Field label="Sexo">
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                value={form.sexo}
                onChange={(e) => update("sexo", e.target.value)}
              >
                <option value="">—</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </Field>
            <Field label="Estado Civil">
              <Input value={form.estadoCivil} onChange={(e) => update("estadoCivil", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wide">Vínculo Profissional</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Função">
              <Input value={form.funcao} onChange={(e) => update("funcao", e.target.value)} />
            </Field>
            <Field label="Lotação">
              <Input value={form.lotacao} onChange={(e) => update("lotacao", e.target.value)} />
            </Field>
            <Field label="Data de Admissão">
              <Input type="date" value={form.dataAdmissao} onChange={(e) => update("dataAdmissao", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wide">Contato</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Celular">
              <Input value={form.celular} onChange={(e) => update("celular", e.target.value)} />
            </Field>
            <Field label="Telefone">
              <Input value={form.telefone} onChange={(e) => update("telefone", e.target.value)} />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wide">Endereço</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="CEP">
              <Input value={form.cep} onChange={(e) => update("cep", e.target.value)} />
            </Field>
            <Field label="Endereço">
              <Input value={form.endereco} onChange={(e) => update("endereco", e.target.value)} />
            </Field>
            <Field label="Bairro">
              <Input value={form.bairro} onChange={(e) => update("bairro", e.target.value)} />
            </Field>
            <Field label="Cidade">
              <Input value={form.cidade} onChange={(e) => update("cidade", e.target.value)} />
            </Field>
            <Field label="UF">
              <Input maxLength={2} value={form.uf} onChange={(e) => update("uf", e.target.value.toUpperCase())} />
            </Field>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wide">Dados Bancários</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Banco">
              <Input value={form.banco} onChange={(e) => update("banco", e.target.value)} />
            </Field>
            <Field label="Agência">
              <Input value={form.agencia} onChange={(e) => update("agencia", e.target.value)} />
            </Field>
            <Field label="Conta">
              <Input value={form.conta} onChange={(e) => update("conta", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="p-5 space-y-4 border-violet-200 dark:border-violet-900/40">
          <h3 className="font-semibold text-sm uppercase text-violet-700 dark:text-violet-400 tracking-wide">
            Margem & Limite
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Limite (R$)">
              <Input
                type="number"
                step="0.01"
                value={form.limite}
                onChange={(e) => update("limite", e.target.value)}
              />
            </Field>
            <Field label="Margem Consignável (R$)">
              <Input
                type="number"
                step="0.01"
                value={form.margemConsig}
                onChange={(e) => update("margemConsig", e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/empresa/funcionarios">
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Cadastrar Funcionário
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className={required ? "after:content-['*'] after:text-rose-500 after:ml-0.5" : ""}>
        {label}
      </Label>
      {children}
    </div>
  )
}
