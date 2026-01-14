#!/bin/bash

echo "🔍 Verificando tabelas no banco de dados..."
echo ""

PGPASSWORD=postgres psql -h localhost -U postgres -d consignados_dev -t -c "
SELECT 
    CASE 
        WHEN table_name IN ('empresas', 'locais', 'autorizacoes', 'socios') THEN '✅'
        ELSE '  '
    END || ' ' || table_name as tabela
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
"

echo ""
echo "🔍 Verificando enums criados..."
echo ""

PGPASSWORD=postgres psql -h localhost -U postgres -d consignados_dev -t -c "
SELECT '  ' || typname as enum_type
FROM pg_type 
WHERE typname IN ('TipoEmpresa', 'TipoLocal', 'UserRole', 'TipoConsignado', 'StatusConsignado')
ORDER BY typname;
"
