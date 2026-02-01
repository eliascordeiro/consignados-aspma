# Configuração da Sincronização MySQL → PostgreSQL

## Problema Atual

Erro: `Access denied for user 'root'@'34.86.68.201'`

O MySQL remoto (200.98.112.240) não permite conexões do Railway (IP 34.86.68.201).

## Soluções Disponíveis

### ✅ Solução 1: Liberar IP do Railway no MySQL (RECOMENDADO)

No servidor MySQL (200.98.112.240), execute como administrador:

```sql
-- Opção A: Liberar IP específico do Railway
GRANT ALL PRIVILEGES ON consignados.* TO 'root'@'34.86.68.201' IDENTIFIED BY 'Aspma@2024';
FLUSH PRIVILEGES;

-- OU Opção B: Criar usuário específico para Railway
CREATE USER 'railway_sync'@'34.86.68.201' IDENTIFIED BY 'SenhaSegura123!';
GRANT SELECT ON consignados.* TO 'railway_sync'@'34.86.68.201';
FLUSH PRIVILEGES;
```

Se usar Opção B, configure no Railway:
```
MYSQL_USER=railway_sync
MYSQL_PASSWORD=SenhaSegura123!
```

### ✅ Solução 2: Liberar Todos IPs (Menos Seguro)

```sql
GRANT ALL PRIVILEGES ON consignados.* TO 'root'@'%' IDENTIFIED BY 'Aspma@2024';
FLUSH PRIVILEGES;
```

⚠️ **Aviso:** Permite conexões de qualquer IP. Use senha forte!

### ✅ Solução 3: Usar VPN/Túnel SSH

Se o MySQL está em rede privada, configure túnel SSH:

```bash
ssh -L 3307:200.98.112.240:3306 usuario@servidor-gateway
```

E configure no Railway:
```
MYSQL_HOST=localhost
MYSQL_PORT=3307
```

### ✅ Solução 4: Whitelist Railway IPs

Railway usa IPs dinâmicos. Whitelist de IPs conhecidos:

```
34.86.68.0/24
35.188.0.0/16
```

Configure no firewall do MySQL ou cPanel.

## Configuração de Variáveis de Ambiente no Railway

1. Acesse: https://railway.app/project/[seu-projeto]
2. Vá em **Variables**
3. Adicione:

```env
MYSQL_HOST=200.98.112.240
MYSQL_USER=root
MYSQL_PASSWORD=Aspma@2024
MYSQL_DATABASE=consignados
MYSQL_PORT=3306
```

## Verificar Conexão Local

Teste se sua máquina consegue conectar:

```bash
mysql -h 200.98.112.240 -u root -p'Aspma@2024' consignados
```

Se funcionar localmente mas não no Railway, é questão de IP bloqueado.

## Logs de Debug

Os logs agora mostram qual IP está tentando conectar. Verifique em:
- Railway Dashboard → Deployments → View Logs

Procure por:
```
Tentando conectar ao MySQL: { host: '...', user: '...', ... }
```

## Alternativa: Proxy Local

Se não conseguir liberar IP, rode um proxy local:

1. Na sua máquina local (que tem acesso ao MySQL):
```bash
npm install -g mysql-tunnel
mysql-tunnel --host 200.98.112.240 --port 3306 --local-port 3307
```

2. Exponha via ngrok:
```bash
ngrok tcp 3307
```

3. Configure no Railway o endereço do ngrok.

⚠️ **Não recomendado para produção!**

## Status da Implementação

- ✅ API de sincronização criada
- ✅ UI com botão e modal de resultado
- ✅ Logs de debug adicionados
- ⏳ Aguardando liberação de IP no MySQL

## Próximos Passos

1. **Primeiro:** Tente Solução 1 (criar usuário específico)
2. **Se não funcionar:** Verifique firewall/cPanel
3. **Última opção:** Use Solução 2 (todos IPs) temporariamente
