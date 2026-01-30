import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();

interface ParcelaRelatorio {
  id: number;
  numeroParcela: number;
  totalParcelas: number;
  valor: number;
  dataVencimento: Date;
  baixa: string | null;
  venda: {
    numeroVenda: string;
    socio: {
      matricula: string;
      nome: string;
    };
    convenio: {
      codigo: string;
      razao_soc: string;
    };
  };
}

interface GrupoSocio {
  matricula: string;
  nome: string;
  parcelas: {
    convenio: string;
    pc: number;
    de: number;
    valor: number;
    st: string;
  }[];
  total: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mesAno = searchParams.get('mesAno'); // formato: YYYY-MM
    const convenioId = searchParams.get('convenioId');
    const formato = searchParams.get('formato') || 'pdf'; // 'pdf' ou 'excel'

    if (!mesAno) {
      return NextResponse.json(
        { error: 'Parâmetro mesAno é obrigatório (formato: YYYY-MM)' },
        { status: 400 }
      );
    }

    // Parse mês e ano
    const [ano, mes] = mesAno.split('-').map(Number);
    if (!ano || !mes || mes < 1 || mes > 12) {
      return NextResponse.json(
        { error: 'Formato de mesAno inválido. Use YYYY-MM' },
        { status: 400 }
      );
    }

    // Data início e fim do mês
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59);

    // Buscar parcelas
    const where: any = {
      dataVencimento: {
        gte: dataInicio,
        lte: dataFim,
      },
    };

    if (convenioId) {
      where.venda = {
        convenioId: parseInt(convenioId),
      };
    }

    const parcelas = await prisma.parcela.findMany({
      where,
      include: {
        venda: {
          include: {
            socio: {
              select: {
                matricula: true,
                nome: true,
              },
            },
            convenio: {
              select: {
                codigo: true,
                razao_soc: true,
              },
            },
          },
        },
      },
      orderBy: [
        { venda: { socio: { matricula: 'asc' } } },
        { venda: { numeroVenda: 'asc' } },
        { numeroParcela: 'asc' },
      ],
    }) as ParcelaRelatorio[];

    if (parcelas.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma parcela encontrada para o período selecionado' },
        { status: 404 }
      );
    }

    // Agrupar por sócio
    const grupos: Map<string, GrupoSocio> = new Map();

    parcelas.forEach((parcela) => {
      const matricula = parcela.venda.socio.matricula;
      
      if (!grupos.has(matricula)) {
        grupos.set(matricula, {
          matricula,
          nome: parcela.venda.socio.nome,
          parcelas: [],
          total: 0,
        });
      }

      const grupo = grupos.get(matricula)!;
      grupo.parcelas.push({
        convenio: `${parcela.venda.convenio.codigo} - ${parcela.venda.convenio.razao_soc}`.substring(0, 38),
        pc: parcela.numeroParcela,
        de: parcela.totalParcelas,
        valor: parcela.valor,
        st: parcela.baixa ? 'OK' : '',
      });
      grupo.total += parcela.valor;
    });

    const gruposArray = Array.from(grupos.values());

    // Gerar PDF ou Excel
    if (formato === 'pdf') {
      const pdfBuffer = await gerarPDF(gruposArray, mes, ano);
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="debitos-socios-${mesAno}.pdf"`,
        },
      });
    } else {
      const excelBuffer = await gerarExcel(gruposArray, mes, ano);
      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="debitos-socios-${mesAno}.xlsx"`,
        },
      });
    }
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar relatório' },
      { status: 500 }
    );
  }
}

