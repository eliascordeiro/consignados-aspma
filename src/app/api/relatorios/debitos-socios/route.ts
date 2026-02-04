import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';
import iconv from 'iconv-lite';

const prisma = new PrismaClient();

interface ParcelaRelatorio {
  id: string;
  numeroParcela: number;
  valor: number;
  dataVencimento: Date;
  baixa: string | null;
  venda: {
    numeroVenda: number;
    quantidadeParcelas: number;
    socio: {
      matricula: string | null;
      nome: string;
    };
    convenio: {
      codigo: string | null;
      razao_soc: string;
    } | null;
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

interface GrupoConvenio {
  convenioId: number;
  convenioNome: string;
  cnpj: string | null;
  agencia: string | null;
  conta: string | null;
  banco: string | null;
  parcelas: {
    socio: string;
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
    const socioMatricula = searchParams.get('socioMatricula');
    const agrupaPor = searchParams.get('agrupaPor') || 'socio'; // 'socio' ou 'convenio'
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

    // Adiciona filtro de convênio e/ou sócio se especificado
    if (convenioId || socioMatricula) {
      const vendaFilter: any = {};
      
      if (convenioId) {
        vendaFilter.convenio = {
          id: parseInt(convenioId),
        };
      }
      
      if (socioMatricula) {
        vendaFilter.socio = {
          matricula: socioMatricula,
        };
      }
      
      where.venda = vendaFilter;
    }

    console.log('Filtros aplicados:', JSON.stringify(where, null, 2));

    const parcelas = await prisma.parcela.findMany({
      where,
      include: {
        venda: {
          select: {
            numeroVenda: true,
            quantidadeParcelas: true,
            socio: {
              select: {
                matricula: true,
                nome: true,
              },
            },
            convenio: {
              select: {
                id: true,
                codigo: true,
                razao_soc: true,
                cnpj: true,
                agencia: true,
                conta: true,
                banco: true,
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
    });

    if (parcelas.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma parcela encontrada para o período selecionado' },
        { status: 404 }
      );
    }

    // Agrupar por sócio ou convênio
    if (agrupaPor === 'convenio') {
      const gruposConvenio = agruparPorConvenio(parcelas);
      
      if (formato === 'pdf') {
        const pdfBuffer = await gerarPDFConvenio(gruposConvenio, mes, ano);
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="debitos-convenios-${mesAno}.pdf"`,
          },
        });
      } else if (formato === 'excel') {
        const excelBuffer = await gerarExcelConvenio(gruposConvenio, mes, ano);
        return new NextResponse(excelBuffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="debitos-convenios-${mesAno}.xlsx"`,
          },
        });
      } else if (formato === 'csv') {
        const delimiter = searchParams.get('delimiter') || ';';
        const encoding = searchParams.get('encoding') || 'utf-8';
        const includeHeader = searchParams.get('includeHeader') !== 'false';
        const decimalSeparator = searchParams.get('decimalSeparator') || ',';
        
        const csvContent = gerarCSVConvenio(gruposConvenio, mes, ano, {
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
            'Content-Disposition': `attachment; filename="debitos-convenios-${mesAno}.csv"`,
          },
        });
      }
    } else {
      // Agrupar por sócio (lógica existente)
      const grupos = agruparPorSocio(parcelas);

      // Gerar PDF, Excel ou CSV para sócios
      if (formato === 'pdf') {
        const pdfBuffer = await gerarPDF(grupos, mes, ano);
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="debitos-socios-${mesAno}.pdf"`,
          },
        });
      } else if (formato === 'excel') {
        const excelBuffer = await gerarExcel(grupos, mes, ano);
        return new NextResponse(excelBuffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="debitos-socios-${mesAno}.xlsx"`,
          },
        });
      } else if (formato === 'csv') {
        const delimiter = searchParams.get('delimiter') || ';';
        const encoding = searchParams.get('encoding') || 'utf-8';
        const includeHeader = searchParams.get('includeHeader') !== 'false';
        const decimalSeparator = searchParams.get('decimalSeparator') || ',';
        
        const csvContent = gerarCSV(grupos, mes, ano, {
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
            'Content-Disposition': `attachment; filename="debitos-socios-${mesAno}.csv"`,
          },
        });
      }
    }
    
    return NextResponse.json({ error: 'Formato inválido. Use pdf, excel ou csv' }, { status: 400 });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar relatório' },
      { status: 500 }
    );
  }
}

