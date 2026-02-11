import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';
import iconv from 'iconv-lite';
import { auth } from '@/lib/auth';
import { getDataUserId } from '@/lib/get-data-user-id';

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
    // Verificar autenticação
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar userId correto (herda dados do MANAGER se for subordinado)
    const dataUserId = await getDataUserId(session as any);

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

    // Buscar parcelas (filtrado pelo userId correto)
    const where: any = {
      dataVencimento: {
        gte: dataInicio,
        lte: dataFim,
      },
      venda: {
        userId: dataUserId,
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
      const isRelatorioGeral = !convenioId; // Relatório geral quando não há filtro de convênio
      
      if (formato === 'pdf') {
        const pdfBuffer = await gerarPDFConvenio(gruposConvenio, mes, ano, isRelatorioGeral);
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="debitos-convenios-${mesAno}.pdf"`,
          },
        });
      } else if (formato === 'excel') {
        const excelBuffer = await gerarExcelConvenio(gruposConvenio, mes, ano, isRelatorioGeral);
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
        }, isRelatorioGeral);
        
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

  // Cores (RGB)
  const colors = {
    primary: [41, 128, 185],      // Azul profissional
    secondary: [52, 73, 94],      // Cinza escuro
    accent: [231, 76, 60],        // Vermelho destaque
    success: [39, 174, 96],       // Verde
    lightGray: [236, 240, 241],   // Cinza claro
    darkGray: [127, 140, 141],    // Cinza médio
    white: [255, 255, 255],       // Branco
    tableHeader: [52, 152, 219],  // Azul tabela
    tableAlt: [245, 247, 250],    // Linha alternada
  };

  let y = 15;
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 10;
  let pageNumber = 1;

  // Função auxiliar para adicionar rodapé
  const addFooter = () => {
    doc.setFontSize(8);
    doc.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
    doc.setFont('helvetica', 'normal');
    const footerText = `Página ${pageNumber} • Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`;
    doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.setDrawColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pageNumber++;
  };

  // Cabeçalho principal da página
  const addHeader = (isFirstPage = false) => {
    if (isFirstPage) {
      // Cabeçalho completo apenas na primeira página
      y = 15;
      
      // Faixa superior colorida
      doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.rect(0, 0, pageWidth, 25, 'F');
      
      // Título principal
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('RELATÓRIO DE DÉBITOS', pageWidth / 2, 12, { align: 'center' });
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Agrupamento por Sócio', pageWidth / 2, 18, { align: 'center' });
      
      // Box de período
      y = 30;
      doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
      doc.roundedRect(pageWidth / 2 - 35, y - 5, 70, 10, 2, 2, 'F');
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`PERÍODO: ${mesNomes[mes - 1].toUpperCase()}/${ano}`, pageWidth / 2, y, { align: 'center' });
      
      y += 12;
    } else {
      // Cabeçalho reduzido para demais páginas
      y = 8;
      
      // Faixa superior compacta
      doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.rect(0, 0, pageWidth, 12, 'F');
      
      // Título compacto
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Débitos - ${mesNomes[mes - 1]}/${ano} - Agrupamento por Sócio`, pageWidth / 2, 7, { align: 'center' });
      
      y += 7;
    }
  };

  addHeader(true);
  let totalGeral = 0;
  let isFirstGroup = true;

  grupos.forEach((grupo) => {
    // Verifica espaço necessário para o grupo (mínimo 40mm)
    const espacoNecessario = 40;
    if (y > pageHeight - espacoNecessario) {
      addFooter();
      doc.addPage();
      addHeader(false); // Cabeçalho reduzido nas páginas seguintes
      isFirstGroup = true;
    }

    // Separador entre grupos (exceto o primeiro)
    if (!isFirstGroup) {
      y += 3;
      doc.setDrawColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;
    }
    isFirstGroup = false;

    // ═══════════════════════════════════════════════════════════
    // CARD DO SÓCIO
    // ═══════════════════════════════════════════════════════════
    
    // Box de fundo do sócio
    doc.setFillColor(colors.tableHeader[0], colors.tableHeader[1], colors.tableHeader[2]);
    doc.roundedRect(margin, y, pageWidth - 2 * margin, 12, 2, 2, 'F');
    
    // Matrícula e Nome do sócio
    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('SÓCIO:', margin + 3, y + 5);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Matrícula: ${grupo.matricula}`, margin + 20, y + 5);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const nomeText = grupo.nome.length > 80 ? grupo.nome.substring(0, 77) + '...' : grupo.nome;
    doc.text(nomeText.toUpperCase(), margin + 3, y + 9);
    
    y += 15;

    // ═══════════════════════════════════════════════════════════
    // TABELA DE PARCELAS
    // ═══════════════════════════════════════════════════════════
    
    // Cabeçalho da tabela
    doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.rect(margin, y - 3, pageWidth - 2 * margin, 7, 'F');
    
    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    
    // Colunas da tabela
    const col1 = margin + 3;              // Conveniado
    const col2 = pageWidth - 100;         // Parcela
    const col3 = pageWidth - 85;          // De
    const col4 = pageWidth - 55;          // Valor
    const col5 = pageWidth - 15;          // Status
    
    doc.text('CONVENIADO', col1, y + 1.5);
    doc.text('PARC.', col2, y + 1.5);
    doc.text('DE', col3, y + 1.5);
    doc.text('VALOR', col4, y + 1.5, { align: 'right' });
    doc.text('ST', col5, y + 1.5);
    
    y += 7;
    
    // Linhas de dados
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    let isAlternate = false;
    
    grupo.parcelas.forEach((parcela, index) => {
      // Verificar quebra de página
      if (y > pageHeight - 30) {
        addFooter();
        doc.addPage();
        addHeader(false); // Cabeçalho reduzido nas páginas seguintes
        
        // Repetir info do sócio e cabeçalho da tabela na nova página
        doc.setFillColor(colors.tableHeader[0], colors.tableHeader[1], colors.tableHeader[2]);
        doc.roundedRect(margin, y, pageWidth - 2 * margin, 12, 2, 2, 'F');
        doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('SÓCIO:', margin + 3, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Matrícula: ${grupo.matricula}`, margin + 20, y + 5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(nomeText.toUpperCase(), margin + 3, y + 9);
        y += 15;
        
        // Cabeçalho da tabela
        doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        doc.rect(margin, y - 3, pageWidth - 2 * margin, 7, 'F');
        doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
        doc.setFont('helvetica', 'bold');
        doc.text('CONVENIADO', col1, y + 1.5);
        doc.text('PARC.', col2, y + 1.5);
        doc.text('DE', col3, y + 1.5);
        doc.text('VALOR', col4, y + 1.5, { align: 'right' });
        doc.text('ST', col5, y + 1.5);
        y += 7;
        
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        doc.setFont('helvetica', 'normal');
        isAlternate = false;
      }
      
      // Fundo alternado para melhor leitura
      if (isAlternate) {
        doc.setFillColor(colors.tableAlt[0], colors.tableAlt[1], colors.tableAlt[2]);
        doc.rect(margin, y - 3, pageWidth - 2 * margin, 6, 'F');
      }
      
      // Conveniado
      const convenioText = parcela.convenio.length > 100 ? parcela.convenio.substring(0, 97) + '...' : parcela.convenio;
      doc.text(convenioText, col1, y + 1);
      
      // Parcela (formato: 01)
      doc.text(parcela.pc.toString().padStart(2, '0'), col2, y + 1);
      
      // De (formato: 12)
      doc.text(parcela.de.toString().padStart(2, '0'), col3, y + 1);
      
      // Valor
      const valorFormatado = parcela.valor.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      doc.setFont('helvetica', 'bold');
      doc.text(`R$ ${valorFormatado}`, col4, y + 1, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      
      // Status
      if (parcela.st === 'OK') {
        doc.setTextColor(colors.success[0], colors.success[1], colors.success[2]);
        doc.setFont('helvetica', 'bold');
        doc.text('✓', col5, y + 1);
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        doc.setFont('helvetica', 'normal');
      }
      
      y += 6;
      isAlternate = !isAlternate;
    });
    
    // ═══════════════════════════════════════════════════════════
    // TOTAL DO SÓCIO
    // ═══════════════════════════════════════════════════════════
    
    y += 2;
    doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.rect(pageWidth - margin - 90, y - 3, 90, 8, 'F');
    
    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('TOTAL DO SÓCIO:', pageWidth - margin - 87, y + 2);
    
    const totalFormatado = grupo.total.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    doc.setFontSize(10);
    doc.text(`R$ ${totalFormatado}`, pageWidth - margin - 3, y + 2, { align: 'right' });
    
    y += 10;
    totalGeral += grupo.total;
  });

  // ═══════════════════════════════════════════════════════════
  // TOTAL GERAL
  // ═══════════════════════════════════════════════════════════
  
  if (y > pageHeight - 35) {
    addFooter();
    doc.addPage();
    addHeader();
  }
  
  y += 5;
  
  // Box de total geral destacado
  doc.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
  doc.roundedRect(pageWidth / 2 - 60, y - 4, 120, 12, 2, 2, 'F');
  
  doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL GERAL:', pageWidth / 2 - 52, y + 3);
  
  const totalGeralFormatado = totalGeral.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  doc.setFontSize(13);
  doc.text(`R$ ${totalGeralFormatado}`, pageWidth / 2 + 52, y + 3, { align: 'right' });
  
  // Informações adicionais
  y += 18;
  doc.setFontSize(7);
  doc.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
  doc.setFont('helvetica', 'italic');
  const totalSocios = grupos.length;
  const totalParcelas = grupos.reduce((sum, g) => sum + g.parcelas.length, 0);
  doc.text(`Total de Sócios: ${totalSocios} • Total de Parcelas: ${totalParcelas}`, pageWidth / 2, y, { align: 'center' });
  
  // Adicionar rodapé na última página
  addFooter();

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

  // Ordenar por razão social (ordem alfabética)
  return Array.from(grupos.values()).sort((a, b) => 
    a.convenioNome.localeCompare(b.convenioNome, 'pt-BR', { sensitivity: 'base' })
  );
}

