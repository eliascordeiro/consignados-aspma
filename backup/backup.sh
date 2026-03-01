#!/usr/bin/env bash
set -euo pipefail

# ─── Configuração ────────────────────────────────────────────────────────────
BACKUP_DIR=${BACKUP_DIR:-/backups}
KEEP_DAILY=${KEEP_DAILY:-7}       # quantos backups diários manter
KEEP_WEEKLY=${KEEP_WEEKLY:-4}     # quantos backups semanais manter
KEEP_MONTHLY=${KEEP_MONTHLY:-3}   # quantos backups mensais manter
DB_URL=${DATABASE_URL:?"DATABASE_URL não definida"}

# ─── Preparação ──────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly" "$BACKUP_DIR/monthly"

NOW=$(date +"%Y%m%d_%H%M%S")
DOW=$(date +"%u")   # 1=seg ... 7=dom
DOM=$(date +"%d")   # dia do mês

DAILY_FILE="$BACKUP_DIR/daily/aspma_${NOW}.dump"

# ─── pg_dump ─────────────────────────────────────────────────────────────────
echo "════════════════════════════════════════"
echo "  BACKUP PostgreSQL – $(date '+%d/%m/%Y %H:%M:%S')"
echo "════════════════════════════════════════"
echo "Destino: $DAILY_FILE"

pg_dump "$DB_URL" \
  --no-owner \
  --no-acl \
  --format=custom \
  --file="$DAILY_FILE"

SIZE=$(du -sh "$DAILY_FILE" | cut -f1)
echo "✅ Backup criado: $DAILY_FILE ($SIZE)"

# ─── Cópia semanal (toda segunda-feira) ──────────────────────────────────────
if [ "$DOW" = "1" ]; then
  WEEKLY_FILE="$BACKUP_DIR/weekly/aspma_$(date +"%Y_W%V").dump"
  cp "$DAILY_FILE" "$WEEKLY_FILE"
  echo "📅 Cópia semanal: $WEEKLY_FILE"
fi

# ─── Cópia mensal (todo dia 1) ────────────────────────────────────────────────
if [ "$DOM" = "01" ]; then
  MONTHLY_FILE="$BACKUP_DIR/monthly/aspma_$(date +"%Y%m").dump"
  cp "$DAILY_FILE" "$MONTHLY_FILE"
  echo "🗓️  Cópia mensal: $MONTHLY_FILE"
fi

# ─── Limpeza de arquivos antigos ─────────────────────────────────────────────
echo ""
echo "Limpando backups antigos..."

# Daily: manter os N mais recentes
DAILY_COUNT=$(ls -1 "$BACKUP_DIR/daily"/*.dump 2>/dev/null | wc -l)
if [ "$DAILY_COUNT" -gt "$KEEP_DAILY" ]; then
  ls -1t "$BACKUP_DIR/daily"/*.dump | tail -n +$((KEEP_DAILY + 1)) | xargs rm -f
  echo "  Daily: removidos $((DAILY_COUNT - KEEP_DAILY)) arquivo(s) antigo(s)"
fi

# Weekly: manter os N mais recentes
WEEKLY_COUNT=$(ls -1 "$BACKUP_DIR/weekly"/*.dump 2>/dev/null | wc -l)
if [ "$WEEKLY_COUNT" -gt "$KEEP_WEEKLY" ]; then
  ls -1t "$BACKUP_DIR/weekly"/*.dump | tail -n +$((KEEP_WEEKLY + 1)) | xargs rm -f
  echo "  Weekly: removidos $((WEEKLY_COUNT - KEEP_WEEKLY)) arquivo(s) antigo(s)"
fi

# Monthly: manter os N mais recentes
MONTHLY_COUNT=$(ls -1 "$BACKUP_DIR/monthly"/*.dump 2>/dev/null | wc -l)
if [ "$MONTHLY_COUNT" -gt "$KEEP_MONTHLY" ]; then
  ls -1t "$BACKUP_DIR/monthly"/*.dump | tail -n +$((MONTHLY_COUNT - KEEP_MONTHLY + 1)) | xargs rm -f
  echo "  Monthly: removidos $((MONTHLY_COUNT - KEEP_MONTHLY)) arquivo(s) antigo(s)"
fi

# ─── Resumo final ────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo "  RESUMO DOS BACKUPS ARMAZENADOS"
echo "════════════════════════════════════════"
echo "Daily   (últimos $KEEP_DAILY dias):"
ls -lh "$BACKUP_DIR/daily"/*.dump 2>/dev/null | awk '{print "  "$9" "$5}' || echo "  nenhum"

echo "Weekly  (últimas $KEEP_WEEKLY semanas):"
ls -lh "$BACKUP_DIR/weekly"/*.dump 2>/dev/null | awk '{print "  "$9" "$5}' || echo "  nenhum"

echo "Monthly (últimos $KEEP_MONTHLY meses):"
ls -lh "$BACKUP_DIR/monthly"/*.dump 2>/dev/null | awk '{print "  "$9" "$5}' || echo "  nenhum"

echo ""
echo "Total em disco: $(du -sh "$BACKUP_DIR" | cut -f1)"
echo "════════════════════════════════════════"
echo "Backup concluído com sucesso."
