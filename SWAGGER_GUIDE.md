# Documentação da API com Swagger/OpenAPI

Esta aplicação Next.js agora inclui documentação completa da API usando Swagger/OpenAPI 3.0.

## 🌐 Acessando a Documentação

Após iniciar o servidor de desenvolvimento, acesse:

- **Interface Swagger UI**: http://localhost:3000/api-docs
- **Especificação JSON**: http://localhost:3000/api/docs

## 📝 Como Documentar Novas Rotas

Para adicionar documentação a uma rota API, use comentários JSDoc com anotações Swagger antes da função handler:

```typescript
/**
 * @swagger
 * /api/seu-endpoint:
 *   get:
 *     summary: Descrição curta do endpoint
 *     description: Descrição detalhada do que o endpoint faz
 *     tags:
 *       - Nome da Categoria
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: parametro
 *         schema:
 *           type: string
 *         description: Descrição do parâmetro
 *     responses:
 *       200:
 *         description: Resposta de sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 campo:
 *                   type: string
 */
export async function GET(request: NextRequest) {
  // Seu código aqui
}
```

## 🔧 Estrutura dos Arquivos

- **`src/lib/swagger.ts`**: Configuração principal do Swagger e definições de schemas
- **`src/app/api/docs/route.ts`**: Endpoint que serve a especificação JSON
- **`src/components/SwaggerUIClient.tsx`**: Componente client-side do Swagger UI
- **`src/app/api-docs/page.tsx`**: Página que renderiza a interface do Swagger

## 📚 Tags Disponíveis

As rotas estão organizadas nas seguintes categorias:

- **Documentação**: Endpoints sobre a própria documentação
- **Autenticação**: Login e logout de convênios
- **Consulta de Margem**: Busca de sócios e consulta de margem consignável por matrícula/CPF
- **Vendas**: Gestão de vendas
- **Relatórios**: Geração de relatórios

## 🔐 Autenticação

A API utiliza autenticação baseada em sessão (cookies). Os schemas de segurança disponíveis são:

- **cookieAuth**: Cookie de sessão (authjs.session-token)
- **bearerAuth**: Token JWT (para integrações externas)

## 📦 Schemas Reutilizáveis

Defina schemas comuns no arquivo `src/lib/swagger.ts` na seção `components.schemas`. Exemplo:

```typescript
components: {
  schemas: {
    Usuario: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        nome: { type: 'string' },
        email: { type: 'string', format: 'email' },
      },
    },
  },
}
```

Depois use com `$ref: '#/components/schemas/Usuario'` nas rotas.

## 🚀 Exemplo Completo

Veja os arquivos abaixo para exemplos completos de documentação:
- [src/app/api/convenio/auth/login/route.ts](src/app/api/convenio/auth/login/route.ts) - Endpoint de autenticação
- [src/app/api/convenio/socios/route.ts](src/app/api/convenio/socios/route.ts) - Busca de sócios por matrícula/CPF
- [src/app/api/convenio/socios/margem/route.ts](src/app/api/convenio/socios/margem/route.ts) - Consulta de margem consignável

## 📖 Recursos Adicionais

- [Swagger/OpenAPI Specification](https://swagger.io/specification/)
- [swagger-jsdoc Documentation](https://github.com/Surnet/swagger-jsdoc)
- [Swagger UI React](https://github.com/swagger-api/swagger-ui/tree/master/docs/usage/installation.md#react)

## 🛠️ Personalizações

Para alterar as configurações do Swagger (título, descrição, servidores, etc.), edite o arquivo `src/lib/swagger.ts`.
