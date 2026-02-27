import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import jsPDF from 'jspdf';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import iconv from 'iconv-lite';
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

interface PensionistaMySQLRow {
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
    // Verificar autenticação
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
    const formato = searchParams.get('formato') || 'pdf';

    if (!mesAno) {
      return NextResponse.json({ error: 'Período (mesAno) é obrigatório' }, { status: 400 });
    }

    // Parse mês e ano
    const [ano, mes] = mesAno.split('-').map(Number);
    if (!ano || !mes || mes < 1 || mes > 12) {
      return NextResponse.json({ error: 'Formato de data inválido. Use YYYY-MM' }, { status: 400 });
    }

    // Conectar ao MySQL
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

      // Query baseada no AS302.PRG com filtros de pensionistas (codtipo = 3 ou 4)
      // ORDER BY: associado, matricula, sequencia, nrseq
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
          AND (s.codtipo = '3' OR s.codtipo = '4')
      `;

      const params: any[] = [ano, mes];

      // Filtro opcional por código do convênio (AS302.PRG line 2)
      if (codigoConvenio) {
        query += ` AND TRIM(p.codconven) = ?`;
        params.push(codigoConvenio);
      }

      // ORDER BY conforme AS302.PRG
      query += ` ORDER BY p.associado, p.matricula, p.sequencia, p.nrseq`;

      const [rows] = await connection.execute(query, params);
      const parcelas = rows as PensionistaMySQLRow[];

      if (parcelas.length === 0) {
        return NextResponse.json({ 
          error: 'Nenhuma parcela de pensionistas encontrada para o período selecionado' 
        }, { status: 404 });
      }

      // Agrupar por matrícula
      const grupos = new Map<string, {
        matricula: string;
        associado: string;
        codTipo: string;
        parcelas: PensionistaMySQLRow[];
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

      // Gerar relatório conforme formato
      if (formato === 'pdf') {
        const pdfBuffer = await gerarPDF(Array.from(grupos.values()), mesAno);
        return new NextResponse(pdfBuffer as unknown as BodyInit, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="pensionistas-mysql-${mesAno}.pdf"`,
          },
        });
      } else if (formato === 'excel') {
        const excelBuffer = await gerarExcel(Array.from(grupos.values()), mesAno);
        return new NextResponse(excelBuffer as unknown as BodyInit, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="pensionistas-mysql-${mesAno}.xlsx"`,
          },
        });
      } else if (formato === 'csv') {
        const delimiter = searchParams.get('delimiter') || ';';
        const encoding = searchParams.get('encoding') || 'utf-8';
        const includeHeader = searchParams.get('includeHeader') !== 'false';
        const decimalSeparator = searchParams.get('decimalSeparator') || ',';
        
        const csvContent = gerarCSV(Array.from(grupos.values()), mesAno, {
          delimiter,
          includeHeader,
          decimalSeparator,
        });
        
        const buffer = encoding === 'iso-8859-1'
          ? iconv.encode(csvContent, 'iso-8859-1')
          : Buffer.from(csvContent, 'utf-8');
        
        return new NextResponse(buffer as unknown as BodyInit, {
          headers: {
            'Content-Type': 'text/csv; charset=' + encoding,
            'Content-Disposition': `attachment; filename="pensionistas-mysql-${mesAno}.csv"`,
          },
        });
      }

      return NextResponse.json({ error: 'Formato inválido. Use pdf, excel ou csv' }, { status: 400 });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Erro ao gerar relatório de Pensionistas MySQL:', error);
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
  doc.text(`DEBITOS PENSIONISTAS - MySQL (AS302)`, pageWidth / 2, y, { align: 'center' });
  
  y += 6;
  doc.setFontSize(10);
  doc.text(`Periodo: ${mesAno} | Apenas Tipo 3 e 4 | Parcelas em Aberto`, pageWidth / 2, y, { align: 'center' });
  
  y += 10;

  // Cabeçalho
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

  // Dados
  doc.setFont('Courier', 'normal');
  
  for (const grupo of grupos) {
    let totalGrupo = 0;
    let firstLine = true;

    for (const parcela of grupo.parcelas) {
      // Nova página se necessário
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
        
        // Reescrever cabeçalho
        doc.setFont('Courier', 'bold');
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
      }

      const valor = parseFloat(parcela.valor?.toString() || '0');
      totalGrupo += valor;

      // Matrícula, Associado e Tipo apenas na primeira linha
      if (firstLine) {
        doc.text(grupo.matricula || '', 10, y);
        doc.text((grupo.associado || '').substring(0, 25), 35, y);
        doc.text(grupo.codTipo || '', 90, y);
        firstLine = false;
      }

      // Conveniado (código + nome)
      const conveniadoTexto = `${parcela.convenio_codigo || ''} - ${(parcela.convenio_nome || '').substring(0, 35)}`;
      doc.text(conveniadoTexto, 100, y);

      // Pc (parcela atual) e De (total de parcelas)
      doc.text(parcela.num_parcela?.toString().padStart(2, '0') || '00', 190, y);
      doc.text(parcela.qtd_parcelas?.toString().padStart(2, '0') || '00', 200, y);

      // Valor
      doc.text(valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), 225, y, { align: 'right' });

      y += 5;
    }

    // Total do grupo
    doc.setFont('Courier', 'bold');
    doc.text(totalGrupo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), 260, y - 5, { align: 'right' });
    doc.setFont('Courier', 'normal');
    y += 2;
  }

  // Total geral
  const totalGeral = grupos.reduce((sum, grupo) => 
    sum + grupo.parcelas.reduce((s: number, p: PensionistaMySQLRow) => s + parseFloat(p.valor?.toString() || '0'), 0), 0
  );

  y += 5;
  doc.setFont('Courier', 'bold');
  doc.text(`TOTAL GERAL: R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 30, y, { align: 'right' });

  const pdfBlob = doc.output('arraybuffer');
  return pdfBlob;
}

