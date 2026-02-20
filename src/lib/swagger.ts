import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sistema de Consignados - API',
      version: '1.0.0',
      description: `Documentação completa da API do Sistema de Consignados

## Autenticação

Esta API utiliza autenticação baseada em **sessão via cookies**. Para testar os endpoints:

1. Faça login na aplicação através de: \`/convenio/auth/login\`
2. O cookie de sessão será armazenado automaticamente
3. As requisições subsequentes usarão esse cookie

**Nota:** Endpoints que requerem autenticação retornarão erro 401 se não estiver logado.`,
      contact: {
        name: 'Equipe de Desenvolvimento',
        email: 'suporte@consignados.com.br',
      },
    },
    servers: [
      {
        url: '/',
        description: 'API do Sistema',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'authjs.session-token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Mensagem de erro',
            },
          },
        },
        Funcionario: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID do funcionário',
            },
            nome: {
              type: 'string',
              description: 'Nome do funcionário',
            },
            cpf: {
              type: 'string',
              description: 'CPF do funcionário',
            },
            dataNascimento: {
              type: 'string',
              format: 'date',
              description: 'Data de nascimento',
            },
            cargo: {
              type: 'string',
              description: 'Cargo do funcionário',
            },
            salario: {
              type: 'number',
              format: 'float',
              description: 'Salário do funcionário',
            },
          },
        },
        Socio: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID do sócio',
            },
            nome: {
              type: 'string',
              description: 'Nome do sócio',
            },
            cpf: {
              type: 'string',
              description: 'CPF do sócio',
            },
            matricula: {
              type: 'string',
              description: 'Matrícula do sócio',
            },
            limiteCredito: {
              type: 'number',
              format: 'float',
              description: 'Limite de crédito disponível',
            },
          },
        },
      },
    },
    security: [
      {
        cookieAuth: [],
      },
    ],
  },
  apis: ['./src/app/api/**/*.ts'], // Caminho para os arquivos com anotações
};

export const swaggerSpec = swaggerJsdoc(options);
