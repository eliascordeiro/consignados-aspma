"use client"

import { useState, use as usePromise } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  User,
  Wallet,
  Lock,
  Unlock,
  History,
  Save,
  Loader2,
  AlertCircle,
  Briefcase,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"

type Tab = "cadastro" | "margem" | "bloqueio" | "historico"

interface SocioDetail {
  id: string
  nome: string
  cpf: string | null
  rg: string | null
  matricula: string | null
  funcao: string | null
  lotacao: string | null
  endereco: string | null
  bairro: string | null
  cep: string | null
  cidade: string | null
  uf: string | null
  telefone: string | null
  celular: string | null
  email: string | null
  dataAdmissao: string | null
  dataNascimento: string | null
  sexo: string | null
  estadoCivil: string | null
  banco: string | null
  agencia: string | null
  conta: string | null
  limite: number | null
  margemConsig: number | null
  ativo: boolean
  bloqueio: string | null
  motivoBloqueio: string | null
  empresa: { nome: string } | null
  _count: { vendas: number; margemHistoricos: number }
}

interface MargemHist {
  id: string
  createdAt: string
  limiteAnterior: number | null
  limiteNovo: number | null
  margemAnterior: number | null
  margemNova: number | null
  motivo: string | null
  observacao: string | null
  usuario: string | null
}

