#!/bin/bash

# Script de teste para consulta de margem ZETRA
# Uso: ./test-margem-railway.sh

echo "🧪 TESTE DE CONSULTA DE MARGEM ZETRA"
echo "══════════════════════════════════════════════════"

MATRICULA="2221"
BASE_URL="https://consignados-aspma-production.up.railway.app"

echo ""
echo "🔍 Buscando sócio com matrícula: $MATRICULA..."
echo ""

# Busca o sócio pela matrícula
SOCIO_RESPONSE=$(curl -s "$BASE_URL/api/socios?matricula=$MATRICULA")

# Extrai os dados do sócio (usando jq se disponível, senão mostra raw)
if command -v jq &> /dev/null; then
    SOCIO_ID=$(echo "$SOCIO_RESPONSE" | jq -r '.[0].id')
    SOCIO_NOME=$(echo "$SOCIO_RESPONSE" | jq -r '.[0].associado')
    SOCIO_TIPO=$(echo "$SOCIO_RESPONSE" | jq -r '.[0].tipo')
    
    echo "✅ Sócio encontrado: $SOCIO_NOME (ID: $SOCIO_ID)"
    echo "   Matrícula: $MATRICULA"
    if [ "$SOCIO_TIPO" = "1" ]; then
        echo "   Tipo: $SOCIO_TIPO (Consignatária - ZETRA)"
    else
        echo "   Tipo: $SOCIO_TIPO (Banco de Dados)"
    fi
else
    echo "Resposta da API (sem jq):"
    echo "$SOCIO_RESPONSE"
    # Tenta extrair ID com grep básico
    SOCIO_ID=$(echo "$SOCIO_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
fi

if [ -z "$SOCIO_ID" ] || [ "$SOCIO_ID" = "null" ]; then
    echo ""
    echo "❌ Sócio não encontrado ou erro na busca"
    exit 1
fi

echo ""
echo "📊 Consultando margem para sócio ID $SOCIO_ID..."
echo ""

# Marca o tempo de início
START_TIME=$(date +%s.%N)

# Consulta a margem
MARGEM_RESPONSE=$(curl -s "$BASE_URL/api/socios/$SOCIO_ID/margem")

# Marca o tempo de fim
END_TIME=$(date +%s.%N)
DURATION=$(echo "$END_TIME - $START_TIME" | bc)

echo "✅ Consulta concluída em ${DURATION}s"
echo ""
echo "📋 RESULTADO DA CONSULTA:"
echo "──────────────────────────────────────────────────"

if command -v jq &> /dev/null; then
    echo "$MARGEM_RESPONSE" | jq '.'
    
    MARGEM_VALOR=$(echo "$MARGEM_RESPONSE" | jq -r '.margem')
    MARGEM_TIPO=$(echo "$MARGEM_RESPONSE" | jq -r '.tipo')
    MARGEM_FONTE=$(echo "$MARGEM_RESPONSE" | jq -r '.fonte')
    MARGEM_AVISO=$(echo "$MARGEM_RESPONSE" | jq -r '.aviso // empty')
    
    echo "──────────────────────────────────────────────────"
    echo ""
    echo "✅ TESTE CONCLUÍDO COM SUCESSO!"
    echo ""
    
    if [ "$MARGEM_TIPO" = "zetra" ] && [ "$MARGEM_FONTE" = "tempo_real" ]; then
        echo "🎯 Margem consultada diretamente do webservice ZETRA (SOAP)"
    elif [ "$MARGEM_FONTE" = "fallback" ]; then
        echo "⚠️  ZETRA indisponível - usando valor do banco de dados"
    else
        echo "📦 Margem do banco de dados (tipo diferente de consignatária)"
    fi
    
    if [ ! -z "$MARGEM_AVISO" ]; then
        echo "⚠️  Aviso: $MARGEM_AVISO"
    fi
else
    echo "$MARGEM_RESPONSE"
    echo "──────────────────────────────────────────────────"
    echo ""
    echo "💡 Dica: Instale 'jq' para formatação melhor dos resultados JSON"
    echo "   sudo apt install jq"
fi

echo ""
