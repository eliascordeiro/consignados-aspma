import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import jsPDF from 'jspdf';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

const prisma = new PrismaClient();

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '200.98.112.240',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'eliascordeiro',
  password: process.env.MYSQL_PASSWORD || 'D24m0733@!',
  database: process.env.MYSQL_DATABASE || 'aspma',
};

interface AtivoMySQLRow {
  matricula: string;
  associado: string;
  codtipo: string;
  convenio_codigo: string;
  convenio_nome: string;
  num_parcela: number;
  qtd_parcelas: number;
  sequencia: number;
  valor: number;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!hasPermission(session.user, 'relatorios.view')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const mesAno = searchParams.get('mesAno');
    const convenioId = searchParams.get('convenioId');

    if (!mesAno) {
      return NextResponse.json({ error: 'Período (mesAno) é obrigatório' }, { status: 400 });
    }

    const [ano, mes] = mesAno.split('-').map(Number);
    if (!ano || !mes || mes < 1 || mes > 12) {
      return NextResponse.json({ error: 'Formato de data inválido. Use YYYY-MM' }, { status: 400 });
    }

    const connection = await mysql.createConnection(MYSQL_CONFIG);

    try {
      // Se filtrar por convênio, buscar código no PostgreSQL primeiro
      let codigoConvenio: string | null = null;
      if (convenioId) {
        const convenio = await prisma.convenio.findUnique({
          where: { id: parseInt(convenioId) },
          select: { codigo: true },
        });
        codigoConvenio = convenio?.codigo || null;
      }

      // AS301.PRG: codtipo <> '3' AND codtipo <> '4' (sócios ativos/regulares)
      let query = `
        SELECT 
          p.matricula,
          p.associado,
          s.codtipo,
          p.codconven as convenio_codigo,
          p.conveniado as convenio_nome,
          CAST(p.nrseq AS UNSIGNED) as num_parcela,
          p.parcelas as qtd_parcelas,
          p.sequencia,
          p.valor
        FROM parcelas p
        LEFT JOIN socios s ON TRIM(p.matricula) = TRIM(s.matricula)
        WHERE YEAR(p.vencimento) = ?
          AND MONTH(p.vencimento) = ?
          AND TRIM(p.baixa) = ''
          AND s.codtipo <> '3'
          AND s.codtipo <> '4'
      `;

      const params: any[] = [ano, mes];

      if (codigoConvenio) {
        query += ` AND TRIM(p.codconven) = ?`;
        params.push(codigoConvenio);
      }

      query += ` ORDER BY p.associado, p.matricula, p.sequencia, p.nrseq`;

      const [rows] = await connection.execute(query, params);
      const parcelas = rows as AtivoMySQLRow[];

      if (parcelas.length === 0) {
        return NextResponse.json({
          error: 'Nenhuma parcela de associados ativos encontrada para o período selecionado',
        }, { status: 404 });
      }

      // Agrupar por matrícula
      const grupos = new Map<string, {
        matricula: string;
        associado: string;
        codTipo: string;
        parcelas: AtivoMySQLRow[];
      }>();

      for (const parcela of parcelas) {
        const key = parcela.matricula || 'SEM_MATRICULA';
        if (!grupos.has(key)) {
          grupos.set(key, {
            matricula: parcela.matricula,
            associado: parcela.associado,
            codTipo: parcela.codtipo,
            parcelas: [],
          });
        }
        grupos.get(key)!.parcelas.push(parcela);
      }

      const pdfBuffer = await gerarPDF(Array.from(grupos.values()), mesAno);
      return new NextResponse(pdfBuffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="ativos-mysql-${mesAno}.pdf"`,
        },
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Erro ao gerar relatório Ativos MySQL:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar relatório', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

async function gerarPDF(grupos: any[], mesAno: string): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const pageWidth = 297;
  const pageHeight = 210;
  let y = 20;

  // Título
  doc.setFont('Courier', 'bold');
  doc.setFontSize(12);
  doc.text(`DEBITOS DE ASSOCIADOS - MySQL (AS301)`, pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setFontSize(10);
  doc.text(`Periodo: ${mesAno} | Tipo diferente de 3 e 4 | Parcelas em Aberto`, pageWidth / 2, y, { align: 'center' });

  y += 10;

  const desenharCabecalho = () => {
    doc.setFont('Courier', 'bold');
    doc.setFontSize(8);
    doc.text('Matrícula', 10, y);
    doc.text('Associado', 35, y);
    doc.text('Tp', 90, y);
    doc.text('Conveniado', 100, y);
    doc.text('Pc', 190, y);
    doc.text('De', 200, y);
    doc.text('Valor', 225, y, { align: 'right' });
    doc.text('Total', 260, y, { align: 'right' });
    y += 2;
    doc.line(10, y, pageWidth - 10, y);
    y += 5;
    doc.setFont('Courier', 'normal');
  };

  desenharCabecalho();

  for (const grupo of grupos) {
    let totalGrupo = 0;
    let firstLine = true;

    for (const parcela of grupo.parcelas) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
        desenharCabecalho();
      }

      const valor = parseFloat(parcela.valor?.toString() || '0');
      totalGrupo += valor;

      if (firstLine) {
        doc.text(String(grupo.matricula || '').trim(), 10, y);
        doc.text(String(grupo.associado || '').trim().substring(0, 25), 35, y);
        doc.text(String(grupo.codTipo || '').trim(), 90, y);
        firstLine = false;
      }

      const conveniadoTexto = `${String(parcela.convenio_codigo || '').trim()} - ${String(parcela.convenio_nome || '').trim().substring(0, 35)}`;
      doc.text(conveniadoTexto, 100, y);
      doc.text(String(parcela.num_parcela || '').padStart(2, '0'), 190, y);
      doc.text(String(parcela.qtd_parcelas || '').padStart(2, '0'), 200, y);
      doc.text(String(valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })), 225, y, { align: 'right' });

      y += 5;
    }

    // Total do grupo na última linha
    doc.setFont('Courier', 'bold');
    doc.text(String(totalGrupo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })), 260, y - 5, { align: 'right' });
    doc.setFont('Courier', 'normal');
    y += 2;
  }

  // Total geral
  const totalGeral = grupos.reduce((sum, grupo) =>
    sum + grupo.parcelas.reduce((s: number, p: AtivoMySQLRow) => s + parseFloat(p.valor?.toString() || '0'), 0), 0
  );

  y += 5;
  doc.setFont('Courier', 'bold');
  doc.text(
    `TOTAL GERAL: R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    pageWidth - 30,
    y,
    { align: 'right' }
  );

  return doc.output('arraybuffer');
}
