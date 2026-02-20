import SwaggerUIClient from '@/components/SwaggerUIClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Documentation - Sistema de Consignados',
  description: 'Documentação completa da API do Sistema de Consignados usando Swagger/OpenAPI',
};

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto">
        <header className="py-6 border-b">
          <h1 className="text-3xl font-bold text-gray-900">
            Documentação da API - Sistema de Consignados
          </h1>
          <p className="mt-2 text-gray-600">
            Explore e teste todos os endpoints disponíveis da API
          </p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>🔐 Autenticação:</strong> Para testar endpoints protegidos, primeiro faça login usando o endpoint{' '}
              <code className="bg-blue-100 px-2 py-1 rounded">/api/convenio/auth/login</code>.
              Os cookies de sessão serão armazenados automaticamente.
            </p>
          </div>
          <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 mb-2">
              <strong>🧪 Dados de Teste:</strong> Use as credenciais abaixo para testar a API:
            </p>
            <ul className="text-sm text-green-700 ml-4 space-y-1">
              <li>• <strong>Login:</strong> usuário <code className="bg-green-100 px-1 rounded">teste</code> / senha <code className="bg-green-100 px-1 rounded">teste123</code></li>
              <li>• <strong>Matrículas:</strong> 999001, 999002, 999003</li>
              <li>• <strong>CPFs:</strong> 111.111.111-11, 222.222.222-22, 333.333.333-33</li>
            </ul>
            <p className="text-xs text-green-600 mt-2">
              📖 Ver <a href="/SWAGGER_TEST_GUIDE.md" className="underline font-medium">SWAGGER_TEST_GUIDE.md</a> para instruções detalhadas
            </p>
          </div>
        </header>
        <SwaggerUIClient />
      </div>
    </div>
  );
}
