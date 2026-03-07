import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Shield } from "lucide-react"

export const metadata = {
  title: "Política de Privacidade - A.S.P.M.A",
  description: "Política de Privacidade e Proteção de Dados conforme LGPD",
}

export default function PoliticaPrivacidadePage() {
  const dataAtualizacao = "7 de março de 2026"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="space-y-4 pb-8">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <CardTitle className="text-3xl">Política de Privacidade</CardTitle>
            </div>
            <p className="text-muted-foreground">
              Última atualização: {dataAtualizacao}
            </p>
          </CardHeader>

          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Introdução</h2>
              <p>
                A A.S.P.M.A (Associação de Servidores Públicos Municipais e Autárquicos) 
                está comprometida com a proteção da privacidade e dos dados pessoais de seus 
                usuários, em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong>.
              </p>
              <p>
                Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e 
                protegemos suas informações pessoais ao utilizar nosso sistema de gestão de 
                consignados.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Responsável pelo Tratamento de Dados</h2>
              <div className="bg-muted p-4 rounded-lg">
                <p><strong>Razão Social:</strong> A.S.P.M.A</p>
                <p><strong>Encarregado de Dados (DPO):</strong> [Nome do DPO]</p>
                <p><strong>E-mail para Contato:</strong> privacidade@aspma.org.br</p>
                <p><strong>Telefone:</strong> [Telefone de contato]</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Dados Coletados</h2>
              
              <h3 className="text-xl font-medium mb-3">3.1. Dados Pessoais</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Dados de Identificação:</strong> Nome completo, CPF, RG, data de nascimento</li>
                <li><strong>Dados de Contato:</strong> E-mail, telefone, celular, endereço</li>
                <li><strong>Dados Funcionais:</strong> Matrícula, cargo, lotação, salário, margem consignável</li>
                <li><strong>Dados Bancários:</strong> Banco, agência, conta (para operações de consignado)</li>
                <li><strong>Dados de Acesso:</strong> Usuário, senha (criptografada), IP, data/hora de acesso</li>
              </ul>

              <h3 className="text-xl font-medium mb-3 mt-4">3.2. Dados Sensíveis</h3>
              <p>
                Não coletamos dados sensíveis conforme definição da LGPD (origem racial, 
                convicções religiosas, opiniões políticas, dados de saúde, etc.), exceto 
                quando estritamente necessário e com consentimento explícito.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Finalidade do Tratamento</h2>
              <p>Seus dados são utilizados para:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Gestão de descontos em folha de pagamento (consignados)</li>
                <li>Consulta de margem consignável</li>
                <li>Processamento de operações de empréstimo e cartão consignado</li>
                <li>Emissão de relatórios e demonstrativos</li>
                <li>Comunicação sobre operações e alterações contratuais</li>
                <li>Cumprimento de obrigações legais e regulatórias</li>
                <li>Melhoria da experiência do usuário na plataforma</li>
                <li>Segurança e prevenção de fraudes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Base Legal para Tratamento</h2>
              <p>O tratamento de dados é realizado com base nas seguintes hipóteses legais da LGPD:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Execução de contrato (Art. 7º, V):</strong> Necessário para gestão de consignados</li>
                <li><strong>Cumprimento de obrigação legal (Art. 7º, II):</strong> Legislação trabalhista e previdenciária</li>
                <li><strong>Legítimo interesse (Art. 7º, IX):</strong> Segurança, prevenção de fraudes</li>
                <li><strong>Consentimento (Art. 7º, I):</strong> Quando aplicável, com possibilidade de revogação</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Compartilhamento de Dados</h2>
              <p>Seus dados podem ser compartilhados com:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Instituições Financeiras:</strong> Para processamento de operações de consignado</li>
                <li><strong>Órgãos Públicos:</strong> Prefeituras, autarquias (para validação de margem)</li>
                <li><strong>Prestadores de Serviço:</strong> Infraestrutura de TI, segurança, processamento de dados</li>
                <li><strong>Autoridades:</strong> Quando exigido por lei ou ordem judicial</li>
              </ul>
              <p className="mt-2">
                <strong>Importante:</strong> Não vendemos, alugamos ou comercializamos seus dados pessoais.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Armazenamento e Segurança</h2>
              
              <h3 className="text-xl font-medium mb-3">7.1. Medidas de Segurança</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Criptografia de dados em trânsito (HTTPS/TLS)</li>
                <li>Criptografia de senhas (bcrypt)</li>
                <li>Controle de acesso baseado em perfis e permissões</li>
                <li>Logs de auditoria de todas as operações</li>
                <li>Backups regulares e redundância de dados</li>
                <li>Firewall e monitoramento de segurança 24/7</li>
              </ul>

              <h3 className="text-xl font-medium mb-3 mt-4">7.2. Retenção de Dados</h3>
              <p>
                Os dados são armazenados pelo período necessário para cumprimento das 
                finalidades descritas ou conforme exigido por lei (geralmente 5 anos 
                após o término do vínculo, conforme legislação trabalhista).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Seus Direitos (LGPD)</h2>
              <p>Você tem os seguintes direitos garantidos pela LGPD:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Confirmação e Acesso:</strong> Saber se tratamos seus dados e acessá-los</li>
                <li><strong>Correção:</strong> Solicitar correção de dados incompletos ou incorretos</li>
                <li><strong>Anonimização ou Bloqueio:</strong> De dados desnecessários ou excessivos</li>
                <li><strong>Eliminação:</strong> De dados tratados com consentimento (após análise legal)</li>
                <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
                <li><strong>Informação sobre Compartilhamento:</strong> Com quem compartilhamos</li>
                <li><strong>Revogação de Consentimento:</strong> Quando aplicável</li>
                <li><strong>Oposição:</strong> Ao tratamento em situações específicas</li>
              </ul>
              <p className="mt-4">
                <strong>Como exercer seus direitos:</strong> Entre em contato através do e-mail 
                privacidade@aspma.org.br ou pelo telefone [telefone].
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Cookies e Tecnologias</h2>
              <p>
                Utilizamos cookies e tecnologias similares para melhorar sua experiência. 
                Consulte nossa <Link href="/politica-cookies" className="text-primary hover:underline">
                Política de Cookies</Link> para mais informações.
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Cookies Necessários:</strong> Autenticação, segurança (sempre ativos)</li>
                <li><strong>Cookies Analíticos:</strong> Métricas de uso (opcional)</li>
                <li><strong>Cookies de Marketing:</strong> Publicidade (opcional)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Transferência Internacional</h2>
              <p>
                Seus dados são armazenados em servidores localizados no Brasil. Caso haja 
                necessidade de transferência internacional, será realizada apenas com países 
                ou organizações que garantam grau adequado de proteção de dados.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Menores de Idade</h2>
              <p>
                Nossa plataforma não é direcionada a menores de 18 anos. Não coletamos 
                intencionalmente dados de menores sem autorização dos responsáveis legais.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">12. Alterações nesta Política</h2>
              <p>
                Esta Política pode ser atualizada periodicamente. Alterações significativas 
                serão comunicadas através do e-mail cadastrado ou aviso no sistema. A data 
                da última atualização está sempre indicada no início deste documento.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">13. Reclamações e ANPD</h2>
              <p>
                Se você acredita que seus direitos não foram respeitados, pode apresentar 
                reclamação à <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>:
              </p>
              <div className="bg-muted p-4 rounded-lg mt-2">
                <p><strong>ANPD:</strong> <a href="https://www.gov.br/anpd" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">www.gov.br/anpd</a></p>
                <p><strong>Ouvidoria:</strong> Através do site oficial da ANPD</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">14. Contato</h2>
              <p>Para dúvidas, solicitações ou exercício de direitos:</p>
              <div className="bg-muted p-4 rounded-lg mt-2">
                <p><strong>E-mail:</strong> privacidade@aspma.org.br</p>
                <p><strong>Telefone:</strong> [Telefone]</p>
                <p><strong>Endereço:</strong> [Endereço completo da A.S.P.M.A]</p>
              </div>
            </section>

            <div className="mt-8 pt-6 border-t">
              <p className="text-sm text-muted-foreground text-center">
                Ao utilizar nossos serviços, você declara ter lido e compreendido esta 
                Política de Privacidade e concorda com os termos aqui estabelecidos.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