async function gerarPDF(grupos: GrupoSocio[], mes: number, ano: number): Promise<ArrayBuffer> {
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
    doc.text('Associado', 35, y);
    doc.text('Conveniado', 105, y);
    doc.text('Pc', 190, y);
    doc.text('De', 200, y);
    doc.text('Valor', 225, y, { align: 'right' });
    doc.text('Total', 260, y, { align: 'right' });
    doc.text('St', 275, y);
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

      // Associado - só na primeira linha do grupo
      if (index === 0) {
        doc.text(grupo.nome, 35, y);
      }

      // Conveniado
      doc.text(parcela.convenio, 105, y);

      // Pc (2 dígitos)
      doc.text(parcela.pc.toString().padStart(2, '0'), 190, y);

      // De (2 dígitos)
      doc.text(parcela.de.toString().padStart(2, '0'), 200, y);

      // Valor
      const valorFormatado = parcela.valor.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      doc.text(valorFormatado, 225, y, { align: 'right' });

      // Total - só na última linha do grupo
      if (index === grupo.parcelas.length - 1) {
        const totalFormatado = grupo.total.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        doc.text(totalFormatado, 260, y, { align: 'right' });
      }

      // St
      doc.text(parcela.st, 275, y);

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
  doc.text('TOTAL GERAL:', 195, y);
  const totalGeralFormatado = totalGeral.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  doc.text(totalGeralFormatado, 260, y, { align: 'right' });

  return doc.output('arraybuffer') as ArrayBuffer;
}

async function gerarExcel(grupos: GrupoSocio[], mes: number, ano: number): Promise<ArrayBuffer> {
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
  // Converte Buffer para ArrayBuffer
  const uint8Array = new Uint8Array(buffer);
  return uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);
}

function gerarCSV(
  grupos: GrupoSocio[], 
  mes: number, 
  ano: number,
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
      'Conveniado',
      'Parcela',
      'Total_Parcelas',
      'Valor',
      'Total_Socio',
      'Status'
    ].join(delimiter));
  }
  
  // Dados
  let totalGeral = 0;
  
  grupos.forEach((grupo) => {
    grupo.parcelas.forEach((parcela, index) => {
      const valorFormatado = decimalSeparator === ','
        ? parcela.valor.toFixed(2).replace('.', ',')
        : parcela.valor.toFixed(2);
      
      const totalFormatado = index === grupo.parcelas.length - 1
        ? (decimalSeparator === ',' ? grupo.total.toFixed(2).replace('.', ',') : grupo.total.toFixed(2))
        : '';
      
      const row = [
        grupo.matricula, // Repetir em todas as linhas
        `"${grupo.nome}"`, // Repetir em todas as linhas - Aspas para nomes com vírgula
        `"${parcela.convenio}"`, // Aspas para convênios com vírgula
        parcela.pc.toString(),
        parcela.de.toString(),
        valorFormatado,
        totalFormatado,
        parcela.st
      ];
      
      lines.push(row.join(delimiter));
    });
    
    totalGeral += grupo.total;
  });
  
  // Total geral
  const totalGeralFormatado = decimalSeparator === ','
    ? totalGeral.toFixed(2).replace('.', ',')
    : totalGeral.toFixed(2);
  
  lines.push([
    '',
    '',
    '',
    '',
    '',
    'TOTAL GERAL:',
    totalGeralFormatado,
    ''
  ].join(delimiter));
  
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// FUNÇÕES DE AGRUPAMENTO
// ═══════════════════════════════════════════════════════════════════

function agruparPorSocio(parcelas: any[]): GrupoSocio[] {
  const grupos: Map<string, GrupoSocio> = new Map();

  parcelas.forEach((parcela) => {
    const matricula = parcela.venda.socio.matricula || '';
    
    if (!grupos.has(matricula)) {
      grupos.set(matricula, {
        matricula,
        nome: parcela.venda.socio.nome,
        parcelas: [],
        total: 0,
      });
    }

    const grupo = grupos.get(matricula)!;
    const convenioTexto = parcela.venda.convenio 
      ? `${parcela.venda.convenio.codigo || ''} - ${parcela.venda.convenio.razao_soc}`
      : 'Sem convênio';
    
    grupo.parcelas.push({
      convenio: convenioTexto,
      pc: parcela.numeroParcela,
      de: parcela.venda.quantidadeParcelas,
      valor: Number(parcela.valor),
      st: parcela.baixa ? 'OK' : '',
    });
    grupo.total += Number(parcela.valor);
  });

  return Array.from(grupos.values());
}

