-- Script SQL para criar dados de teste no Railway
-- Execute este script no banco de dados Railway

-- 1. Criar convênio de teste
INSERT INTO convenio (usuario, senha, razao_soc, fantasia, ativo, cnpj, "createdAt", "updatedAt")
VALUES ('teste', 'teste123', 'CONVÊNIO DE TESTE', 'Teste', true, '00.000.000/0000-00', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 2. Criar empresa de teste
INSERT INTO "Empresa" (nome, cnpj, ativo, "createdAt", "updatedAt")
VALUES ('EMPRESA TESTE SWAGGER', '11.111.111/0001-11', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 3. Criar sócios de teste
DO $$
DECLARE
    empresa_id INT;
BEGIN
    -- Buscar ID da empresa
    SELECT id INTO empresa_id FROM "Empresa" WHERE nome = 'EMPRESA TESTE SWAGGER' LIMIT 1;
    
    -- Sócio 1 - Tipo 1 (Consulta ZETRA)
    INSERT INTO "Socio" (nome, cpf, matricula, tipo, "margemConsig", limite, "empresaId", ativo, bloqueio, celular, telefone, "createdAt", "updatedAt")
    VALUES ('JOÃO DA SILVA TESTE', '111.111.111-11', '999001', '1', 500.00, 1000.00, empresa_id, true, 'N', '(41) 99999-9999', '(41) 3333-3333', NOW(), NOW())
    ON CONFLICT (cpf) DO NOTHING;
    
    -- Sócio 2 - Tipo 3 (Cálculo Local)
    INSERT INTO "Socio" (nome, cpf, matricula, tipo, "margemConsig", limite, "empresaId", ativo, bloqueio, celular, telefone, "createdAt", "updatedAt")
    VALUES ('MARIA SANTOS TESTE', '222.222.222-22', '999002', '3', 800.00, 1500.00, empresa_id, true, 'N', '(41) 99999-9999', '(41) 3333-3333', NOW(), NOW())
    ON CONFLICT (cpf) DO NOTHING;
    
    -- Sócio 3 - Tipo 4 (Cálculo Local)
    INSERT INTO "Socio" (nome, cpf, matricula, tipo, "margemConsig", limite, "empresaId", ativo, bloqueio, celular, telefone, "createdAt", "updatedAt")
    VALUES ('PEDRO OLIVEIRA TESTE', '333.333.333-33', '999003', '4', 1200.00, 2000.00, empresa_id, true, 'N', '(41) 99999-9999', '(41) 3333-3333', NOW(), NOW())
    ON CONFLICT (cpf) DO NOTHING;
END $$;

-- Verificar dados criados
SELECT 'Convênio criado:' as info, usuario, razao_soc FROM convenio WHERE usuario = 'teste';
SELECT 'Sócios criados:' as info, nome, matricula, tipo FROM "Socio" WHERE matricula LIKE '999%';
