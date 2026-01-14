-- Inserir consignatárias baseadas nos tipos existentes em socios
-- Cada empresaId em socios corresponde a uma consignatária

-- Tipo 1 = Prefeitura de Araucária
INSERT INTO empresas (id, "userId", nome, cnpj, tipo, telefone, email, contato, cep, rua, numero, bairro, cidade, uf, ativo, "createdAt", "updatedAt") 
VALUES (1, 'cmkeaodeq00007zofci9t08yw', 'Prefeitura Municipal de Araucária', '76.105.501/0001-31', 'PUBLICO', '(41) 3614-1600', 'rh@araucaria.pr.gov.br', 'Maria Silva', '83701-020', 'Rua Pedro Druszcz', '1701', 'Centro', 'Araucária', 'PR', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
  "userId" = EXCLUDED."userId",
  nome = EXCLUDED.nome,
  cnpj = EXCLUDED.cnpj,
  tipo = EXCLUDED.tipo,
  telefone = EXCLUDED.telefone,
  email = EXCLUDED.email,
  contato = EXCLUDED.contato,
  cep = EXCLUDED.cep,
  rua = EXCLUDED.rua,
  numero = EXCLUDED.numero,
  bairro = EXCLUDED.bairro,
  cidade = EXCLUDED.cidade,
  uf = EXCLUDED.uf,
  "updatedAt" = NOW();

-- Tipo 2 = Câmara Municipal
INSERT INTO empresas (id, "userId", nome, cnpj, tipo, telefone, email, contato, cep, rua, numero, bairro, cidade, uf, ativo, "createdAt", "updatedAt") 
VALUES (2, 'cmkeaodeq00007zofci9t08yw', 'Câmara Municipal de Araucária', '98.765.432/0001-10', 'PUBLICO', '(41) 3614-3000', 'camara@araucaria.pr.leg.br', 'Ana Paula Costa', '83701-015', 'Rua Heitor Stockler de França', '1500', 'Centro', 'Araucária', 'PR', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
  "userId" = EXCLUDED."userId",
  nome = EXCLUDED.nome,
  cnpj = EXCLUDED.cnpj,
  "updatedAt" = NOW();

-- Tipo 3 = Fundo de Previdência Municipal
INSERT INTO empresas (id, "userId", nome, cnpj, tipo, telefone, email, contato, cep, rua, numero, bairro, cidade, uf, ativo, "createdAt", "updatedAt") 
VALUES (3, 'cmkeaodeq00007zofci9t08yw', 'Fundo de Previdência Municipal', '12.345.678/0001-90', 'PUBLICO', '(41) 3614-2200', 'atendimento@fundoprev.araucaria.pr.gov.br', 'João Santos', '83702-100', 'Avenida das Araucárias', '500', 'Fazendinha', 'Araucária', 'PR', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
  "userId" = EXCLUDED."userId",
  nome = EXCLUDED.nome,
  cnpj = EXCLUDED.cnpj,
  "updatedAt" = NOW();

-- Tipo 4 = Secretaria de Saúde
INSERT INTO empresas (id, "userId", nome, cnpj, tipo, telefone, email, contato, cep, rua, numero, bairro, cidade, uf, ativo, "createdAt", "updatedAt") 
VALUES (4, 'cmkeaodeq00007zofci9t08yw', 'Secretaria de Saúde Municipal', '15.987.654/0001-88', 'PUBLICO', '(41) 3614-7700', 'saude@araucaria.pr.gov.br', 'Dra. Fernanda Oliveira', '83702-560', 'Rua das Framboesas', '150', 'Capela Velha', 'Araucária', 'PR', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
  "userId" = EXCLUDED."userId",
  nome = EXCLUDED.nome,
  cnpj = EXCLUDED.cnpj,
  "updatedAt" = NOW();

-- Tipo 5 = Secretaria de Educação
INSERT INTO empresas (id, "userId", nome, cnpj, tipo, telefone, email, contato, cep, rua, numero, bairro, cidade, uf, ativo, "createdAt", "updatedAt") 
VALUES (5, 'cmkeaodeq00007zofci9t08yw', 'Secretaria de Educação', '25.874.963/0001-47', 'PUBLICO', '(41) 3614-8800', 'educacao@araucaria.pr.gov.br', 'Prof. Ricardo Almeida', '83701-290', 'Rua Luiz Pasteur', '300', 'Centro', 'Araucária', 'PR', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
  "userId" = EXCLUDED."userId",
  nome = EXCLUDED.nome,
  cnpj = EXCLUDED.cnpj,
  "updatedAt" = NOW();

-- Tipo 6 = SANEPAR
INSERT INTO empresas (id, "userId", nome, cnpj, tipo, telefone, email, contato, cep, rua, numero, bairro, cidade, uf, ativo, "createdAt", "updatedAt") 
VALUES (6, 'cmkeaodeq00007zofci9t08yw', 'SANEPAR - Araucária', '76.484.013/0025-45', 'PUBLICO', '(41) 3614-5500', 'rh.araucaria@sanepar.com.br', 'Carlos Eduardo Lima', '83703-300', 'Rua João Batista', '2000', 'Campina da Barra', 'Araucária', 'PR', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
  "userId" = EXCLUDED."userId",
  nome = EXCLUDED.nome,
  cnpj = EXCLUDED.cnpj,
  "updatedAt" = NOW();

-- Tipo 7 = COPEL
INSERT INTO empresas (id, "userId", nome, cnpj, tipo, telefone, email, contato, cep, rua, numero, bairro, cidade, uf, ativo, "createdAt", "updatedAt") 
VALUES (7, 'cmkeaodeq00007zofci9t08yw', 'COPEL - Cia Paranaense de Energia', '76.483.817/0001-20', 'PUBLICO', '(41) 3331-4444', 'recursoshumanos@copel.com', 'Roberto Martins', '80420-050', 'Rua Coronel Dulcídio', '800', 'Água Verde', 'Curitiba', 'PR', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
  "userId" = EXCLUDED."userId",
  nome = EXCLUDED.nome,
  cnpj = EXCLUDED.cnpj,
  "updatedAt" = NOW();

-- Tipo 8 = Hospital Municipal
INSERT INTO empresas (id, "userId", nome, cnpj, tipo, telefone, email, contato, cep, rua, numero, bairro, cidade, uf, ativo, "createdAt", "updatedAt") 
VALUES (8, 'cmkeaodeq00007zofci9t08yw', 'Hospital Municipal de Araucária', '36.258.147/0001-25', 'PUBLICO', '(41) 3614-9900', 'hospital@araucaria.pr.gov.br', 'Dr. Paulo Henrique', '83703-470', 'Rua Heitor de Alencar Furtado', '1000', 'Costeira', 'Araucária', 'PR', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
  "userId" = EXCLUDED."userId",
  nome = EXCLUDED.nome,
  cnpj = EXCLUDED.cnpj,
  "updatedAt" = NOW();

-- Resetar a sequência do ID para o próximo valor correto
SELECT setval('empresas_id_seq', (SELECT MAX(id) FROM empresas));

-- Atualizar todos os socios para vincular ao userId do A.S.P.M.A
UPDATE socios SET "userId" = 'cmkeaodeq00007zofci9t08yw' WHERE "userId" IS NULL;

-- Verificar resultado
SELECT e.id, e.nome, COUNT(s.id) as total_funcionarios 
FROM empresas e 
LEFT JOIN socios s ON e.id = s."empresaId" 
WHERE e."userId" = 'cmkeaodeq00007zofci9t08yw'
GROUP BY e.id, e.nome 
ORDER BY e.id;
