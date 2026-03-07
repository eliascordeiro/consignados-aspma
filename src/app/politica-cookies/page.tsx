import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Cookie } from "lucide-react"

export const metadata = {
  title: "Política de Cookies - A.S.P.M.A",
  description: "Como utilizamos cookies e tecnologias similares",
}

export default function PoliticaCookiesPage() {
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
              <Cookie className="h-8 w-8 text-primary" />
              <CardTitle className="text-3xl">Política de Cookies</CardTitle>
            </div>
            <p className="text-muted-foreground">
              Última atualização: {dataAtualizacao}
            </p>
          </CardHeader>

          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. O que são Cookies?</h2>
              <p>
                Cookies são pequenos arquivos de texto armazenados no seu navegador quando 
                você visita um site. Eles permitem que o site "lembre" de suas ações e 
                preferências ao longo do tempo, melhorando sua experiência de navegação.
              </p>
              <p>
                Os cookies podem ser classificados como:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Cookies de Sessão:</strong> Temporários, apagados ao fechar o navegador</li>
                <li><strong>Cookies Persistentes:</strong> Permanecem no dispositivo por período definido</li>
                <li><strong>Cookies Próprios:</strong> Definidos por este site</li>
                <li><strong>Cookies de Terceiros:</strong> Definidos por serviços externos (ex: analytics)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Como Utilizamos Cookies</h2>
              <p>
                Utilizamos cookies e tecnologias similares para diversos fins, sempre 
                respeitando sua privacidade e em conformidade com a LGPD.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Tipos de Cookies Utilizados</h2>

              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg mb-4">
                <h3 className="text-xl font-medium mb-3">3.1. Cookies Estritamente Necessários ✅</h3>
                <p className="mb-2">
                  <strong>Obrigatórios para o funcionamento do site. Não podem ser desativados.</strong>
                </p>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li><strong>Autenticação:</strong> Mantêm você logado durante a navegação</li>
                  <li><strong>Segurança:</strong> Proteção contra CSRF e outras ameaças</li>
                  <li><strong>Sessão:</strong> Armazenam preferências da sessão atual</li>
                  <li><strong>Load Balancing:</strong> Distribuem requisições entre servidores</li>
                </ul>
                <p className="text-xs mt-2 text-muted-foreground">
                  <strong>Exemplos:</strong> next-auth.session-token, next-auth.csrf-token, cookie-consent
                </p>
                <p className="text-xs mt-1 text-muted-foreground">
                  <strong>Validade:</strong> Sessão ou até 30 dias
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg mb-4">
                <h3 className="text-xl font-medium mb-3">3.2. Cookies Analíticos 📊</h3>
                <p className="mb-2">
                  <strong>Ajudam-nos a entender como os visitantes usam o site.</strong>
                </p>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>Páginas mais visitadas</li>
                  <li>Tempo de permanência no site</li>
                  <li>Origem do tráfego (como você chegou aqui)</li>
                  <li>Taxa de rejeição e navegação</li>
                  <li>Resolução de tela e dispositivo usado</li>
                </ul>
                <p className="text-xs mt-2 text-muted-foreground">
                  <strong>Exemplos:</strong> _ga (Google Analytics), _gid, _gat
                </p>
                <p className="text-xs mt-1 text-muted-foreground">
                  <strong>Validade:</strong> Até 2 anos
                </p>
                <p className="text-xs mt-1 text-muted-foreground">
                  <strong>Finalidade:</strong> Melhorar a experiência do usuário e otimizar o site
                </p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                <h3 className="text-xl font-medium mb-3">3.3. Cookies de Marketing 📢</h3>
                <p className="mb-2">
                  <strong>Utilizados para publicidade e remarketing direcionado.</strong>
                </p>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>Rastreamento de visitantes entre sites</li>
                  <li>Exibição de anúncios personalizados</li>
                  <li>Medição de eficácia de campanhas</li>
                  <li>Remarketing (anúncios para quem já visitou)</li>
                </ul>
                <p className="text-xs mt-2 text-muted-foreground">
                  <strong>Exemplos:</strong> _fbp (Facebook Pixel), IDE (Google Ads)
                </p>
                <p className="text-xs mt-1 text-muted-foreground">
                  <strong>Validade:</strong> Até 90 dias
                </p>
                <p className="text-xs mt-1 text-muted-foreground">
                  <strong>Finalidade:</strong> Publicidade relevante e análise de conversões
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Tecnologias Similares</h2>
              <p>Além de cookies, também utilizamos:</p>
              
              <h3 className="text-xl font-medium mb-3 mt-4">4.1. Local Storage</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Armazena preferências do usuário (tema: claro/escuro)</li>
                <li>Cache de dados para melhor desempenho</li>
                <li>Não expira automaticamente</li>
              </ul>

              <h3 className="text-xl font-medium mb-3 mt-4">4.2. Session Storage</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Dados temporários da sessão</li>
                <li>Apagado ao fechar a aba/navegador</li>
              </ul>

              <h3 className="text-xl font-medium mb-3 mt-4">4.3. Pixels de Rastreamento</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Imagens invisíveis para análise de comportamento</li>
                <li>Medição de abertura de e-mails</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Cookies de Terceiros</h2>
              <p>Alguns cookies são definidos por serviços de terceiros que aparecem em nossas páginas:</p>
              
              <div className="space-y-3 mt-3">
                <div className="bg-muted p-3 rounded">
                  <p className="font-medium">Google Analytics</p>
                  <p className="text-sm text-muted-foreground">Análise de tráfego e comportamento</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Política: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      policies.google.com/privacy
                    </a>
                  </p>
                </div>

                <div className="bg-muted p-3 rounded">
                  <p className="font-medium">Facebook Pixel</p>
                  <p className="text-sm text-muted-foreground">Remarketing e conversões</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Política: <a href="https://www.facebook.com/privacy/explanation" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      facebook.com/privacy
                    </a>
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Gestão de Cookies</h2>
              
              <h3 className="text-xl font-medium mb-3">6.1. Através do Nosso Banner</h3>
              <p>
                Na primeira visita, você verá um banner de cookies onde pode:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Aceitar Todos:</strong> Permite cookies necessários, analíticos e marketing</li>
                <li><strong>Apenas Necessários:</strong> Apenas cookies essenciais</li>
                <li><strong>Personalizar:</strong> Escolher categorias específicas</li>
              </ul>
              <p className="mt-2">
                Você pode alterar suas preferências a qualquer momento nas configurações 
                de cookies (botão "Gerenciar Cookies" no rodapé).
              </p>

              <h3 className="text-xl font-medium mb-3 mt-4">6.2. Através do Navegador</h3>
              <p>Você também pode gerenciar cookies diretamente no navegador:</p>
              
              <div className="bg-muted p-4 rounded-lg mt-2 space-y-2">
                <p><strong>Chrome:</strong> Configurações → Privacidade e Segurança → Cookies</p>
                <p><strong>Firefox:</strong> Opções → Privacidade e Segurança → Cookies</p>
                <p><strong>Safari:</strong> Preferências → Privacidade → Cookies</p>
                <p><strong>Edge:</strong> Configurações → Privacidade → Cookies</p>
              </div>

              <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
                ⚠️ <strong>Atenção:</strong> Bloquear cookies necessários pode impedir o funcionamento 
                correto do site (ex: impossibilidade de fazer login).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Do Not Track (DNT)</h2>
              <p>
                Alguns navegadores possuem a opção "Não Rastrear" (Do Not Track). 
                Atualmente, não há padrão universal sobre como responder a esses 
                sinais, mas respeitamos as escolhas feitas através do nosso banner 
                de cookies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Cookies e LGPD</h2>
              <p>
                Em conformidade com a LGPD (Lei Geral de Proteção de Dados - Lei nº 13.709/2018):
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>✅ Solicitamos consentimento antes de usar cookies não essenciais</li>
                <li>✅ Você pode revogar o consentimento a qualquer momento</li>
                <li>✅ Fornecemos informações claras sobre cada tipo de cookie</li>
                <li>✅ Cookies essenciais são baseados em legítimo interesse</li>
                <li>✅ Você tem direito de acessar, corrigir ou excluir seus dados</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Atualizações desta Política</h2>
              <p>
                Esta Política de Cookies pode ser atualizada periodicamente para refletir 
                mudanças em nossas práticas ou legislação. Alterações significativas serão 
                comunicadas através de aviso no site.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Contato</h2>
              <p>
                Para dúvidas sobre cookies ou exercício de direitos LGPD:
              </p>
              <div className="bg-muted p-4 rounded-lg mt-2">
                <p><strong>E-mail:</strong> privacidade@aspma.org.br</p>
                <p><strong>Encarregado de Dados (DPO):</strong> [Nome]</p>
                <p><strong>Telefone:</strong> [Telefone]</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Links Úteis</h2>
              <div className="space-y-2">
                <p>
                  <Link href="/politica-privacidade" className="text-primary hover:underline">
                    🔒 Política de Privacidade
                  </Link>
                </p>
                <p>
                  <Link href="/termos-uso" className="text-primary hover:underline">
                    📄 Termos de Uso
                  </Link>
                </p>
                <p>
                  <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    🏛️ ANPD - Autoridade Nacional de Proteção de Dados
                  </a>
                </p>
              </div>
            </section>

            <div className="mt-8 pt-6 border-t">
              <p className="text-sm text-muted-foreground text-center">
                Ao continuar navegando, você concorda com o uso de cookies conforme 
                descrito nesta política.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
