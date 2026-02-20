# 🚂 Como Criar Dados de Teste no Railway

## ✅ Método Recomendado: Via Railway Shell

Esta é a forma mais fácil e direta:

### Passo 1: Acesse seu projeto no Railway
1. Abra https://railway.app
2. Selecione seu projeto
3. Clique no serviço da **aplicação Next.js** (não no Postgres)

### Passo 2: Execute o script
1. No canto superior direito, clique nos **3 pontinhos** (⋮)
2. Selecione **"Shell"** ou **"Run command"**
3. Digite:
   ```bash
   npm run seed:railway
   ```

Pronto! Os dados serão criados automaticamente. ✅

---

## 🔄 Alternativa: Executar Localmente (conectando ao Railway)

Se preferir executar da sua máquina:

### Passo 1: Obtenha a DATABASE_URL do Railway
1. Railway Dashboard → Seu Projeto → Postgres
2. Vá em **"Connect"**
3. Copie a **"Postgres Connection URL"**

### Passo 2: Execute localmente
```bash
DATABASE_URL="sua-url-copiada-aqui" npm run seed:railway
```

---

## 🗑️ Remover Dados de Teste (Se necessário)

Caso precise limpar, execute estes comandos no Railway Shell:

```bash
npx prisma studio
```

Ou conecte via qualquer cliente PostgreSQL e execute:

```sql
DELETE FROM "Socio" WHERE matricula LIKE '999%';
DELETE FROM convenio WHERE usuario = 'teste';
DELETE FROM "Empresa" WHERE nome = 'EMPRESA TESTE SWAGGER';
```

---

## ✅ Verificar se funcionou

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
