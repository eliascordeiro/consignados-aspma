# 🚂 Como Criar Dados de Teste no Railway

## Opção 1: Via Railway CLI (Recomendado)

1. **Conecte ao banco de dados:**
   ```bash
   railway connect postgres
   ```

2. **Execute o script SQL:**
   ```bash
   \i scripts/seed-swagger-railway.sql
   ```

   Ou copie e cole o conteúdo do arquivo.

## Opção 2: Via Interface do Railway

1. Acesse o [Railway Dashboard](https://railway.app)
2. Selecione seu projeto
3. Clique no serviço **Postgres**
4. Vá em **Data** → **Query**
5. Cole o conteúdo de [scripts/seed-swagger-railway.sql](./scripts/seed-swagger-railway.sql)
6. Clique em **Run**

## Opção 3: Via Cliente PostgreSQL

1. **Obtenha as credenciais do Railway:**
   - Dashboard → Postgres → Connect → PostgreSQL

2. **Conecte via psql:**
   ```bash
   psql postgres://user:pass@host:port/railway
   ```

3. **Execute o script:**
   ```bash
   \i scripts/seed-swagger-railway.sql
   ```

## Opção 4: Via Script Node (Railway Shell)

1. **Abra o Railway Shell:**
   ```bash
   railway run bash
   ```

2. **Execute o script:**
   ```bash
   npm run seed:swagger
   ```

## Verificação

Após executar, teste no Swagger:

1. Acesse: https://aspma-consignados.com.br/api-docs
2. Endpoint: `POST /api/convenio/auth/login`
3. Body:
   ```json
   {
     "usuario": "teste",
     "senha": "teste123"
   }
   ```
4. Deve retornar **200 OK** ✅

## 🗑️ Remover Dados de Teste

Se precisar limpar:

```sql
DELETE FROM "Socio" WHERE matricula LIKE '999%';
DELETE FROM convenio WHERE usuario = 'teste';
DELETE FROM "Empresa" WHERE nome = 'EMPRESA TESTE SWAGGER';
```
