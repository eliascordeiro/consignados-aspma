"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Building2, Users, ShieldCheck, TrendingUp, ArrowRight, CheckCircle2 } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">A.S.P.M.A</h1>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Gestor de Consignados</p>
            </div>
          </div>
          <Link href="/login">
            <Button variant="outline" size="sm" className="border-emerald-200 hover:bg-emerald-50">
              Acessar Sistema
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-full text-sm font-medium">
            <ShieldCheck className="h-4 w-4" />
            Associação dos Servidores Municipais de Araucária
          </div>
          
          <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight">
            Gestão de Margem <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Consignada Inteligente
            </span>
          </h2>
          
          <p className="text-lg lg:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Sistema completo para gerenciamento de crédito consignado para servidores municipais,
            com controle total de margens, convênios e operações.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Link href="/convenio/login">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all w-full sm:w-auto group"
              >
                <Building2 className="mr-2 h-5 w-5" />
                Acesso Convênios
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            
            <Link href="/login">
              <Button 
                size="lg" 
                variant="outline"
                className="border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-400 dark:hover:bg-emerald-950 w-full sm:w-auto group"
              >
                <Users className="mr-2 h-5 w-5" />
                Acesso Sócios
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <Card className="border-emerald-100 dark:border-gray-800 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mb-4">
                <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Gestão de Convênios</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Controle completo de convênios parceiros e suas operações
              </p>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 dark:border-gray-800 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-lg bg-teal-100 dark:bg-teal-950 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Portal do Sócio</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Acompanhamento de margem e consultas online
              </p>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 dark:border-gray-800 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Relatórios Completos</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Análises e relatórios detalhados em tempo real
              </p>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 dark:border-gray-800 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-lg bg-cyan-100 dark:bg-cyan-950 flex items-center justify-center mb-4">
                <ShieldCheck className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Segurança Total</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Dados protegidos com criptografia e auditoria
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <Card className="border-emerald-200 dark:border-gray-800 bg-gradient-to-br from-white to-emerald-50 dark:from-gray-900 dark:to-gray-800">
            <CardContent className="p-8 lg:p-12">
              <div className="grid lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                    Desenvolvido especialmente para
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    A.S.P.M.A - Associação dos Servidores Municipais de Araucária
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Controle preciso de margem consignável
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Interface intuitiva e fácil de usar
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Integração com múltiplos convênios
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Auditoria completa de operações
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <div className="h-48 w-48 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl">
                      <Building2 className="h-24 w-24 text-white" />
                    </div>
                    <div className="absolute -top-4 -right-4 h-24 w-24 bg-emerald-200 dark:bg-emerald-800 rounded-full opacity-50 blur-2xl"></div>
                    <div className="absolute -bottom-4 -left-4 h-24 w-24 bg-teal-200 dark:bg-teal-800 rounded-full opacity-50 blur-2xl"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-2">© 2026 A.S.P.M.A - Associação dos Servidores Municipais de Araucária</p>
            <p>Gestor de Margem Consignada - Todos os direitos reservados</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