async function gerarPDF(grupos: GrupoSocio[], mes: number, ano: number): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const mesNomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  let y = 20;
  const pageHeight = doc.internal.pageSize.height;

  // Cabeçalho
  const addHeader = () => {
    y = 20;
    doc.setFontSize(14);
    doc.setFont('courier', 'bold');
    doc.text('DÉBITOS DE SÓCIOS', 148, y, { align: 'center' });
    y += 7;
    doc.setFontSize(10);
    doc.text(`Período: ${mesNomes[mes - 1]}/${ano}`, 148, y, { align: 'center' });
    y += 10;
    doc.setFontSize(8);
    doc.setFont('courier', 'bold');
    doc.text('Matrícula', 10, y);
    doc.text('Associado', 30, y);
    doc.text('Conveniado', 90, y);
    doc.text('Pc', 145, y);
    doc.text('De', 155, y);
    doc.text('Valor', 175, y, { align: 'right' });
    doc.text('Total', 210, y, { align: 'right' });
    doc.text('St', 230, y);
    y += 5;
    doc.line(10, y, 280, y);
    y += 5;
  };

  addHeader();

  let totalGeral = 0;

  grupos.forEach((grupo) => {
    doc.setFont('courier', 'normal');

    grupo.parcelas.forEach((parcela, index) => {
      // Verifica quebra de página
      if (y > pageHeight - 20) {
        doc.addPage();
        addHeader();
      }

      // Matrícula (8 dígitos) - só na primeira linha do grupo
      if (index === 0) {
        doc.text(grupo.matricula.padEnd(8, ' '), 10, y);
      }

      // Associado (40 chars) - só na primeira linha do grupo
      if (index === 0) {
        doc.text(grupo.nome.substring(0, 40).padEnd(40, ' '), 30, y);
      }

      // Conveniado (38 chars)
      doc.text(parcela.convenio.substring(0, 38).padEnd(38, ' '), 90, y);

      // Pc (2 dígitos)
      doc.text(parcela.pc.toString().padStart(2, '0'), 145, y);

      // De (2 dígitos)
      doc.text(parcela.de.toString().padStart(2, '0'), 155, y);

      // Valor
      const valorFormatado = parcela.valor.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      doc.text(valorFormatado, 175, y, { align: 'right' });

      // Total - só na última linha do grupo
      if (index === grupo.parcelas.length - 1) {
        const totalFormatado = grupo.total.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        doc.text(totalFormatado, 210, y, { align: 'right' });
      }

      // St
      doc.text(parcela.st, 230, y);

      y += 5;
    });

    totalGeral += grupo.total;
    y += 2; // Espaço entre grupos
  });

  // Total Geral
  if (y > pageHeight - 20) {
    doc.addPage();
    addHeader();
  }

  y += 5;
  doc.setFont('courier', 'bold');
  doc.text('TOTAL GERAL:', 145, y);
  const totalGeralFormatado = totalGeral.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  doc.text(totalGeralFormatado, 210, y, { align: 'right' });

  return Buffer.from(doc.output('arraybuffer'));
}

async function gerarExcel(grupos: GrupoSocio[], mes: number, ano: number): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Débitos de Sócios');

  const mesNomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Título
  worksheet.mergeCells('A1:H1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'DÉBITOS DE SÓCIOS';
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };

  // Período
  worksheet.mergeCells('A2:H2');
  const periodoCell = worksheet.getCell('A2');
  periodoCell.value = `Período: ${mesNomes[mes - 1]}/${ano}`;
  periodoCell.font = { bold: true, size: 11 };
  periodoCell.alignment = { horizontal: 'center' };

  // Cabeçalho
  const headerRow = worksheet.addRow([
    'Matrícula',
    'Associado',
    'Conveniado',
    'Pc',
    'De',
    'Valor',
    'Total',
    'St',
  ]);

  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD3D3D3' },
  };

  // Dados
  let totalGeral = 0;

  grupos.forEach((grupo) => {
    grupo.parcelas.forEach((parcela, index) => {
      const row = worksheet.addRow([
        index === 0 ? grupo.matricula : '',
        index === 0 ? grupo.nome : '',
        parcela.convenio,
        parcela.pc,
        parcela.de,
        parcela.valor,
        index === grupo.parcelas.length - 1 ? grupo.total : '',
        parcela.st,
      ]);

      // Formatar valor
      row.getCell(6).numFmt = '#,##0.00';
      
      // Formatar total
      if (index === grupo.parcelas.length - 1) {
        row.getCell(7).numFmt = '#,##0.00';
        row.getCell(7).font = { bold: true };
      }
    });

    totalGeral += grupo.total;
  });

  // Total Geral
  const totalRow = worksheet.addRow([
    '',
    '',
    '',
    '',
    '',
    'TOTAL GERAL:',
    totalGeral,
    '',
  ]);
  totalRow.font = { bold: true };
  totalRow.getCell(7).numFmt = '#,##0.00';

  // Auto-ajustar colunas
  worksheet.columns = [
    { width: 12 }, // Matrícula
    { width: 40 }, // Associado
    { width: 40 }, // Conveniado
    { width: 5 },  // Pc
    { width: 5 },  // De
    { width: 15 }, // Valor
    { width: 15 }, // Total
    { width: 5 },  // St
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
