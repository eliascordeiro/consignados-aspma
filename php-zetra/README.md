# PHP Zetra Service

Serviço PHP para integração com API Zetra/eConsig.

## 📦 Estrutura

- `consultaMargemZetra.php` - Consultar margem disponível
- `consultarConsignacaoZetra.php` - Consultar consignação
- `reservarMargemZetra.php` - Reservar margem
- `reservarExluirZetra.php` - Excluir reserva
- `alterarConsignacao.php` - Alterar consignação
- `nusoap.php` - Biblioteca SOAP
- `index.php` - Health check

## 🚀 Deploy no Railway

### 1. Criar Novo Serviço

No dashboard do Railway:

1. Clique em **"New Service"**
2. Selecione **"GitHub Repo"**
3. Escolha o repositório `consignados-aspma`
4. Em **"Root Directory"**, configure: `php-zetra`
5. Em **"Service Name"**, coloque: `php-zetra-service`

### 2. Configurar Variáveis de Ambiente

O serviço não precisa de variáveis especiais. A porta é automaticamente configurada pelo Railway via `$PORT`.

### 3. Deploy Automático

O Railway vai:
- Detectar `nixpacks.toml`
- Instalar PHP 8.2 com extensões necessárias
- Iniciar servidor PHP na porta configurada

### 4. Obter URL do Serviço

Após o deploy:

1. Vá em **Settings** → **Networking**
2. Clique em **"Generate Domain"**
3. Copie a URL gerada (ex: `https://php-zetra-service.up.railway.app`)

### 5. Configurar no Next.js

No serviço Next.js, adicione variável de ambiente:

```
ZETRA_PHP_URL=https://php-zetra-service.up.railway.app
```

Ou use a URL interna do Railway (mais rápida):

```
ZETRA_PHP_URL=http://php-zetra-service.railway.internal:${{php-zetra-service.PORT}}
```

## 🔍 Testar Endpoints

### Health Check
```bash
curl https://seu-servico.up.railway.app/
```

### Consultar Margem
```bash
curl -X POST https://seu-servico.up.railway.app/consultaMargemZetra.php \
  -d "cliente=ASPMA" \
  -d "convenio=10" \
  -d "usuario=user" \
  -d "senha=pass" \
  -d "matricula=123456" \
  -d "cpf=123.456.789-00" \
  -d "valorParcela=100.00"
```

## 📊 Logs

Visualize logs no Railway:
```bash
railway logs -s php-zetra-service
```

## ⚡ Vantagens

- ✅ Comunicação interna Railway (sem timeout)
- ✅ Logs centralizados
- ✅ Deploy automático via Git
- ✅ Sem dependência de servidor externo
- ✅ Mesmo ambiente de produção

## 🔄 Atualizar Código Next.js

Após configurar a URL, atualize:

- `app/src/app/api/portal/margem/route.ts`
- `app/src/app/api/socios/[id]/margem/route.ts`

Substitua:
```typescript
const ZETRA_CONFIG = {
  phpUrl: 'http://200.98.112.240/aspma/php/zetra_desktop/consultaMargemZetra.php'
}
```

Por:
```typescript
const ZETRA_CONFIG = {
  phpUrl: process.env.ZETRA_PHP_URL + '/consultaMargemZetra.php'
}
```