// ═══════════════════════════════════════════════════════════════════
// GERADORES DE RELATÓRIO POR CONVÊNIO
// ═══════════════════════════════════════════════════════════════════

async function gerarPDFConvenio(grupos: GrupoConvenio[], mes: number, ano: number, isRelatorioGeral: boolean = false): Promise<ArrayBuffer> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const mesNomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Cores (RGB)
  const colors = {
    primary: [41, 128, 185],      // Azul profissional
    secondary: [52, 73, 94],      // Cinza escuro
    accent: [231, 76, 60],        // Vermelho destaque
    success: [39, 174, 96],       // Verde
    lightGray: [236, 240, 241],   // Cinza claro
    darkGray: [127, 140, 141],    // Cinza médio
    white: [255, 255, 255],       // Branco
    tableHeader: [52, 152, 219],  // Azul tabela
    tableAlt: [245, 247, 250],    // Linha alternada
  };

  let y = 15;
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 10;
  let pageNumber = 1;

  // Função auxiliar para adicionar rodapé
  const addFooter = () => {
    doc.setFontSize(8);
    doc.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
    doc.setFont('helvetica', 'normal');
    const footerText = `Página ${pageNumber} • Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`;
    doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.setDrawColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pageNumber++;
  };

  // Cabeçalho principal da página
  const addHeader = (isFirstPage = false) => {
    y = 15;
    
    // Faixa superior colorida
    doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.rect(0, 0, pageWidth, 25, 'F');
    
    // Título principal
    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('RELATÓRIO DE DÉBITOS', pageWidth / 2, 12, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Agrupamento por Convênio', pageWidth / 2, 18, { align: 'center' });
    
    // Box de período
    y = 30;
    doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.roundedRect(pageWidth / 2 - 35, y - 5, 70, 10, 2, 2, 'F');
    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`PERÍODO: ${mesNomes[mes - 1].toUpperCase()}/${ano}`, pageWidth / 2, y, { align: 'center' });
    
    y += 12;
  };

  addHeader(true);
  let totalGeral = 0;
  let isFirstGroup = true;

  // ═══════════════════════════════════════════════════════════
  // MODO RESUMIDO (RELATÓRIO GERAL - SEM SÓCIOS)
  // ═══════════════════════════════════════════════════════════
  if (isRelatorioGeral) {
    // Cabeçalho da tabela resumida
    doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.rect(margin, y - 3, pageWidth - 2 * margin, 7, 'F');
    
    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    
    const colConv = margin + 3;
    const colCNPJ = margin + 90;
    const colBanco = margin + 130;
    const colAg = margin + 180;
    const colConta = margin + 210;
    const colTotal = pageWidth - margin - 5;
    
    doc.text('CONVÊNIO', colConv, y + 1.5);
    doc.text('CNPJ', colCNPJ, y + 1.5);
    doc.text('BANCO', colBanco, y + 1.5);
    doc.text('AG', colAg, y + 1.5);
    doc.text('CONTA', colConta, y + 1.5);
    doc.text('TOTAL', colTotal, y + 1.5, { align: 'right' });
    
    y += 7;
    
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    let isAlternate = false;
    
    grupos.forEach((grupo) => {
      // Verificar quebra de página
      if (y > pageHeight - 30) {
        addFooter();
        doc.addPage();
        addHeader();
        
        // Repetir cabeçalho da tabela
        doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        doc.rect(margin, y - 3, pageWidth - 2 * margin, 7, 'F');
        doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('CONVÊNIO', colConv, y + 1.5);
        doc.text('CNPJ', colCNPJ, y + 1.5);
        doc.text('BANCO', colBanco, y + 1.5);
        doc.text('AG', colAg, y + 1.5);
        doc.text('CONTA', colConta, y + 1.5);
        doc.text('TOTAL', colTotal, y + 1.5, { align: 'right' });
        y += 7;
        
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        isAlternate = false;
      }
      
      // Fundo alternado
      if (isAlternate) {
        doc.setFillColor(colors.tableAlt[0], colors.tableAlt[1], colors.tableAlt[2]);
        doc.rect(margin, y - 3, pageWidth - 2 * margin, 6, 'F');
      }
      
      // Convênio
      const convText = grupo.convenioNome.length > 50 ? grupo.convenioNome.substring(0, 47) + '...' : grupo.convenioNome;
      doc.text(convText, colConv, y + 1);
      
      // CNPJ
      doc.text(grupo.cnpj || '-', colCNPJ, y + 1);
      
      // Banco
      doc.text(grupo.banco || '-', colBanco, y + 1);
      
      // Agência
      doc.text(grupo.agencia || '-', colAg, y + 1);
      
      // Conta
      doc.text(grupo.conta || '-', colConta, y + 1);
      
      // Total
      const totalFormatado = grupo.total.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      doc.setFont('helvetica', 'bold');
      doc.text(`R$ ${totalFormatado}`, colTotal, y + 1, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      
      totalGeral += grupo.total;
      y += 6;
      isAlternate = !isAlternate;
    });
    
  } else {
    // ═══════════════════════════════════════════════════════════
    // MODO DETALHADO (CONVÊNIO ESPECÍFICO - COM SÓCIOS)
    // ═══════════════════════════════════════════════════════════

  grupos.forEach((grupo, grupoIndex) => {
    // Verifica espaço necessário para o grupo (mínimo 50mm)
    const espacoNecessario = 50;
    if (y > pageHeight - espacoNecessario) {
      addFooter();
      doc.addPage();
      addHeader();
      isFirstGroup = true;
    }

    // Separador entre grupos (exceto o primeiro)
    if (!isFirstGroup) {
      y += 3;
      doc.setDrawColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;
    }
    isFirstGroup = false;

    // ═══════════════════════════════════════════════════════════
    // CARD DO CONVÊNIO
    // ═══════════════════════════════════════════════════════════
    
    // Box de fundo do convênio
    const boxHeight = grupo.cnpj || grupo.banco ? 22 : 15;
    doc.setFillColor(colors.tableHeader[0], colors.tableHeader[1], colors.tableHeader[2]);
    doc.roundedRect(margin, y, pageWidth - 2 * margin, boxHeight, 2, 2, 'F');
    
    // Nome do convênio
    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('CONVÊNIO:', margin + 3, y + 6);
    doc.text(grupo.convenioNome.toUpperCase(), margin + 28, y + 6);
    
    // CNPJ
    if (grupo.cnpj) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('CNPJ:', margin + 3, y + 12);
      doc.setFont('helvetica', 'bold');
      doc.text(grupo.cnpj, margin + 15, y + 12);
    }
    
    // Dados bancários
    if (grupo.banco || grupo.agencia || grupo.conta) {
      const dadosBancarios = [];
      if (grupo.banco) dadosBancarios.push(`Banco: ${grupo.banco}`);
      if (grupo.agencia) dadosBancarios.push(`Ag: ${grupo.agencia}`);
      if (grupo.conta) dadosBancarios.push(`Conta: ${grupo.conta}`);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const yBanco = grupo.cnpj ? y + 18 : y + 12;
      doc.text(dadosBancarios.join('  •  '), margin + 3, yBanco);
    }
    
    y += boxHeight + 5;

    // ═══════════════════════════════════════════════════════════
    // TABELA DE PARCELAS
    // ═══════════════════════════════════════════════════════════
    
    // Cabeçalho da tabela
    doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.rect(margin, y - 3, pageWidth - 2 * margin, 7, 'F');
    
    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    
    // Colunas da tabela
    const col1 = margin + 3;              // Sócio
    const col2 = pageWidth - 100;         // Parcela
    const col3 = pageWidth - 85;          // De
    const col4 = pageWidth - 55;          // Valor
    const col5 = pageWidth - 15;          // Status
    
    doc.text('SÓCIO', col1, y + 1.5);
    doc.text('PARC.', col2, y + 1.5);
    doc.text('DE', col3, y + 1.5);
    doc.text('VALOR', col4, y + 1.5, { align: 'right' });
    doc.text('ST', col5, y + 1.5);
    
    y += 7;
    
    // Linhas de dados
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    let isAlternate = false;
    
    grupo.parcelas.forEach((parcela, index) => {
      // Verificar quebra de página
      if (y > pageHeight - 30) {
        addFooter();
        doc.addPage();
        addHeader();
        
        // Repetir cabeçalho da tabela na nova página
        doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        doc.rect(margin, y - 3, pageWidth - 2 * margin, 7, 'F');
        doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
        doc.setFont('helvetica', 'bold');
        doc.text('SÓCIO', col1, y + 1.5);
        doc.text('PARC.', col2, y + 1.5);
        doc.text('DE', col3, y + 1.5);
        doc.text('VALOR', col4, y + 1.5, { align: 'right' });
        doc.text('ST', col5, y + 1.5);
        y += 7;
        
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        doc.setFont('helvetica', 'normal');
        isAlternate = false;
      }
      
      // Fundo alternado para melhor leitura
      if (isAlternate) {
        doc.setFillColor(colors.tableAlt[0], colors.tableAlt[1], colors.tableAlt[2]);
        doc.rect(margin, y - 3, pageWidth - 2 * margin, 6, 'F');
      }
      
      // Sócio
      const socioText = parcela.socio.length > 100 ? parcela.socio.substring(0, 97) + '...' : parcela.socio;
      doc.text(socioText, col1, y + 1);
      
      // Parcela (formato: 01)
      doc.text(parcela.pc.toString().padStart(2, '0'), col2, y + 1);
      
      // De (formato: 12)
      doc.text(parcela.de.toString().padStart(2, '0'), col3, y + 1);
      
      // Valor
      const valorFormatado = parcela.valor.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      doc.setFont('helvetica', 'bold');
      doc.text(`R$ ${valorFormatado}`, col4, y + 1, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      
      // Status
      if (parcela.st === 'OK') {
        doc.setTextColor(colors.success[0], colors.success[1], colors.success[2]);
        doc.setFont('helvetica', 'bold');
        doc.text('✓', col5, y + 1);
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        doc.setFont('helvetica', 'normal');
      }
      
      y += 6;
      isAlternate = !isAlternate;
    });
    
    // ═══════════════════════════════════════════════════════════
    // TOTAL DO CONVÊNIO
    // ═══════════════════════════════════════════════════════════
    
    y += 2;
    doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.rect(pageWidth - margin - 90, y - 3, 90, 8, 'F');
    
    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('TOTAL DO CONVÊNIO:', pageWidth - margin - 87, y + 2);
    
    const totalFormatado = grupo.total.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    doc.setFontSize(10);
    doc.text(`R$ ${totalFormatado}`, pageWidth - margin - 3, y + 2, { align: 'right' });
    
    y += 10;
    totalGeral += grupo.total;
  });
  } // Fim do modo detalhado

  // ═══════════════════════════════════════════════════════════
  // TOTAL GERAL
  // ═══════════════════════════════════════════════════════════
  
  if (y > pageHeight - 35) {
    addFooter();
    doc.addPage();
    addHeader();
  }
  
  y += 5;
  
  // Box de total geral destacado
  doc.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
  doc.roundedRect(pageWidth / 2 - 60, y - 4, 120, 12, 2, 2, 'F');
  
  doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL GERAL:', pageWidth / 2 - 52, y + 3);
  
  const totalGeralFormatado = totalGeral.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  doc.setFontSize(13);
  doc.text(`R$ ${totalGeralFormatado}`, pageWidth / 2 + 52, y + 3, { align: 'right' });
  
  // Informações adicionais
  y += 18;
  doc.setFontSize(7);
  doc.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
  doc.setFont('helvetica', 'italic');
  const totalConvenios = grupos.length;
  const totalParcelas = grupos.reduce((sum, g) => sum + g.parcelas.length, 0);
  doc.text(`Total de Convênios: ${totalConvenios} • Total de Parcelas: ${totalParcelas}`, pageWidth / 2, y, { align: 'center' });
  
  // Adicionar rodapé na última página
  addFooter();

  return doc.output('arraybuffer') as ArrayBuffer;
}

async function gerarExcelConvenio(grupos: GrupoConvenio[], mes: number, ano: number, isRelatorioGeral: boolean = false): Promise<ArrayBuffer> {
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
  },
  isRelatorioGeral: boolean = false
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
