'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Carrega o SwaggerUI dinamicamente apenas no client-side
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function SwaggerUIClient() {
  const [spec, setSpec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Busca a especificação OpenAPI do endpoint
    fetch('/api/docs', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setSpec(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Erro ao carregar especificação da API:', error);
        setError(error.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando documentação da API...</p>
        </div>
      </div>
    );
  }

  if (!spec || error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-2">Erro ao carregar a documentação da API.</p>
          {error && <p className="text-gray-600 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="swagger-ui-container">
      <SwaggerUI 
        spec={spec}
        supportedSubmitMethods={['get', 'post', 'put', 'delete', 'patch']}
        tryItOutEnabled={true}
        displayRequestDuration={true}
        docExpansion="list"
        defaultModelsExpandDepth={1}
        filter={true}
        persistAuthorization={true}
        withCredentials={true}
        requestInterceptor={(req: any) => {
          // Garante que cookies sejam enviados com as requisições
          req.credentials = 'include';
          return req;
        }}
      />
    </div>
  );
}
