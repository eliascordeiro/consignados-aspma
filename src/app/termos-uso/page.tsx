import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, FileText } from "lucide-react"

export const metadata = {
  title: "Termos de Uso - A.S.P.M.A",
  description: "Termos e Condições de Uso do Sistema de Gestão de Consignados",
}

export default function TermosUsoPage() {
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
              <FileText className="h-8 w-8 text-primary" />
              <CardTitle className="text-3xl">Termos de Uso</CardTitle>
            </div>
            <p className="text-muted-foreground">
              Última atualização: {dataAtualizacao}
            </p>
          </CardHeader>

          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Aceitação dos Termos</h2>
              <p>
                Ao acessar e utilizar o Sistema de Gestão de Consignados da A.S.P.M.A 
                (Associação de Servidores Públicos Municipais e Autárquicos), você concorda 
                em cumprir e estar vinculado aos presentes Termos de Uso.
              </p>
              <p>
                Se você não concordar com qualquer parte destes termos, não deverá utilizar 
                nossos serviços.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Definições</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Plataforma/Sistema:</strong> Sistema online de gestão de consignados da A.S.P.M.A</li>
                <li><strong>Usuário:</strong> Servidor público municipal ou autárquico associado</li>
                <li><strong>Consignado:</strong> Desconto em folha de pagamento autorizado pelo usuário</li>
                <li><strong>Convênios:</strong> Instituições financeiras parceiras</li>
                <li><strong>Margem Consignável:</strong> Limite disponível para descontos em folha</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Descrição dos Serviços</h2>
              <p>A Plataforma oferece os seguintes serviços:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Consulta de margem consignável disponível</li>
                <li>Simulação de operações de empréstimo consignado</li>
                <li>Gestão de consignações ativas (empréstimos, cartões, seguros)</li>
                <li>Consulta de demonstrativos e extratos</li>
                <li>Solicitação de operações junto aos convênios</li>
                <li>Atualização de dados cadastrais</li>
                <li>Acesso a informações sobre benefícios e parcerias</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Cadastro e Conta de Acesso</h2>
              
              <h3 className="text-xl font-medium mb-3">4.1. Requisitos</h3>
              <p>Para utilizar a plataforma, você deve:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Ser servidor público municipal ou autárquico em atividade</li>
                <li>Ser associado à A.S.P.M.A</li>
                <li>Ter 18 anos ou mais</li>
                <li>Fornecer informações verdadeiras e atualizadas</li>
              </ul>

              <h3 className="text-xl font-medium mb-3 mt-4">4.2. Credenciais de Acesso</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Você é responsável pela confidencialidade de sua senha</li>
                <li>Não compartilhe suas credenciais com terceiros</li>
                <li>Notifique imediatamente qualquer uso não autorizado</li>
                <li>A A.S.P.M.A não se responsabiliza por perdas decorrentes de uso não autorizado</li>
              </ul>

              <h3 className="text-xl font-medium mb-3 mt-4">4.3. Suspensão de Conta</h3>
              <p>Reservamo-nos o direito de suspender ou encerrar sua conta em casos de:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Violação destes Termos de Uso</li>
                <li>Uso fraudulento ou ilegal da plataforma</li>
                <li>Fornecimento de informações falsas</li>
                <li>Encerramento do vínculo funcional</li>
                <li>Desassociação da A.S.P.M.A</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Uso Aceitável</h2>
              
              <h3 className="text-xl font-medium mb-3">5.1. Você Concorda em NÃO:</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Utilizar a plataforma para fins ilegais ou não autorizados</li>
                <li>Tentar acessar áreas restritas do sistema</li>
                <li>Interferir ou interromper o funcionamento da plataforma</li>
                <li>Realizar engenharia reversa, descompilar ou desmontar</li>
                <li>Utilizar bots, scrapers ou ferramentas automatizadas</li>
                <li>Transmitir vírus, malware ou código malicioso</li>
                <li>Coletar dados de outros usuários sem autorização</li>
                <li>Fazer uso comercial não autorizado da plataforma</li>
              </ul>

              <h3 className="text-xl font-medium mb-3 mt-4">5.2. Você Deve:</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Manter seus dados cadastrais atualizados</li>
                <li>Utilizar a plataforma de forma responsável</li>
                <li>Respeitar os direitos de outros usuários</li>
                <li>Cumprir todas as leis e regulamentações aplicáveis</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Operações de Consignado</h2>
              
              <h3 className="text-xl font-medium mb-3">6.1. Responsabilidades</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>A A.S.P.M.A atua apenas como gestora dos descontos em folha</li>
                <li>As operações de crédito são de responsabilidade dos convênios</li>
                <li>Você deve ler e compreender os contratos antes de contratar</li>
                <li>A simulação é meramente informativa, valores podem variar</li>
              </ul>

              <h3 className="text-xl font-medium mb-3 mt-4">6.2. Margem Consignável</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Limitada a 35% da remuneração líquida (conforme legislação)</li>
                <li>Pode ser alterada por mudanças salariais ou descontos obrigatórios</li>
                <li>A consulta reflete o momento atual, sujeita a atualizações</li>
              </ul>

              <h3 className="text-xl font-medium mb-3 mt-4">6.3. Autorização de Desconto</h3>
              <p>
                Ao solicitar uma operação, você autoriza expressamente o desconto em folha 
                de pagamento conforme termos do contrato específico com o convênio.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Privacidade e Proteção de Dados</h2>
              <p>
                O tratamento de seus dados pessoais é regido por nossa{' '}
                <Link href="/politica-privacidade" className="text-primary hover:underline">
                  Política de Privacidade
                </Link>, em conformidade com a LGPD (Lei nº 13.709/2018).
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Coletamos apenas dados necessários para os serviços</li>
                <li>Implementamos medidas de segurança adequadas</li>
                <li>Você pode exercer seus direitos conforme LGPD</li>
                <li>Não vendemos ou comercializamos seus dados</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Propriedade Intelectual</h2>
              <p>
                Todo o conteúdo da plataforma (textos, gráficos, logos, ícones, imagens, 
                código-fonte) é propriedade da A.S.P.M.A ou de seus licenciadores e está 
                protegido por leis de propriedade intelectual.
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Você não pode copiar, reproduzir ou distribuir sem autorização</li>
                <li>O uso é permitido apenas para fins pessoais e não comerciais</li>
                <li>Marcas registradas não podem ser utilizadas sem permissão expressa</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Isenção de Garantias</h2>
              <p>
                A plataforma é fornecida "no estado em que se encontra" e "conforme disponível". 
                Não garantimos que:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>O serviço será ininterrupto, seguro ou livre de erros</li>
                <li>Os resultados obtidos serão precisos ou confiáveis em 100% dos casos</li>
                <li>Defeitos serão corrigidos imediatamente</li>
              </ul>
              <p className="mt-2">
                <strong>Manutenções programadas:</strong> Podem ocorrer interrupções para 
                manutenção, que serão comunicadas previamente quando possível.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Limitação de Responsabilidade</h2>
              <p>A A.S.P.M.A não se responsabiliza por:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Danos diretos, indiretos, incidentais ou consequenciais</li>
                <li>Perda de lucros, dados ou oportunidades de negócio</li>
                <li>Erros de terceiros (convênios, bancos, sistemas externos)</li>
                <li>Caso fortuito ou força maior</li>
                <li>Uso inadequado ou não autorizado da plataforma</li>
                <li>Decisões tomadas com base nas informações da plataforma</li>
              </ul>
              <p className="mt-2 font-medium">
                As operações de crédito são de responsabilidade exclusiva dos convênios 
                contratados, cabendo à A.S.P.M.A apenas a gestão dos descontos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Indenização</h2>
              <p>
                Você concorda em indenizar e isentar a A.S.P.M.A, seus diretores, funcionários 
                e parceiros de quaisquer reclamações, danos ou despesas decorrentes de:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Violação destes Termos de Uso</li>
                <li>Violação de direitos de terceiros</li>
                <li>Uso inadequado da plataforma</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">12. Alterações nos Termos</h2>
              <p>
                Reservamo-nos o direito de modificar estes Termos de Uso a qualquer momento. 
                Alterações significativas serão comunicadas através de:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Aviso na plataforma</li>
                <li>E-mail para o endereço cadastrado</li>
                <li>Notificação no próximo acesso</li>
              </ul>
              <p className="mt-2">
                O uso continuado da plataforma após as alterações constitui aceitação 
                dos novos termos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">13. Rescisão</h2>
              
              <h3 className="text-xl font-medium mb-3">13.1. Por Você</h3>
              <p>
                Você pode encerrar sua conta a qualquer momento, entrando em contato com 
                nosso suporte. Obrigações contratuais existentes continuam vigentes.
              </p>

              <h3 className="text-xl font-medium mb-3 mt-4">13.2. Por Nós</h3>
              <p>
                Podemos suspender ou encerrar seu acesso imediatamente, sem aviso prévio, 
                em caso de violação destes termos ou por motivos legais/regulatórios.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">14. Disposições Gerais</h2>
              
              <h3 className="text-xl font-medium mb-3">14.1. Legislação Aplicável</h3>
              <p>
                Estes Termos são regidos pelas leis da República Federativa do Brasil.
              </p>

              <h3 className="text-xl font-medium mb-3 mt-4">14.2. Foro</h3>
              <p>
                Fica eleito o foro da comarca de [Cidade], com exclusão de qualquer outro, 
                por mais privilegiado que seja, para dirimir quaisquer questões oriundas 
                destes Termos.
              </p>

              <h3 className="text-xl font-medium mb-3 mt-4">14.3. Independência das Cláusulas</h3>
              <p>
                Se qualquer disposição destes Termos for considerada inválida ou inexequível, 
                as demais disposições permanecerão em pleno vigor e efeito.
              </p>

              <h3 className="text-xl font-medium mb-3 mt-4">14.4. Acordo Integral</h3>
              <p>
                Estes Termos constituem o acordo integral entre você e a A.S.P.M.A 
                relativamente ao uso da plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">15. Contato</h2>
              <p>Para dúvidas, sugestões ou reclamações sobre estes Termos:</p>
              <div className="bg-muted p-4 rounded-lg mt-2">
                <p><strong>A.S.P.M.A</strong></p>
                <p><strong>E-mail:</strong> contato@aspma.org.br</p>
                <p><strong>Telefone:</strong> [Telefone]</p>
                <p><strong>Endereço:</strong> [Endereço completo]</p>
                <p><strong>Horário de Atendimento:</strong> Segunda a Sexta, 8h às 18h</p>
              </div>
            </section>

            <div className="mt-8 pt-6 border-t">
              <p className="text-sm text-muted-foreground text-center">
                Ao utilizar esta plataforma, você declara ter lido, compreendido e 
                concordado com todos os termos e condições aqui estabelecidos.
              </p>
              <p className="text-sm text-muted-foreground text-center mt-2">
                Data de vigência: {dataAtualizacao}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