async function gerarExcel(grupos: any[], mesAno: string): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Pensionistas MySQL');

  // Título
  worksheet.mergeCells('A1:I1');
  worksheet.getCell('A1').value = 'DEBITOS PENSIONISTAS - MySQL (AS302)';
  worksheet.getCell('A1').font = { bold: true, size: 14 };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.mergeCells('A2:I2');
  worksheet.getCell('A2').value = `Periodo: ${mesAno} | Apenas Tipo 3 e 4 | Parcelas em Aberto`;
  worksheet.getCell('A2').alignment = { horizontal: 'center' };

  // Cabeçalho
  const headerRow = worksheet.addRow([
    'Matrícula',
    'Associado',
    'Tipo',
    'Conveniado',
    'Pc',
    'De',
    'Valor',
    'Total',
  ]);
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFA500' } // Laranja para pensionistas
    };
  });

  // Dados
  for (const grupo of grupos) {
    let totalGrupo = 0;
    let firstLine = true;

    for (const parcela of grupo.parcelas) {
      const valor = parseFloat(parcela.valor?.toString() || '0');
      totalGrupo += valor;

      const row = worksheet.addRow([
        firstLine ? (grupo.matricula || '') : '',
        firstLine ? (grupo.associado || '') : '',
        firstLine ? (grupo.codTipo || '') : '',
        `${parcela.convenio_codigo || ''} - ${parcela.convenio_nome || ''}`,
        parcela.num_parcela,
        parcela.qtd_parcelas,
        valor,
        '',
      ]);

      // Formatar valor
      row.getCell(7).numFmt = 'R$ #,##0.00';
      
      firstLine = false;
    }

    // Total do grupo
    const lastRow = worksheet.lastRow;
    if (lastRow) {
      lastRow.getCell(8).value = totalGrupo;
      lastRow.getCell(8).numFmt = 'R$ #,##0.00';
      lastRow.getCell(8).font = { bold: true };
    }
  }

  // Total geral
  const totalGeral = grupos.reduce((sum, grupo) => 
    sum + grupo.parcelas.reduce((s: number, p: PensionistaMySQLRow) => s + parseFloat(p.valor?.toString() || '0'), 0), 0
  );

  const totalRow = worksheet.addRow(['', '', '', '', '', '', '', totalGeral]);
  totalRow.getCell(7).value = 'TOTAL GERAL:';
  totalRow.getCell(7).font = { bold: true };
  totalRow.getCell(8).numFmt = 'R$ #,##0.00';
  totalRow.getCell(8).font = { bold: true };

  // Ajustar larguras
  worksheet.columns = [
    { width: 12 },
    { width: 30 },
    { width: 5 },
    { width: 40 },
    { width: 5 },
    { width: 5 },
    { width: 12 },
    { width: 12 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

function gerarCSV(
  grupos: any[], 
  mesAno: string,
  options: {
    delimiter: string;
    includeHeader: boolean;
    decimalSeparator: string;
  }
): string {
  const { delimiter, includeHeader, decimalSeparator } = options;
  const lines: string[] = [];
  
  // Cabeçalho
  if (includeHeader) {
    lines.push([
      'Matricula',
      'Associado',
      'Tipo',
      'Conveniado',
      'Parcela',
      'Total_Parcelas',
      'Valor',
    ].join(delimiter));
  }
  
  // Dados
  grupos.forEach((grupo) => {
    grupo.parcelas.forEach((parcela: any) => {
      const valor = parseFloat(parcela.valor?.toString() || '0');
      const valorFormatado = decimalSeparator === ','
        ? valor.toFixed(2).replace('.', ',')
        : valor.toFixed(2);
      
      const row = [
        grupo.matricula,
        `"${grupo.associado}"`,
        grupo.codTipo,
        `"${parcela.convenio_codigo || ''} - ${parcela.convenio_nome || ''}"`,
        parcela.num_parcela.toString(),
        parcela.qtd_parcelas.toString(),
        valorFormatado,
      ];
      
      lines.push(row.join(delimiter));
    });
  });
  
  // Total geral
  const totalGeral = grupos.reduce((sum, grupo) => 
    sum + grupo.parcelas.reduce((s: number, p: any) => s + parseFloat(p.valor?.toString() || '0'), 0), 0
  );
  
  const totalGeralFormatado = decimalSeparator === ','
    ? totalGeral.toFixed(2).replace('.', ',')
    : totalGeral.toFixed(2);
  
  lines.push([
    '',
    '',
    '',
    '',
    '',
    'TOTAL GERAL: ' + totalGeralFormatado,
    ''
  ].join(delimiter));
  
  return lines.join('\n');
}
