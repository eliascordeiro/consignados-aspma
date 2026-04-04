import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';
import iconv from 'iconv-lite';
import { auth } from '@/lib/auth';
import { getDataUserId } from '@/lib/get-data-user-id';
import { hasPermission } from '@/lib/permissions';

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
  matriculaInfo?: { antiga: number; atual: number } | null;
  parcelas: {
    convenio: string;
    pc: number;
    de: number;
    valor: number;
    st: string;
  }[];
  total: number;
  totalDesconto: number;
  totalLiquido: number;
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
  descontoPorParcela: number;
  totalDesconto: number;
  totalLiquido: number;
}

interface GrupoSocioResumo {
  matricula: string;
  nome: string;
  qtdParcelas: number;
  total: number;
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

    // Buscar userId correto (herda dados do MANAGER se for subordinado)
    const dataUserId = await getDataUserId(session as any);

    const searchParams = request.nextUrl.searchParams;
    const mesAno = searchParams.get('mesAno'); // formato: YYYY-MM
    const convenioId = searchParams.get('convenioId');
    const socioMatricula = searchParams.get('socioMatricula');
    const agrupaPor = searchParams.get('agrupaPor') || 'socio'; // 'socio' ou 'convenio'
    const formato = searchParams.get('formato') || 'pdf'; // 'pdf' ou 'excel'
    const tipoSocio = searchParams.get('tipoSocio'); // 'pensionistas' = codTipo 3 e 4
    const apenasEmAberto = searchParams.get('apenasEmAberto'); // 'true' = somente parcelas sem baixa
    const empresaId = searchParams.get('empresaId'); // filtra sócios pela empresa consignatária (novo sistema)

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
    // AS302.PRG usa: MONTH(parcelas.vencimento) = X AND YEAR(parcelas.vencimento) = Y
    // Equivalente no PostgreSQL: range de data com início e fim do mês
    const dataInicio = new Date(ano, mes - 1, 1, 0, 0, 0);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);

    // Buscar parcelas (SEM filtro de userId - AS302.PRG traz TODOS os pensionistas)
    const where: any = {
      dataVencimento: {
        gte: dataInicio,
        lte: dataFim,
      },
    };

    // Filtro de parcelas em aberto (sem baixa) - AS302.PRG: TRIM(parcelas.baixa) = ''
    // IMPORTANTE: No PostgreSQL migrado, o campo baixa pode ter:
    // - 'N' = Não baixada (parcela em aberto)
    // - 'S' = Sim baixada (parcela quitada)
    // - null, '' ou ' ' = Também considerados não baixados
    if (apenasEmAberto === 'true') {
      where.OR = [
        { baixa: null },
        { baixa: '' },
        { baixa: ' ' },
        { baixa: 'N' }, // Migração MySQL->PG: 'N' = não baixada
      ];
    }

    // Consignatária: inclui TODAS as parcelas (inclusive baixa 'S'/'X')
    // Parcelas com baixa 'S' ou 'X' aparecem no relatório com ST = 'BX'
    // Sem filtro adicional de baixa para agrupamento por consignatária

    // Monta filtros de venda (convênio, sócio, tipoSocio)
    // IMPORTANTE: SEM filtro de userId - AS302.PRG traz TODOS os pensionistas do sistema
    // Sempre excluir vendas canceladas
    const vendaFilter: any = { cancelado: false };
    let hasVendaFilter = true;

    if (convenioId) {
      vendaFilter.convenio = { id: parseInt(convenioId) };
      hasVendaFilter = true;
    }

    if (socioMatricula) {
      // AS302.PRG usa: LEFT JOIN socios ON TRIM(parcelas.matricula) = TRIM(socios.matricula)
      // No Prisma, o JOIN é feito via FK (sem TRIM). Garantir que matrículas estejam sem espaços na base
      vendaFilter.socio = { ...vendaFilter.socio, matricula: socioMatricula.trim() };
      hasVendaFilter = true;
    }

    // Filtro por tipo de sócio - AS302.PRG: codtipo = '3' OR codtipo = '4' (pensionistas/local)
    // MySQL armazena como VARCHAR, PostgreSQL como INTEGER. Prisma converte automaticamente.
    if (tipoSocio === 'pensionistas') {
      vendaFilter.socio = { ...vendaFilter.socio, codTipo: { in: [3, 4] } };
      hasVendaFilter = true;
    }

    // AS301.PRG: socios.codtipo <> '3' AND socios.codtipo <> '4' (sócios ativos/regulares)
    if (tipoSocio === 'ativos') {
      vendaFilter.socio = { ...vendaFilter.socio, codTipo: { notIn: [3, 4] } };
      hasVendaFilter = true;
    }

    // Filtro por empresa (consignatária) - usa empresaId snapshot da venda (não do sócio)
    if (empresaId) {
      vendaFilter.empresaId = parseInt(empresaId);
      hasVendaFilter = true;
    }

    if (hasVendaFilter) {
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
                id: true,
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
                desconto: true,
              },
            },
          },
        },
      },
      orderBy: [
        { venda: { socio: { nome: 'asc' } } },      // associado (AS302: parcelas.associado)
        { venda: { socio: { matricula: 'asc' } } }, // matricula (AS302: parcelas.matricula)
        { venda: { numeroVenda: 'asc' } },          // sequencia (AS302: parcelas.sequencia)
        { numeroParcela: 'asc' },                   // nrseq (AS302: parcelas.nrseq)
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
    } else if (agrupaPor === 'consignataria') {
      const gruposConsignataria = agruparPorConsignataria(parcelas);

      if (formato === 'pdf') {
        const pdfBuffer = await gerarPDFConsignataria(gruposConsignataria, mes, ano, !!convenioId);
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="debitos-consignatarias-${mesAno}.pdf"`,
          },
        });
      } else if (formato === 'excel') {
        const excelBuffer = await gerarExcelConsignataria(gruposConsignataria, mes, ano);
        return new NextResponse(excelBuffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="debitos-consignatarias-${mesAno}.xlsx"`,
          },
        });
      } else if (formato === 'csv') {
        const delimiter = searchParams.get('delimiter') || ';';
        const encoding = searchParams.get('encoding') || 'utf-8';
        const includeHeader = searchParams.get('includeHeader') !== 'false';
        const decimalSeparator = searchParams.get('decimalSeparator') || ',';

        const csvContent = gerarCSVConsignataria(gruposConsignataria, mes, ano, {
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
            'Content-Disposition': `attachment; filename="debitos-consignatarias-${mesAno}.csv"`,
          },
        });
      }
    } else if (agrupaPor === 'resumido-consignataria') {
      // Resumo de débitos em aberto por sócio - para entrega à consignatária
      const gruposResumo = agruparPorSocioResumo(parcelas);

      if (formato === 'pdf') {
        const pdfBuffer = await gerarPDFSocioResumo(gruposResumo, mes, ano);
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="debitos-abertos-${mesAno}.pdf"`,
          },
        });
      } else if (formato === 'excel') {
        const excelBuffer = await gerarExcelSocioResumo(gruposResumo, mes, ano);
        return new NextResponse(excelBuffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="debitos-abertos-${mesAno}.xlsx"`,
          },
        });
      } else if (formato === 'csv') {
        const delimiter = searchParams.get('delimiter') || ';';
        const encoding = searchParams.get('encoding') || 'utf-8';
        const includeHeader = searchParams.get('includeHeader') !== 'false';
        const decimalSeparator = searchParams.get('decimalSeparator') || ',';
        const csvContent = gerarCSVSocioResumo(gruposResumo, mes, ano, { delimiter, includeHeader, decimalSeparator });
        const buffer = encoding === 'iso-8859-1'
          ? iconv.encode(csvContent, 'iso-8859-1')
          : Buffer.from(csvContent, 'utf-8');
        return new NextResponse(buffer as unknown as BodyInit, {
          headers: {
            'Content-Type': 'text/csv; charset=' + encoding,
            'Content-Disposition': `attachment; filename="debitos-abertos-${mesAno}.csv"`,
          },
        });
      }
    } else {
      // Agrupar por sócio (lógica existente)
      // Busca mapeamento de matrículas (de/para) para os sócios do relatório
      const uniqueNums = [...new Set(
        parcelas.map((p: any) => parseInt(p.venda.socio.matricula || '')).filter((n: number) => !isNaN(n) && n > 0)
      )];
      const matriculaMap = new Map<string, { antiga: number; atual: number }>();
      if (uniqueNums.length > 0) {
        try {
          const mappings = await prisma.$queryRaw<{ matricula_antiga: number; matricula_atual: number }[]>`
            SELECT matricula_antiga, matricula_atual FROM matriculas
            WHERE matricula_antiga = ANY(${uniqueNums}::integer[])
               OR matricula_atual  = ANY(${uniqueNums}::integer[])
          `;
          for (const m of mappings) {
            const entry = { antiga: Number(m.matricula_antiga), atual: Number(m.matricula_atual) };
            matriculaMap.set(m.matricula_antiga.toString(), entry);
            matriculaMap.set(m.matricula_atual.toString(), entry);
          }
        } catch { /* tabela inexistente ou erro — ignora */ }
      }
      const grupos = agruparPorSocio(parcelas, matriculaMap);

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
  let totalDescontoGeral = 0;
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
    const cardHeight = grupo.matriculaInfo ? 16 : 12;
    doc.setFillColor(colors.tableHeader[0], colors.tableHeader[1], colors.tableHeader[2]);
    doc.roundedRect(margin, y, pageWidth - 2 * margin, cardHeight, 2, 2, 'F');
    
    // Matrícula e Nome do sócio
    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('SÓCIO:', margin + 3, y + 5);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Matrícula: ${grupo.matricula}`, margin + 20, y + 5);
    
    // De/Para: mapeamento da tabela matriculas
    if (grupo.matriculaInfo) {
      doc.setFontSize(8);
      doc.setTextColor(255, 235, 150); // amarelo suave para destaque
      doc.text(`De: ${grupo.matriculaInfo.antiga}  ->  Para: ${grupo.matriculaInfo.atual}`, margin + 20, y + 9.5);
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const nomeText = grupo.nome.length > 80 ? grupo.nome.substring(0, 77) + '...' : grupo.nome;
    doc.text(nomeText.toUpperCase(), margin + 3, grupo.matriculaInfo ? y + 13.5 : y + 9);
    
    y += cardHeight + 3;

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
        const cardHeightPB = grupo.matriculaInfo ? 16 : 12;
        doc.setFillColor(colors.tableHeader[0], colors.tableHeader[1], colors.tableHeader[2]);
        doc.roundedRect(margin, y, pageWidth - 2 * margin, cardHeightPB, 2, 2, 'F');
        doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('SÓCIO:', margin + 3, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Matrícula: ${grupo.matricula}`, margin + 20, y + 5);
        if (grupo.matriculaInfo) {
          doc.setFontSize(8);
          doc.setTextColor(255, 235, 150);
          doc.text(`De: ${grupo.matriculaInfo.antiga}  ->  Para: ${grupo.matriculaInfo.atual}`, margin + 20, y + 9.5);
          doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(nomeText.toUpperCase(), margin + 3, grupo.matriculaInfo ? y + 13.5 : y + 9);
        y += cardHeightPB + 3;
        
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
      if (parcela.st === 'BX') {
        doc.setTextColor(231, 76, 60);
        doc.setFont('helvetica', 'bold');
        doc.text('BX', col5, y + 1);
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
    const totalFormatado = grupo.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.setFontSize(10);
    doc.text(`R$ ${totalFormatado}`, pageWidth - margin - 3, y + 2, { align: 'right' });
    y += 10;
    totalGeral += grupo.total;
    totalDescontoGeral += grupo.totalDesconto;
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
  const boxGeralH = 12;
  doc.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
  doc.roundedRect(pageWidth / 2 - 70, y - 4, 140, boxGeralH, 2, 2, 'F');
  doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL GERAL:', pageWidth / 2 - 52, y + 3);
  const totalGeralFormatado = totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  doc.setFontSize(13);
  doc.text(`R$ ${totalGeralFormatado}`, pageWidth / 2 + 52, y + 3, { align: 'right' });
  
  // Informações adicionais
  y += boxGeralH + 8;
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
    'Total Bruto',
    'Desconto',
    'Total Líquido',
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
  let totalDescontoGeral = 0;

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
        index === grupo.parcelas.length - 1 ? grupo.totalDesconto : '',
        index === grupo.parcelas.length - 1 ? grupo.totalLiquido : '',
        parcela.st,
      ]);

      // Formatar valor
      row.getCell(6).numFmt = '#,##0.00';
      
      // Formatar totais
      if (index === grupo.parcelas.length - 1) {
        row.getCell(7).numFmt = '#,##0.00';
        row.getCell(7).font = { bold: true };
        row.getCell(8).numFmt = '#,##0.00';
        row.getCell(8).font = { bold: true, color: { argb: 'FFCC0000' } };
        row.getCell(9).numFmt = '#,##0.00';
        row.getCell(9).font = { bold: true };
      }
    });

    totalGeral += grupo.total;
    totalDescontoGeral += grupo.totalDesconto;
  });

  // Total Geral
  const totalRow = worksheet.addRow([
    '',
    '',
    '',
    '',
    '',
    'TOTAIS:',
    totalGeral,
    totalDescontoGeral,
    totalGeral - totalDescontoGeral,
    '',
  ]);
  totalRow.font = { bold: true };
  totalRow.getCell(7).numFmt = '#,##0.00';
  totalRow.getCell(8).numFmt = '#,##0.00';
  totalRow.getCell(8).font = { bold: true, color: { argb: 'FFCC0000' } };
  totalRow.getCell(9).numFmt = '#,##0.00';

  // Auto-ajustar colunas
  worksheet.columns = [
    { width: 12 }, // Matrícula
    { width: 40 }, // Associado
    { width: 40 }, // Conveniado
    { width: 5 },  // Pc
    { width: 5 },  // De
    { width: 15 }, // Valor
    { width: 15 }, // Total Bruto
    { width: 15 }, // Desconto
    { width: 15 }, // Total Líquido
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

function agruparPorSocio(parcelas: any[], matriculaMap?: Map<string, { antiga: number; atual: number }>): GrupoSocio[] {
  const grupos: Map<string, GrupoSocio> = new Map();

  parcelas.forEach((parcela) => {
    // Usar socio.id como chave garante que sócios distintos com mesma matrícula
    // (ou sem matrícula) não sejam agrupados incorretamente.
    const socioKey = parcela.venda.socio.id || parcela.venda.socio.matricula || '';
    const matricula = parcela.venda.socio.matricula || '';

    if (!grupos.has(socioKey)) {
      grupos.set(socioKey, {
        matricula,
        nome: parcela.venda.socio.nome,
        matriculaInfo: matriculaMap?.get(matricula) ?? null,
        parcelas: [],
        total: 0,
        totalDesconto: 0,
        totalLiquido: 0,
      });
    }

    const grupo = grupos.get(socioKey)!;
    const convenioTexto = parcela.venda.convenio
      ? `${parcela.venda.convenio.codigo || ''} - ${parcela.venda.convenio.razao_soc} [Contrato: ${parcela.venda.numeroVenda}]`
      : `Sem convênio [Contrato: ${parcela.venda.numeroVenda}]`;
    
    const baixaSocio = (parcela.baixa || '').toString().trim();
    grupo.parcelas.push({
      convenio: convenioTexto,
      pc: parcela.numeroParcela,
      de: parcela.venda.quantidadeParcelas,
      valor: Number(parcela.valor),
      st: baixaSocio !== '' ? 'BX' : '',
    });
    grupo.total += Number(parcela.valor);
    grupo.totalDesconto += Number(parcela.valor) * Number(parcela.venda.convenio?.desconto ?? 0) / 100;
  });

  return Array.from(grupos.values()).map(g => ({ ...g, totalLiquido: g.total - g.totalDesconto }));
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
        descontoPorParcela: Number(parcela.venda.convenio.desconto ?? 0),
        parcelas: [],
        total: 0,
        totalDesconto: 0,
        totalLiquido: 0,
      });
    }

    const grupo = grupos.get(convenioId)!;
    const socioTexto = `${parcela.venda.socio.matricula || ''} - ${parcela.venda.socio.nome}`;
    const baixaConv = (parcela.baixa || '').toString().trim();
    grupo.parcelas.push({
      socio: socioTexto,
      pc: parcela.numeroParcela,
      de: parcela.venda.quantidadeParcelas,
      valor: Number(parcela.valor),
      st: baixaConv !== '' ? 'BX' : '',
    });
    grupo.total += Number(parcela.valor);
    grupo.totalDesconto += Number(parcela.valor) * grupo.descontoPorParcela / 100;
  });

  // Ordenar por razão social (ordem alfabética)
  return Array.from(grupos.values()).map(g => ({ ...g, totalLiquido: g.total - g.totalDesconto })).sort((a, b) => 
    a.convenioNome.localeCompare(b.convenioNome, 'pt-BR', { sensitivity: 'base' })
  );
}