export default function SocioDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(props.params)
  const [tab, setTab] = useState<Tab>("cadastro")

  const { data: socio, isLoading, refetch } = useQuery<SocioDetail>({
    queryKey: ["empresa-socio", id],
    queryFn: async () => {
      const r = await fetch(`/api/empresa/socios/${id}`)
      if (!r.ok) throw new Error("Erro ao carregar")
      return r.json()
    },
  })

  if (isLoading || !socio) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link
        href="/empresa/funcionarios"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar à lista
      </Link>

      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
            {socio.nome.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{socio.nome}</h2>
            <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-1">
              {socio.cpf && <span>CPF: {formatCpf(socio.cpf)}</span>}
              {socio.matricula && <span>Matrícula: {socio.matricula}</span>}
              {socio.funcao && (
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {socio.funcao}
                </span>
              )}
            </div>
          </div>
          <StatusBadge socio={socio} />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t">
          <Stat label="Limite" value={formatCurrency(socio.limite || 0)} />
          <Stat label="Margem" value={formatCurrency(socio.margemConsig || 0)} highlight />
          <Stat label="Vendas" value={String(socio._count.vendas)} />
        </div>
      </Card>

      <div className="border-b flex flex-wrap gap-1">
        <TabBtn active={tab === "cadastro"} onClick={() => setTab("cadastro")} icon={User}>
          Cadastro
        </TabBtn>
        <TabBtn active={tab === "margem"} onClick={() => setTab("margem")} icon={Wallet}>
          Margem & Limite
        </TabBtn>
        <TabBtn active={tab === "bloqueio"} onClick={() => setTab("bloqueio")} icon={Lock}>
          Bloqueio
        </TabBtn>
        <TabBtn active={tab === "historico"} onClick={() => setTab("historico")} icon={History}>
          Histórico de Margem
        </TabBtn>
      </div>

      {tab === "cadastro" && <CadastroTab socio={socio} onSaved={refetch} />}
      {tab === "margem" && <MargemTab socio={socio} onSaved={refetch} />}
      {tab === "bloqueio" && <BloqueioTab socio={socio} onSaved={refetch} />}
      {tab === "historico" && <HistoricoTab socioId={socio.id} />}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────

function CadastroTab({ socio, onSaved }: { socio: SocioDetail; onSaved: () => void }) {
  const [form, setForm] = useState({
    nome: socio.nome || "",
    rg: socio.rg || "",
    matricula: socio.matricula || "",
    funcao: socio.funcao || "",
    lotacao: socio.lotacao || "",
    sexo: socio.sexo || "",
    estadoCivil: socio.estadoCivil || "",
    dataNascimento: socio.dataNascimento ? socio.dataNascimento.slice(0, 10) : "",
    dataAdmissao: socio.dataAdmissao ? socio.dataAdmissao.slice(0, 10) : "",
    celular: socio.celular || "",
    telefone: socio.telefone || "",
    email: socio.email || "",
    cep: socio.cep || "",
    endereco: socio.endereco || "",
    bairro: socio.bairro || "",
    cidade: socio.cidade || "",
    uf: socio.uf || "",
    banco: socio.banco || "",
    agencia: socio.agencia || "",
    conta: socio.conta || "",
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  function up<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    const res = await fetch(`/api/empresa/socios/${socio.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setMsg({ type: "err", text: d.error || "Erro ao salvar" })
      return
    }
    setMsg({ type: "ok", text: "Dados atualizados com sucesso." })
    onSaved()
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {msg && <Alert type={msg.type} text={msg.text} />}

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wide">Dados Pessoais</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome">
            <Input value={form.nome} onChange={(e) => up("nome", e.target.value)} />
          </Field>
          <Field label="RG">
            <Input value={form.rg} onChange={(e) => up("rg", e.target.value)} />
          </Field>
          <Field label="Matrícula">
            <Input value={form.matricula} onChange={(e) => up("matricula", e.target.value)} />
          </Field>
          <Field label="Data de Nascimento">
            <Input type="date" value={form.dataNascimento} onChange={(e) => up("dataNascimento", e.target.value)} />
          </Field>
          <Field label="Sexo">
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              value={form.sexo}
              onChange={(e) => up("sexo", e.target.value)}
            >
              <option value="">—</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </Field>
          <Field label="Estado Civil">
            <Input value={form.estadoCivil} onChange={(e) => up("estadoCivil", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wide">Vínculo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Função">
            <Input value={form.funcao} onChange={(e) => up("funcao", e.target.value)} />
          </Field>
          <Field label="Lotação">
            <Input value={form.lotacao} onChange={(e) => up("lotacao", e.target.value)} />
          </Field>
          <Field label="Data de Admissão">
            <Input type="date" value={form.dataAdmissao} onChange={(e) => up("dataAdmissao", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wide">Contato & Endereço</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Celular">
            <Input value={form.celular} onChange={(e) => up("celular", e.target.value)} />
          </Field>
          <Field label="Telefone">
            <Input value={form.telefone} onChange={(e) => up("telefone", e.target.value)} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.email} onChange={(e) => up("email", e.target.value)} />
          </Field>
          <Field label="CEP">
            <Input value={form.cep} onChange={(e) => up("cep", e.target.value)} />
          </Field>
          <Field label="Endereço">
            <Input value={form.endereco} onChange={(e) => up("endereco", e.target.value)} />
          </Field>
          <Field label="Bairro">
            <Input value={form.bairro} onChange={(e) => up("bairro", e.target.value)} />
          </Field>
          <Field label="Cidade">
            <Input value={form.cidade} onChange={(e) => up("cidade", e.target.value)} />
          </Field>
          <Field label="UF">
            <Input maxLength={2} value={form.uf} onChange={(e) => up("uf", e.target.value.toUpperCase())} />
          </Field>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wide">Dados Bancários</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Banco">
            <Input value={form.banco} onChange={(e) => up("banco", e.target.value)} />
          </Field>
          <Field label="Agência">
            <Input value={form.agencia} onChange={(e) => up("agencia", e.target.value)} />
          </Field>
          <Field label="Conta">
            <Input value={form.conta} onChange={(e) => up("conta", e.target.value)} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Alterações
        </Button>
      </div>
    </form>
  )
}

function MargemTab({ socio, onSaved }: { socio: SocioDetail; onSaved: () => void }) {
  const qc = useQueryClient()
  const [limite, setLimite] = useState(String(socio.limite || ""))
  const [margem, setMargem] = useState(String(socio.margemConsig || ""))
  const [motivo, setMotivo] = useState("")
  const [obs, setObs] = useState("")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!motivo.trim()) {
      setMsg({ type: "err", text: "Informe o motivo da alteração." })
      return
    }
    setSaving(true)
    setMsg(null)
    const res = await fetch(`/api/empresa/socios/${socio.id}/margem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        limite: limite === "" ? undefined : parseFloat(limite),
        margemConsig: margem === "" ? undefined : parseFloat(margem),
        motivo,
        observacao: obs,
      }),
    })
    setSaving(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg({ type: "err", text: d.error || "Erro ao salvar" })
      return
    }
    setMsg({ type: "ok", text: "Margem atualizada com sucesso." })
    setMotivo("")
    setObs("")
    onSaved()
    qc.invalidateQueries({ queryKey: ["empresa-margem-historico", socio.id] })
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {msg && <Alert type={msg.type} text={msg.text} />}
      <Card className="p-5 space-y-4 border-violet-200 dark:border-violet-900/40">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-violet-600" />
          <h3 className="font-semibold">Ajustar Margem & Limite</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Os valores atuais estão preenchidos abaixo. Toda alteração é registrada no histórico.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Limite (R$)">
            <Input
              type="number"
              step="0.01"
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
            />
          </Field>
          <Field label="Margem Consignável (R$)">
            <Input
              type="number"
              step="0.01"
              value={margem}
              onChange={(e) => setMargem(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Motivo *" required>
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: Aumento salarial, ajuste anual..."
            required
          />
        </Field>
        <Field label="Observação (opcional)">
          <textarea
            className="w-full min-h-[70px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar e Registrar
          </Button>
        </div>
      </Card>
    </form>
  )
}

function BloqueioTab({ socio, onSaved }: { socio: SocioDetail; onSaved: () => void }) {
  const isBloqueado = !!socio.bloqueio
  const [motivo, setMotivo] = useState(socio.motivoBloqueio || "")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  async function toggle(bloquear: boolean) {
    if (bloquear && !motivo.trim()) {
      setMsg({ type: "err", text: "Informe o motivo do bloqueio." })
      return
    }
    if (!bloquear && !confirm("Deseja realmente desbloquear este funcionário?")) return
    setSaving(true)
    setMsg(null)
    const res = await fetch(`/api/empresa/socios/${socio.id}/bloqueio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bloquear, motivo }),
    })
    setSaving(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg({ type: "err", text: d.error || "Erro" })
      return
    }
    setMsg({
      type: "ok",
      text: bloquear ? "Funcionário bloqueado." : "Funcionário desbloqueado.",
    })
    onSaved()
  }

  return (
    <div className="space-y-4">
      {msg && <Alert type={msg.type} text={msg.text} />}
      <Card
        className={
          "p-5 space-y-4 " +
          (isBloqueado
            ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20"
            : "")
        }
      >
        <div className="flex items-center gap-2">
          {isBloqueado ? (
            <Lock className="h-5 w-5 text-amber-600" />
          ) : (
            <Unlock className="h-5 w-5 text-emerald-600" />
          )}
          <h3 className="font-semibold">
            Status atual: {isBloqueado ? "Bloqueado" : "Liberado"}
          </h3>
        </div>

        {isBloqueado ? (
          <>
            <p className="text-sm">
              <strong>Motivo registrado:</strong>{" "}
              <span className="text-muted-foreground">{socio.motivoBloqueio || "—"}</span>
            </p>
            <Button
              type="button"
              onClick={() => toggle(false)}
              disabled={saving}
              variant="outline"
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Unlock className="h-4 w-4 mr-2" />}
              Desbloquear Funcionário
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Ao bloquear, o funcionário não poderá realizar novas vendas, mas as parcelas em andamento seguem
              normalmente.
            </p>
            <Field label="Motivo do bloqueio *" required>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: Demissão, exoneração, solicitação do funcionário..."
              />
            </Field>
            <Button
              type="button"
              onClick={() => toggle(true)}
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
              Bloquear Funcionário
            </Button>
          </>
        )}
      </Card>
    </div>
  )
}

function HistoricoTab({ socioId }: { socioId: string }) {
  const { data, isLoading } = useQuery<MargemHist[]>({
    queryKey: ["empresa-margem-historico", socioId],
    queryFn: async () => {
      const r = await fetch(`/api/empresa/socios/${socioId}/margem`)
      if (!r.ok) throw new Error("erro")
      return r.json()
    },
  })

  if (isLoading) {
    return (
      <Card className="p-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-violet-500" />
      </Card>
    )
  }
  if (!data || data.length === 0) {
    return (
      <Card className="p-12 text-center text-muted-foreground">
        <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
        Nenhuma alteração registrada.
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {data.map((h) => (
        <Card key={h.id} className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <div className="text-sm">
              <span className="font-medium">{h.motivo || "Alteração"}</span>
              {h.usuario && <span className="text-muted-foreground"> · por {h.usuario}</span>}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(h.createdAt).toLocaleString("pt-BR")}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Limite</div>
              <div>
                <span className="text-muted-foreground line-through">
                  {formatCurrency(h.limiteAnterior || 0)}
                </span>
                {" → "}
                <span className="font-medium">{formatCurrency(h.limiteNovo || 0)}</span>
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Margem</div>
              <div>
                <span className="text-muted-foreground line-through">
                  {formatCurrency(h.margemAnterior || 0)}
                </span>
                {" → "}
                <span className="font-medium text-violet-700 dark:text-violet-300">
                  {formatCurrency(h.margemNova || 0)}
                </span>
              </div>
            </div>
          </div>
          {h.observacao && (
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">{h.observacao}</p>
          )}
        </Card>
      ))}
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────

function StatusBadge({ socio }: { socio: SocioDetail }) {
  if (!socio.ativo) {
    return (
      <span className="px-3 py-1 rounded-full text-xs bg-rose-500/10 text-rose-700 dark:text-rose-400">
        Inativo
      </span>
    )
  }
  if (socio.bloqueio) {
    return (
      <span className="px-3 py-1 rounded-full text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400">
        Bloqueado
      </span>
    )
  }
  return (
    <span className="px-3 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
      Ativo
    </span>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div
        className={
          "font-bold mt-0.5 " +
          (highlight ? "text-violet-700 dark:text-violet-300" : "")
        }
      >
        {value}
      </div>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-4 py-2 text-sm flex items-center gap-2 border-b-2 transition-colors -mb-px " +
        (active
          ? "border-violet-500 text-violet-700 dark:text-violet-300 font-medium"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted")
      }
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
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

function Alert({ type, text }: { type: "ok" | "err"; text: string }) {
  return (
    <div
      className={
        "rounded-md border px-4 py-3 text-sm flex items-start gap-2 " +
        (type === "ok"
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/60"
          : "border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/60")
      }
    >
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  )
}

function formatCpf(cpf: string) {
  const c = cpf.replace(/\D/g, "")
  if (c.length !== 11) return cpf
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`
}