function agruparPorConvenio(parcelas: any[]): GrupoConvenio[] {
  const grupos: Map<number, GrupoConvenio> = new Map();

  parcelas.forEach((parcela) => {
    if (!parcela.venda.convenio) return; // Ignora parcelas sem convênio
    
    const convenioId = parcela.venda.convenio.id;
    
    if (!grupos.has(convenioId)) {
      grupos.set(convenioId, {
        convenioId,
        convenioNome: parcela.venda.convenio.razao_soc,
        cnpj: parcela.venda.convenio.cnpj,
        agencia: parcela.venda.convenio.agencia,
        conta: parcela.venda.convenio.conta,
        banco: parcela.venda.convenio.banco,
        parcelas: [],
        total: 0,
      });
    }

    const grupo = grupos.get(convenioId)!;
    const socioTexto = `${parcela.venda.socio.matricula || ''} - ${parcela.venda.socio.nome}`;
    
    grupo.parcelas.push({
      socio: socioTexto,
      pc: parcela.numeroParcela,
      de: parcela.venda.quantidadeParcelas,
      valor: Number(parcela.valor),
      st: parcela.baixa ? 'OK' : '',
    });
    grupo.total += Number(parcela.valor);
  });

  return Array.from(grupos.values());
}

// ═══════════════════════════════════════════════════════════════════
// GERADORES DE RELATÓRIO POR CONVÊNIO
// ═══════════════════════════════════════════════════════════════════

async function gerarPDFConvenio(grupos: GrupoConvenio[], mes: number, ano: number): Promise<ArrayBuffer> {
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

  const addHeader = () => {
    y = 20;
    doc.setFontSize(14);
    doc.setFont('courier', 'bold');
    doc.text('DÉBITOS POR CONVÊNIO', 148, y, { align: 'center' });
    y += 7;
    doc.setFontSize(10);
    doc.text(`Período: ${mesNomes[mes - 1]}/${ano}`, 148, y, { align: 'center' });
    y += 10;
  };

  addHeader();

  let totalGeral = 0;

  grupos.forEach((grupo, grupoIndex) => {
    // Verifica quebra de página para cabeçalho do grupo
    if (y > pageHeight - 40) {
      doc.addPage();
      addHeader();
    }

    // Cabeçalho do convênio
    doc.setFontSize(10);
    doc.setFont('courier', 'bold');
    doc.text(`Convênio: ${grupo.convenioNome}`, 10, y);
    y += 5;
    
    if (grupo.cnpj) {
      doc.setFont('courier', 'normal');
      doc.text(`CNPJ: ${grupo.cnpj}`, 10, y);
      y += 5;
    }
    
    if (grupo.banco || grupo.agencia || grupo.conta) {
      doc.setFont('courier', 'normal');
      const dadosBancarios = [
        grupo.banco ? `Banco: ${grupo.banco}` : '',
        grupo.agencia ? `Ag: ${grupo.agencia}` : '',
        grupo.conta ? `Conta: ${grupo.conta}` : ''
      ].filter(d => d).join(' | ');
      doc.text(dadosBancarios, 10, y);
      y += 5;
    }
    
    y += 2;

    // Cabeçalho da tabela
    doc.setFontSize(8);
    doc.setFont('courier', 'bold');
    doc.text('Sócio', 10, y);
    doc.text('Pc', 190, y);
    doc.text('De', 200, y);
    doc.text('Valor', 225, y, { align: 'right' });
    doc.text('Total', 260, y, { align: 'right' });
    doc.text('St', 275, y);
    y += 3;
    doc.line(10, y, 280, y);
    y += 5;

    doc.setFont('courier', 'normal');

    grupo.parcelas.forEach((parcela, index) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        addHeader();
      }

      // Sócio
      doc.text(parcela.socio, 10, y);

      // Pc (2 dígitos)
      doc.text(parcela.pc.toString().padStart(2, '0'), 190, y);

      // De (2 dígitos)
      doc.text(parcela.de.toString().padStart(2, '0'), 200, y);

      // Valor
      const valorFormatado = parcela.valor.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      doc.text(valorFormatado, 225, y, { align: 'right' });

      // Total - só na última linha do grupo
      if (index === grupo.parcelas.length - 1) {
        const totalFormatado = grupo.total.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        doc.text(totalFormatado, 260, y, { align: 'right' });
      }

      // St
      doc.text(parcela.st, 275, y);

      y += 5;
    });

    totalGeral += grupo.total;
    y += 5; // Espaço entre grupos
  });

  // Total Geral
  if (y > pageHeight - 20) {
    doc.addPage();
    addHeader();
  }

  y += 5;
  doc.setFont('courier', 'bold');
  doc.text('TOTAL GERAL:', 195, y);
  const totalGeralFormatado = totalGeral.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  doc.text(totalGeralFormatado, 260, y, { align: 'right' });

  return doc.output('arraybuffer') as ArrayBuffer;
}

