# 🧪 Guia de Testes com Swagger

Este guia explica como testar a API usando o Swagger UI com dados fake.

## 🚀 Passo 1: Criar Dados de Teste

Execute o script para criar usuários e sócios de teste no banco de dados:

```bash
npx tsx scripts/seed-swagger-test-data.ts
```

Este script criará:
- ✅ 1 convênio de teste
- ✅ 1 empresa de teste
- ✅ 3 sócios de teste (diferentes tipos)

## 🔐 Passo 2: Credenciais de Teste

### Convênio de Teste
- **Usuário:** `teste`
- **Senha:** `teste123`
- **Razão Social:** CONVÊNIO DE TESTE

### Sócios de Teste

| Nome | Matrícula | CPF | Tipo | Comportamento |
|------|-----------|-----|------|---------------|
| JOÃO DA SILVA TESTE | 999001 | 111.111.111-11 | 1 | Consulta ZETRA |
| MARIA SANTOS TESTE | 999002 | 222.222.222-22 | 3 | Cálculo Local |
| PEDRO OLIVEIRA TESTE | 999003 | 333.333.333-33 | 4 | Cálculo Local |

## 📝 Passo 3: Testando no Swagger

### 3.1 - Acesse a documentação

**Desenvolvimento:**
```
http://localhost:3000/api-docs
```

**Produção:**
```
https://aspma-consignados.com.br/api-docs
```

### 3.2 - Faça login

1. Encontre o endpoint `POST /api/convenio/auth/login` na seção **Autenticação**
2. Clique em **"Try it out"**
3. Preencha o Request body:
   ```json
   {
     "usuario": "teste",
     "senha": "teste123"
   }
   ```
4. Clique em **"Execute"**
5. Verifique se o retorno é **200 OK** ✅

### 3.3 - Buscar um sócio

1. Encontre o endpoint `GET /api/convenio/socios` na seção **Consulta de Margem**
2. Clique em **"Try it out"**
3. No campo `busca`, digite uma das opções:
   - `999001` (matrícula)
   - `111.111.111-11` (CPF formatado)
   - `11111111111` (CPF sem formatação)
4. Clique em **"Execute"**
5. Copie o `id` do sócio retornado (será algo como `550e8400-e29b-41d4-a716-446655440000`)

### 3.4 - Consultar margem do sócio

1. Encontre o endpoint `GET /api/convenio/socios/margem` na seção **Consulta de Margem**
2. Clique em **"Try it out"**
3. Cole o `socioId` copiado no passo anterior
4. (Opcional) Defina um `valorParcela` para simulação (ex: `100.00`)
5. Clique em **"Execute"**
6. Verifique a resposta com a margem calculada

## 🎯 Exemplos de Teste

### Exemplo 1: Sócio Tipo 3 (Cálculo Local)
```bash
# Buscar sócio
GET /api/convenio/socios?busca=999002

# Resposta esperada
{
  "socios": [{
    "id": "abc123...",
    "nome": "MARIA SANTOS TESTE",
    "matricula": "999002",
    ...
  }]
}

# Consultar margem
GET /api/convenio/socios/margem?socioId=abc123...

# Resposta esperada
{
  "margem": 800.00,
  "limite": 1500.00,
  "descontos": 0,
  "fonte": "local",
  "tipo": "3"
}
```

### Exemplo 2: Sócio Tipo 1 (ZETRA)
```bash
# Buscar sócio
GET /api/convenio/socios?busca=11111111111

# Consultar margem (tentará ZETRA, depois fallback)
GET /api/convenio/socios/margem?socioId=...

# Resposta provável (ZETRA pode estar indisponível)
{
  "margem": 500.00,
  "fonte": "fallback",
  "tipo": "1",
  "aviso": "ZETRA indisponível, usando valor do banco"
}
```

## 🔄 Recriar Dados de Teste

Se precisar limpar e recriar os dados:

```bash
# No psql ou ferramenta de banco
DELETE FROM socios WHERE matricula LIKE '999%';
DELETE FROM convenios WHERE usuario = 'teste';
DELETE FROM empresas WHERE nome = 'EMPRESA TESTE SWAGGER';

# Recriar
npx tsx scripts/seed-swagger-test-data.ts
```

## 💡 Dicas

1. **Cookies automáticos:** Após o login, o Swagger envia cookies automaticamente em todas as requisições
2. **Sessão expira:** Se receber erro 401, faça login novamente
3. **Diferentes tipos:** Teste com matrículas diferentes para ver comportamentos distintos
4. **Valores realistas:** Os sócios de teste têm margens e limites realistas
5. **Sem impacto:** Estes dados não afetam produção (são identificáveis pela matrícula 999xxx)

## 🛠️ Troubleshooting

### Erro 401 após login
- Verifique se o cookie foi armazenado (aba Network do navegador)
- Tente fazer logout e login novamente

### Sócio não encontrado
- Confirme que executou o script de seed
- Verifique se está usando matrícula ou CPF corretos

### ZETRA sempre retorna fallback
- Isso é esperado se o ZETRA estiver indisponível
- Use sócios tipo 3 ou 4 para testar cálculo local

## 📚 Recursos Adicionais

- [SWAGGER_GUIDE.md](SWAGGER_GUIDE.md) - Guia completo do Swagger
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
