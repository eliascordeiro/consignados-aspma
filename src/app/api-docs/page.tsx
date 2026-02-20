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
        </header>
        <SwaggerUIClient />
      </div>
    </div>
  );
}