async function gerarExcelConvenio(grupos: GrupoConvenio[], mes: number, ano: number): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Débitos por Convênio');

  const mesNomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Título
  worksheet.mergeCells('A1:H1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'DÉBITOS POR CONVÊNIO';
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };

  // Período
  worksheet.mergeCells('A2:H2');
  const periodoCell = worksheet.getCell('A2');
  periodoCell.value = `Período: ${mesNomes[mes - 1]}/${ano}`;
  periodoCell.font = { bold: true, size: 11 };
  periodoCell.alignment = { horizontal: 'center' };

  let currentRow = 3;
  let totalGeral = 0;

  grupos.forEach((grupo) => {
    // Cabeçalho do convênio
    currentRow++;
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    const convenioCell = worksheet.getCell(`A${currentRow}`);
    convenioCell.value = `Convênio: ${grupo.convenioNome}`;
    convenioCell.font = { bold: true, size: 12 };
    convenioCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    currentRow++;

    // Dados bancários
    if (grupo.cnpj) {
      worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
      const cnpjCell = worksheet.getCell(`A${currentRow}`);
      cnpjCell.value = `CNPJ: ${grupo.cnpj}`;
      currentRow++;
    }

    if (grupo.banco || grupo.agencia || grupo.conta) {
      worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
      const bancarioCell = worksheet.getCell(`A${currentRow}`);
      const dadosBancarios = [
        grupo.banco ? `Banco: ${grupo.banco}` : '',
        grupo.agencia ? `Ag: ${grupo.agencia}` : '',
        grupo.conta ? `Conta: ${grupo.conta}` : ''
      ].filter(d => d).join(' | ');
      bancarioCell.value = dadosBancarios;
      currentRow++;
    }

    // Cabeçalho da tabela
    const headerRow = worksheet.addRow([
      'Sócio',
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
    currentRow++;

    // Dados
    grupo.parcelas.forEach((parcela, index) => {
      const row = worksheet.addRow([
        parcela.socio,
        parcela.pc,
        parcela.de,
        parcela.valor,
        index === grupo.parcelas.length - 1 ? grupo.total : '',
        parcela.st,
      ]);

      // Formatar valor
      row.getCell(4).numFmt = '#,##0.00';
      
      // Formatar total
      if (index === grupo.parcelas.length - 1) {
        row.getCell(5).numFmt = '#,##0.00';
        row.getCell(5).font = { bold: true };
      }
      currentRow++;
    });

    totalGeral += grupo.total;
    currentRow++; // Espaço entre grupos
  });

  // Total Geral
  const totalRow = worksheet.addRow([
    '',
    '',
    '',
    'TOTAL GERAL:',
    totalGeral,
    '',
  ]);
  totalRow.font = { bold: true };
  totalRow.getCell(5).numFmt = '#,##0.00';

  // Auto-ajustar colunas
  worksheet.columns = [
    { width: 50 }, // Sócio
    { width: 5 },  // Pc
    { width: 5 },  // De
    { width: 15 }, // Valor
    { width: 15 }, // Total
    { width: 5 },  // St
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const uint8Array = new Uint8Array(buffer);
  return uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);
}

function gerarCSVConvenio(
  grupos: GrupoConvenio[], 
  mes: number, 
  ano: number,
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
      'Convenio',
      'CNPJ',
      'Banco',
      'Agencia',
      'Conta',
      'Socio',
      'Parcela',
      'Total_Parcelas',
      'Valor',
      'Total_Convenio',
      'Status'
    ].join(delimiter));
  }
  
  // Dados
  let totalGeral = 0;
  
  grupos.forEach((grupo) => {
    grupo.parcelas.forEach((parcela, index) => {
      const valorFormatado = decimalSeparator === ','
        ? parcela.valor.toFixed(2).replace('.', ',')
        : parcela.valor.toFixed(2);
      
      const totalFormatado = index === grupo.parcelas.length - 1
        ? (decimalSeparator === ',' ? grupo.total.toFixed(2).replace('.', ',') : grupo.total.toFixed(2))
        : '';
      
      const row = [
        `"${grupo.convenioNome}"`,
        grupo.cnpj || '',
        grupo.banco || '',
        grupo.agencia || '',
        grupo.conta || '',
        `"${parcela.socio}"`,
        parcela.pc.toString(),
        parcela.de.toString(),
        valorFormatado,
        totalFormatado,
        parcela.st
      ];
      
      lines.push(row.join(delimiter));
    });
    
    totalGeral += grupo.total;
  });
  
  // Total geral
  const totalGeralFormatado = decimalSeparator === ','
    ? totalGeral.toFixed(2).replace('.', ',')
    : totalGeral.toFixed(2);
  
  lines.push([
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'TOTAL GERAL:',
    totalGeralFormatado,
    ''
  ].join(delimiter));
  
  return lines.join('\n');
}