// Agrupamento por Consignatária: inclui parcelas com baixa 'S'/'X' marcando ST = 'BX'
function agruparPorConsignataria(parcelas: any[]): GrupoConvenio[] {
  const grupos: Map<number, GrupoConvenio> = new Map();

  parcelas.forEach((parcela) => {
    if (!parcela.venda.convenio) return;

    const convenioId = parcela.venda.convenio.id;

    if (!grupos.has(convenioId)) {
      grupos.set(convenioId, {
        convenioId,
        convenioNome: parcela.venda.convenio.razao_soc,
        cnpj: parcela.venda.convenio.cnpj,
        agencia: parcela.venda.convenio.agencia,
        conta: parcela.venda.convenio.conta,
        banco: parcela.venda.convenio.banco,
        descontoPorParcela: Number(parcela.venda.convenio.desconto ?? 0),
        parcelas: [],
        total: 0,
        totalDesconto: 0,
        totalLiquido: 0,
      });
    }

    const grupo = grupos.get(convenioId)!;
    const socioTexto = `${parcela.venda.socio.matricula || ''} - ${parcela.venda.socio.nome}`;
    const baixaVal = (parcela.baixa || '').toString().trim();
    const st = baixaVal !== '' ? 'BX' : '';

    grupo.parcelas.push({
      socio: socioTexto,
      pc: parcela.numeroParcela,
      de: parcela.venda.quantidadeParcelas,
      valor: Number(parcela.valor),
      st,
    });
    grupo.total += Number(parcela.valor);
    grupo.totalDesconto += Number(parcela.valor) * grupo.descontoPorParcela / 100;
  });

  return Array.from(grupos.values()).map(g => ({ ...g, totalLiquido: g.total - g.totalDesconto })).sort((a, b) =>
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
  let totalDescontoGeral = 0;
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
    const colCNPJ = margin + 85;
    const colBanco = margin + 125;
    const colAg = margin + 150;
    const colConta = margin + 168;
    const colTotalBruto = pageWidth - margin - 65;
    const colDescontoR = pageWidth - margin - 33;
    const colLiquid = pageWidth - margin - 3;
    
    doc.text('CONVÊNIO', colConv, y + 1.5);
    doc.text('CNPJ', colCNPJ, y + 1.5);
    doc.text('BANCO', colBanco, y + 1.5);
    doc.text('AG', colAg, y + 1.5);
    doc.text('CONTA', colConta, y + 1.5);
    doc.text('TOTAL', colTotalBruto, y + 1.5, { align: 'right' });
    doc.text('DESCONTO', colDescontoR, y + 1.5, { align: 'right' });
    doc.text('LÍQUIDO', colLiquid, y + 1.5, { align: 'right' });
    
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
        doc.text('TOTAL', colTotalBruto, y + 1.5, { align: 'right' });
        doc.text('DESCONTO', colDescontoR, y + 1.5, { align: 'right' });
        doc.text('LÍQUIDO', colLiquid, y + 1.5, { align: 'right' });
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
      
      // Total / Desconto / Líquido
      const totalBrutoFmtR = grupo.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const descontoFmtR = grupo.totalDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const liqFmtR = grupo.totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      doc.setFont('helvetica', 'normal');
      doc.text(`R$ ${totalBrutoFmtR}`, colTotalBruto, y + 1, { align: 'right' });
      doc.text(`R$ ${descontoFmtR}`, colDescontoR, y + 1, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(`R$ ${liqFmtR}`, colLiquid, y + 1, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      
      totalGeral += grupo.totalLiquido;
      totalDescontoGeral += grupo.totalDesconto;
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
      if (parcela.st === 'BX') {
        doc.setTextColor(231, 76, 60);
        doc.setFont('helvetica', 'bold');
        doc.text('BX', col5, y + 1);
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        doc.setFont('helvetica', 'normal');
      }
      
      y += 6;
      isAlternate = !isAlternate;
    });
    
    // ═══════════════════════════════════════════════════════════
    // TOTAL DO CONVÊNIO (apenas quando convênio específico selecionado)
    // ═══════════════════════════════════════════════════════════
    
    if (!isRelatorioGeral) {
    y += 2;
    doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.roundedRect(pageWidth - margin - 105, y - 3, 105, 30, 2, 2, 'F');
    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('TOTAL DO CONVÊNIO:', pageWidth - margin - 102, y + 4);
    doc.text(`R$ ${grupo.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin - 3, y + 4, { align: 'right' });
    doc.text('Desconto:', pageWidth - margin - 102, y + 12);
    doc.text(`R$ ${grupo.totalDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin - 3, y + 12, { align: 'right' });
    doc.setDrawColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setLineWidth(0.3);
    doc.line(pageWidth - margin - 102, y + 15, pageWidth - margin - 3, y + 15);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Valor Líquido:', pageWidth - margin - 102, y + 23);
    doc.text(`R$ ${grupo.totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin - 3, y + 23, { align: 'right' });
    y += 35;
    totalGeral += grupo.totalLiquido;
    totalDescontoGeral += grupo.totalDesconto;
    } // Fim do if (!isRelatorioGeral)
  });
  } // Fim do modo detalhado

  // ═══════════════════════════════════════════════════════════
  // TOTAL GERAL
  // ═══════════════════════════════════════════════════════════
  
  if (y > pageHeight - 45) {
    addFooter();
    doc.addPage();
    addHeader();
  }
  
  y += 5;
  
  // Box de total geral com 3 linhas
  const totalBrutoGeralC = totalGeral + totalDescontoGeral;
  const boxGeralHC = 32;
  doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.roundedRect(pageWidth / 2 - 85, y - 4, 170, boxGeralHC, 2, 2, 'F');
  doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Valor Total:', pageWidth / 2 - 80, y + 4);
  doc.text(`R$ ${totalBrutoGeralC.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth / 2 + 80, y + 4, { align: 'right' });
  doc.text('Valor Desconto:', pageWidth / 2 - 80, y + 12);
  doc.text(`R$ ${totalDescontoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth / 2 + 80, y + 12, { align: 'right' });
  doc.setDrawColor(colors.white[0], colors.white[1], colors.white[2]);
  doc.setLineWidth(0.3);
  doc.line(pageWidth / 2 - 80, y + 15, pageWidth / 2 + 80, y + 15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Valor Líquido:', pageWidth / 2 - 80, y + 23);
  doc.text(`R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth / 2 + 80, y + 23, { align: 'right' });
  
  // Informações adicionais
  y += boxGeralHC + 8;
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
        index === grupo.parcelas.length - 1 ? grupo.totalDesconto : '',
        index === grupo.parcelas.length - 1 ? grupo.totalLiquido : '',
        parcela.st,
      ]);

      // Formatar valor
      row.getCell(4).numFmt = '#,##0.00';
      
      // Formatar totais
      if (index === grupo.parcelas.length - 1) {
        row.getCell(5).numFmt = '#,##0.00';
        row.getCell(5).font = { bold: true };
        row.getCell(6).numFmt = '#,##0.00';
        row.getCell(6).font = { bold: true, color: { argb: 'FFCC0000' } };
        row.getCell(7).numFmt = '#,##0.00';
        row.getCell(7).font = { bold: true };
      }
      currentRow++;
    });

    totalGeral += grupo.total;
    currentRow++; // Espaço entre grupos
  });

  // Total Geral
  const totalDescontoGeralEC = grupos.reduce((s, g) => s + g.totalDesconto, 0);
  const totalRow = worksheet.addRow([
    '',
    '',
    '',
    'TOTAIS:',
    totalGeral,
    totalDescontoGeralEC,
    totalGeral - totalDescontoGeralEC,
    '',
  ]);
  totalRow.font = { bold: true };
  totalRow.getCell(5).numFmt = '#,##0.00';
  totalRow.getCell(6).numFmt = '#,##0.00';
  totalRow.getCell(6).font = { bold: true, color: { argb: 'FFCC0000' } };
  totalRow.getCell(7).numFmt = '#,##0.00';

  // Auto-ajustar colunas
  worksheet.columns = [
    { width: 50 }, // Sócio
    { width: 5 },  // Pc
    { width: 5 },  // De
    { width: 15 }, // Valor
    { width: 15 }, // Total Bruto
    { width: 15 }, // Desconto
    { width: 15 }, // Total Líquido
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
        ? (decimalSeparator === ',' ? grupo.totalLiquido.toFixed(2).replace('.', ',') : grupo.totalLiquido.toFixed(2))
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
    
    totalGeral += grupo.totalLiquido;
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

// ═══════════════════════════════════════════════════════════════════
// GERADORES DE RELATÓRIO POR CONSIGNATÁRIA
// ═══════════════════════════════════════════════════════════════════

async function gerarPDFConsignataria(grupos: GrupoConvenio[], mes: number, ano: number, mostrarTotalPorGrupo: boolean = false): Promise<ArrayBuffer> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const mesNomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const colors = {
    primary: [41, 128, 185],
    secondary: [52, 73, 94],
    accent: [231, 76, 60],
    success: [39, 174, 96],
    lightGray: [236, 240, 241],
    darkGray: [127, 140, 141],
    white: [255, 255, 255],
    tableHeader: [52, 152, 219],
    tableAlt: [245, 247, 250],
  };

  let y = 15;
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 10;
  let pageNumber = 1;

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

  const addHeader = (isFirstPage = false) => {
    if (isFirstPage) {
      y = 15;
      doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('RELATÓRIO DE DÉBITOS', pageWidth / 2, 12, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Agrupamento por Consignatária', pageWidth / 2, 18, { align: 'center' });
      y = 30;
      doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
      doc.roundedRect(pageWidth / 2 - 35, y - 5, 70, 10, 2, 2, 'F');
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`PERÍODO: ${mesNomes[mes - 1].toUpperCase()}/${ano}`, pageWidth / 2, y, { align: 'center' });
      y += 12;
    } else {
      y = 8;
      doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.rect(0, 0, pageWidth, 12, 'F');
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Débitos - ${mesNomes[mes - 1]}/${ano} - Agrupamento por Consignatária`, pageWidth / 2, 7, { align: 'center' });
      y += 7;
    }
  };

  addHeader(true);
  let totalGeral = 0;
  let totalDescontoGeral = 0;
  let isFirstGroup = true;

  grupos.forEach((grupo) => {
    if (y > pageHeight - 40) {
      addFooter();
      doc.addPage();
      addHeader(false);
      isFirstGroup = true;
    }

    if (!isFirstGroup) {
      y += 3;
      doc.setDrawColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;
    }
    isFirstGroup = false;

    // ═══ CARD DA CONSIGNATÁRIA ═══
    doc.setFillColor(colors.tableHeader[0], colors.tableHeader[1], colors.tableHeader[2]);
    doc.roundedRect(margin, y, pageWidth - 2 * margin, 12, 2, 2, 'F');

    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('CONSIGNATÁRIA:', margin + 3, y + 5);

    doc.setFontSize(10);
    const nomeText = grupo.convenioNome.length > 80 ? grupo.convenioNome.substring(0, 77) + '...' : grupo.convenioNome;
    doc.text(nomeText.toUpperCase(), margin + 3, y + 9);

    y += 15;

    // ═══ CABEÇALHO DA TABELA ═══
    doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.rect(margin, y - 3, pageWidth - 2 * margin, 7, 'F');
    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);

    const col1 = margin + 3;
    const col2 = pageWidth - 100;
    const col3 = pageWidth - 85;
    const col4 = pageWidth - 55;
    const col5 = pageWidth - 15;

    doc.text('SÓCIO', col1, y + 1.5);
    doc.text('PARC.', col2, y + 1.5);
    doc.text('DE', col3, y + 1.5);
    doc.text('VALOR', col4, y + 1.5, { align: 'right' });
    doc.text('ST', col5, y + 1.5);

    y += 7;

    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    let isAlternate = false;

    grupo.parcelas.forEach((parcela) => {
      if (y > pageHeight - 30) {
        addFooter();
        doc.addPage();
        addHeader(false);

        // Repetir card da consignatária na continuação
        doc.setFillColor(colors.tableHeader[0], colors.tableHeader[1], colors.tableHeader[2]);
        doc.roundedRect(margin, y, pageWidth - 2 * margin, 12, 2, 2, 'F');
        doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('CONSIGNATÁRIA:', margin + 3, y + 5);
        doc.setFontSize(10);
        doc.text(nomeText.toUpperCase(), margin + 3, y + 9);
        y += 15;

        doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        doc.rect(margin, y - 3, pageWidth - 2 * margin, 7, 'F');
        doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('SÓCIO', col1, y + 1.5);
        doc.text('PARC.', col2, y + 1.5);
        doc.text('DE', col3, y + 1.5);
        doc.text('VALOR', col4, y + 1.5, { align: 'right' });
        doc.text('ST', col5, y + 1.5);
        y += 7;

        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        isAlternate = false;
      }

      if (isAlternate) {
        doc.setFillColor(colors.tableAlt[0], colors.tableAlt[1], colors.tableAlt[2]);
        doc.rect(margin, y - 3, pageWidth - 2 * margin, 6, 'F');
      }

      const socioText = parcela.socio.length > 100 ? parcela.socio.substring(0, 97) + '...' : parcela.socio;
      doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
      doc.setFont('helvetica', 'normal');
      doc.text(socioText, col1, y + 1);
      doc.text(parcela.pc.toString().padStart(2, '0'), col2, y + 1);
      doc.text(parcela.de.toString().padStart(2, '0'), col3, y + 1);

      const valorFormatado = parcela.valor.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      doc.setFont('helvetica', 'bold');
      doc.text(`R$ ${valorFormatado}`, col4, y + 1, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      if (parcela.st === 'BX') {
        doc.setTextColor(231, 76, 60); // laranja/vermelho = baixado
        doc.setFont('helvetica', 'bold');
        doc.text('BX', col5, y + 1);
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        doc.setFont('helvetica', 'normal');
      }

      y += 6;
      isAlternate = !isAlternate;
    });

    // ═══ TOTAL DA CONSIGNATÁRIA ═══
    y += 2;
    if (y > pageHeight - 45) {
      addFooter();
      doc.addPage();
      addHeader(false);
    }
    doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.roundedRect(pageWidth - margin - 110, y - 3, 110, 30, 2, 2, 'F');
    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('TOTAL DA CONSIGNATÁRIA:', pageWidth - margin - 107, y + 4);
    doc.text(`R$ ${grupo.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin - 3, y + 4, { align: 'right' });
    doc.text('Desconto:', pageWidth - margin - 107, y + 12);
    doc.text(`R$ ${grupo.totalDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin - 3, y + 12, { align: 'right' });
    doc.setDrawColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setLineWidth(0.3);
    doc.line(pageWidth - margin - 107, y + 15, pageWidth - margin - 3, y + 15);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Valor Líquido:', pageWidth - margin - 107, y + 23);
    doc.text(`R$ ${grupo.totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin - 3, y + 23, { align: 'right' });
    y += 35;

    totalGeral += grupo.totalLiquido;
    totalDescontoGeral += grupo.totalDesconto;
  });

  // ═══ TOTAL GERAL ═══
  if (y > pageHeight - 35) {
    addFooter();
    doc.addPage();
    addHeader(false);
  }

  y += 5;
  // Box de total geral com 3 linhas
  const totalBrutoGeralE = totalGeral + totalDescontoGeral;
  const boxGeralHE = 32;
  doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  doc.roundedRect(pageWidth / 2 - 85, y - 4, 170, boxGeralHE, 2, 2, 'F');
  doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Valor Total:', pageWidth / 2 - 80, y + 4);
  doc.text(`R$ ${totalBrutoGeralE.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth / 2 + 80, y + 4, { align: 'right' });
  doc.text('Valor Desconto:', pageWidth / 2 - 80, y + 12);
  doc.text(`R$ ${totalDescontoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth / 2 + 80, y + 12, { align: 'right' });
  doc.setDrawColor(colors.white[0], colors.white[1], colors.white[2]);
  doc.setLineWidth(0.3);
  doc.line(pageWidth / 2 - 80, y + 15, pageWidth / 2 + 80, y + 15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Valor Líquido:', pageWidth / 2 - 80, y + 23);
  doc.text(`R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth / 2 + 80, y + 23, { align: 'right' });

  y += boxGeralHE + 8;
  doc.setFontSize(7);
  doc.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
  doc.setFont('helvetica', 'italic');
  const totalConsignatarias = grupos.length;
  const totalParcelas = grupos.reduce((sum, g) => sum + g.parcelas.length, 0);
  doc.text(
    `Total de Consignatárias: ${totalConsignatarias} • Total de Parcelas: ${totalParcelas}`,
    pageWidth / 2, y, { align: 'center' }
  );

  addFooter();
  return doc.output('arraybuffer') as ArrayBuffer;
}

async function gerarExcelConsignataria(grupos: GrupoConvenio[], mes: number, ano: number): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Débitos por Consignatária');

  const mesNomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  worksheet.mergeCells('A1:G1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'DÉBITOS POR CONSIGNATÁRIA';
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };

  worksheet.mergeCells('A2:G2');
  const periodoCell = worksheet.getCell('A2');
  periodoCell.value = `Período: ${mesNomes[mes - 1]}/${ano}`;
  periodoCell.font = { bold: true, size: 11 };
  periodoCell.alignment = { horizontal: 'center' };

  const headerRow = worksheet.addRow([
    'Consignatária',
    'Sócio',
    'Pc',
    'De',
    'Valor',
    'Total Bruto',
    'Desconto',
    'Total Líquido',
    'St',
  ]);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD3D3D3' },
  };

  let totalGeral = 0;

  grupos.forEach((grupo) => {
    grupo.parcelas.forEach((parcela, index) => {
      const row = worksheet.addRow([
        index === 0 ? grupo.convenioNome : '',
        parcela.socio,
        parcela.pc,
        parcela.de,
        parcela.valor,
        index === grupo.parcelas.length - 1 ? grupo.total : '',
        index === grupo.parcelas.length - 1 ? grupo.totalDesconto : '',
        index === grupo.parcelas.length - 1 ? grupo.totalLiquido : '',
        parcela.st,
      ]);
      row.getCell(5).numFmt = '#,##0.00';
      if (index === grupo.parcelas.length - 1) {
        row.getCell(6).numFmt = '#,##0.00';
        row.getCell(6).font = { bold: true };
        row.getCell(7).numFmt = '#,##0.00';
        row.getCell(7).font = { bold: true, color: { argb: 'FFCC0000' } };
        row.getCell(8).numFmt = '#,##0.00';
        row.getCell(8).font = { bold: true };
      }
    });
    totalGeral += grupo.total;
  });

  const totalDescontoGeralEX = grupos.reduce((s, g) => s + g.totalDesconto, 0);
  const totalRow = worksheet.addRow(['', '', '', '', 'TOTAIS:', totalGeral, totalDescontoGeralEX, totalGeral - totalDescontoGeralEX, '']);
  totalRow.font = { bold: true };
  totalRow.getCell(6).numFmt = '#,##0.00';
  totalRow.getCell(7).numFmt = '#,##0.00';
  totalRow.getCell(7).font = { bold: true, color: { argb: 'FFCC0000' } };
  totalRow.getCell(8).numFmt = '#,##0.00';

  worksheet.columns = [
    { width: 40 }, // Consignatária
    { width: 50 }, // Sócio
    { width: 5 },  // Pc
    { width: 5 },  // De
    { width: 15 }, // Valor
    { width: 15 }, // Total Bruto
    { width: 15 }, // Desconto
    { width: 15 }, // Total Líquido
    { width: 5 },  // St
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const uint8Array = new Uint8Array(buffer);
  return uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);
}

function gerarCSVConsignataria(
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

  if (includeHeader) {
    lines.push([
      'Consignataria',
      'Socio',
      'Parcela',
      'Total_Parcelas',
      'Valor',
      'Total_Consignataria',
      'Status',
    ].join(delimiter));
  }

  let totalGeral = 0;

  grupos.forEach((grupo) => {
    grupo.parcelas.forEach((parcela, index) => {
      const valorFormatado = decimalSeparator === ','
        ? parcela.valor.toFixed(2).replace('.', ',')
        : parcela.valor.toFixed(2);

      const totalFormatado = index === grupo.parcelas.length - 1
        ? (decimalSeparator === ',' ? grupo.totalLiquido.toFixed(2).replace('.', ',') : grupo.totalLiquido.toFixed(2))
        : '';

      lines.push([
        `"${grupo.convenioNome}"`,
        `"${parcela.socio}"`,
        parcela.pc.toString(),
        parcela.de.toString(),
        valorFormatado,
        totalFormatado,
        parcela.st,
      ].join(delimiter));
    });
    totalGeral += grupo.totalLiquido;
  });

  const totalGeralFormatado = decimalSeparator === ','
    ? totalGeral.toFixed(2).replace('.', ',')
    : totalGeral.toFixed(2);

  lines.push(['', '', '', '', 'TOTAL GERAL:', totalGeralFormatado, ''].join(delimiter));

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// AGRUPAMENTO POR SÓCIO — RESUMO (para consignatárias, sem baixa)
// ═══════════════════════════════════════════════════════════════════

function agruparPorSocioResumo(parcelas: any[]): GrupoSocioResumo[] {
  const grupos: Map<string, GrupoSocioResumo> = new Map();
  parcelas.forEach((parcela) => {
    const matricula = parcela.venda.socio.matricula || '';
    if (!grupos.has(matricula)) {
      grupos.set(matricula, {
        matricula,
        nome: parcela.venda.socio.nome,
        qtdParcelas: 0,
        total: 0,
      });
    }
    const g = grupos.get(matricula)!;
    g.qtdParcelas += 1;
    g.total += Number(parcela.valor);
  });
  return Array.from(grupos.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
  );
}

async function gerarPDFSocioResumo(grupos: GrupoSocioResumo[], mes: number, ano: number): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const mesNomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const colors = {
    primary:     [22, 163, 74],    // emerald-600
    secondary:   [52, 73, 94],
    accent:      [231, 76, 60],
    lightGray:   [236, 240, 241],
    darkGray:    [127, 140, 141],
    white:       [255, 255, 255],
    tableHeader: [21, 128, 61],    // emerald-700
    tableAlt:    [240, 253, 244],  // emerald-50
  };

  let y = 15;
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth  = doc.internal.pageSize.width;
  const margin = 10;
  let pageNumber = 1;

  const addFooter = () => {
    doc.setFontSize(8);
    doc.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Página ${pageNumber} • Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
      pageWidth / 2, pageHeight - 8, { align: 'center' }
    );
    doc.setDrawColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pageNumber++;
  };

  const addHeader = (isFirstPage = false) => {
    if (isFirstPage) {
      y = 15;
      doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('DÉBITOS EM ABERTO', pageWidth / 2, 12, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Para Consignatária — Resumo por Sócio', pageWidth / 2, 18, { align: 'center' });
      y = 30;
      doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
      doc.roundedRect(pageWidth / 2 - 35, y - 5, 70, 10, 2, 2, 'F');
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`PERÍODO: ${mesNomes[mes - 1].toUpperCase()}/${ano}`, pageWidth / 2, y, { align: 'center' });
      y += 12;
    } else {
      y = 8;
      doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.rect(0, 0, pageWidth, 12, 'F');
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Débitos em Aberto — ${mesNomes[mes - 1]}/${ano} — Resumo por Sócio`, pageWidth / 2, 7, { align: 'center' });
      y += 7;
    }
  };

  const colMat   = margin + 3;
  const colNome  = margin + 28;
  const colQtd   = pageWidth - 50;
  const colTotal = pageWidth - margin - 3;

  const renderTableHeader = () => {
    doc.setFillColor(colors.tableHeader[0], colors.tableHeader[1], colors.tableHeader[2]);
    doc.rect(margin, y - 3, pageWidth - 2 * margin, 7, 'F');
    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('MATRÍCULA',     colMat,   y + 1.5);
    doc.text('NOME DO SÓCIO', colNome,  y + 1.5);
    doc.text('PARC.',         colQtd,   y + 1.5, { align: 'right' });
    doc.text('TOTAL',         colTotal, y + 1.5, { align: 'right' });
    y += 7;
  };

  addHeader(true);
  renderTableHeader();

  let totalGeral = 0;
  let isAlternate = false;

  grupos.forEach((grupo) => {
    if (y > pageHeight - 30) {
      addFooter();
      doc.addPage();
      addHeader(false);
      renderTableHeader();
      isAlternate = false;
    }

    if (isAlternate) {
      doc.setFillColor(colors.tableAlt[0], colors.tableAlt[1], colors.tableAlt[2]);
      doc.rect(margin, y - 3, pageWidth - 2 * margin, 6, 'F');
    }

    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(grupo.matricula, colMat, y + 1);

    const nomeText = grupo.nome.length > 120 ? grupo.nome.substring(0, 117) + '...' : grupo.nome;
    doc.text(nomeText.toUpperCase(), colNome, y + 1);
    doc.text(grupo.qtdParcelas.toString(), colQtd, y + 1, { align: 'right' });

    const totalFmt = grupo.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${totalFmt}`, colTotal, y + 1, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    totalGeral += grupo.total;
    y += 6;
    isAlternate = !isAlternate;
  });

  if (y > pageHeight - 35) { addFooter(); doc.addPage(); addHeader(false); }

  y += 5;
  doc.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
  doc.roundedRect(pageWidth / 2 - 60, y - 4, 120, 12, 2, 2, 'F');
  doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL GERAL:', pageWidth / 2 - 52, y + 3);
  const totalGeralFmt = totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  doc.setFontSize(13);
  doc.text(`R$ ${totalGeralFmt}`, pageWidth / 2 + 52, y + 3, { align: 'right' });

  y += 18;
  doc.setFontSize(7);
  doc.setTextColor(colors.darkGray[0], colors.darkGray[1], colors.darkGray[2]);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Total de Sócios: ${grupos.length} • Total de Parcelas: ${grupos.reduce((s, g) => s + g.qtdParcelas, 0)}`,
    pageWidth / 2, y, { align: 'center' }
  );

  addFooter();
  return doc.output('arraybuffer') as ArrayBuffer;
}

async function gerarExcelSocioResumo(grupos: GrupoSocioResumo[], mes: number, ano: number): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Débitos em Aberto');
  const mesNomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  ws.mergeCells('A1:D1');
  const t = ws.getCell('A1');
  t.value = 'DÉBITOS EM ABERTO — RESUMO POR SÓCIO';
  t.font = { bold: true, size: 14 };
  t.alignment = { horizontal: 'center' };

  ws.mergeCells('A2:D2');
  const p = ws.getCell('A2');
  p.value = `Período: ${mesNomes[mes - 1]}/${ano}`;
  p.font = { bold: true, size: 11 };
  p.alignment = { horizontal: 'center' };

  const headerRow = ws.addRow(['Matrícula', 'Nome', 'Qtd. Parcelas', 'Total']);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB7E1CD' } };

  let totalGeral = 0;
  grupos.forEach((g) => {
    const row = ws.addRow([g.matricula, g.nome, g.qtdParcelas, g.total]);
    row.getCell(4).numFmt = '#,##0.00';
    totalGeral += g.total;
  });

  const totalRow = ws.addRow(['', '', 'TOTAL GERAL:', totalGeral]);
  totalRow.font = { bold: true };
  totalRow.getCell(4).numFmt = '#,##0.00';

  ws.columns = [{ width: 15 }, { width: 50 }, { width: 15 }, { width: 18 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const u8 = new Uint8Array(buffer);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

function gerarCSVSocioResumo(
  grupos: GrupoSocioResumo[],
  mes: number,
  ano: number,
  options: { delimiter: string; includeHeader: boolean; decimalSeparator: string }
): string {
  const { delimiter, includeHeader, decimalSeparator } = options;
  const lines: string[] = [];

  if (includeHeader) {
    lines.push(['Matricula', 'Nome', 'Qtd_Parcelas', 'Total'].join(delimiter));
  }

  let totalGeral = 0;
  grupos.forEach((g) => {
    const totalFmt = decimalSeparator === ',' ? g.total.toFixed(2).replace('.', ',') : g.total.toFixed(2);
    lines.push([g.matricula, `"${g.nome}"`, g.qtdParcelas.toString(), totalFmt].join(delimiter));
    totalGeral += g.total;
  });

  const totalGeralFmt = decimalSeparator === ',' ? totalGeral.toFixed(2).replace('.', ',') : totalGeral.toFixed(2);
  lines.push(['', '', 'TOTAL GERAL:', totalGeralFmt].join(delimiter));
  return lines.join('\n');
}
