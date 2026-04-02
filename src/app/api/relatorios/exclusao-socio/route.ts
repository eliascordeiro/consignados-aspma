import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jsPDF } from 'jspdf';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const socioId = searchParams.get('socioId');

    if (!socioId) {
      return NextResponse.json({ error: 'ID do sócio é obrigatório' }, { status: 400 });
    }

    const socio = await prisma.socio.findUnique({
      where: { id: socioId },
      select: {
        id: true,
        nome: true,
        matricula: true,
        cpf: true,
        rg: true,
        funcao: true,
        lotacao: true,
        empresa: true,
      },
    });

    if (!socio) {
      return NextResponse.json({ error: 'Sócio não encontrado' }, { status: 404 });
    }

    const pdfBuffer = await gerarPDFExclusao(socio);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="exclusao-socio-${socio.matricula || socio.id}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Erro ao gerar pedido de exclusão:', error);
    return NextResponse.json({ error: 'Erro ao gerar PDF' }, { status: 500 });
  }
}

async function gerarPDFExclusao(socio: {
  nome: string;
  matricula: string | null;
  cpf: string | null;
  rg: string | null;
  funcao: string | null;
  lotacao: string | null;
  empresa: { nome?: string; razaoSocial?: string } | null;
}): Promise<ArrayBuffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.width;   // 210mm
  const pageHeight = doc.internal.pageSize.height; // 297mm
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  const colors = {
    primary:    [41,  128, 185] as [number, number, number],
    dark:       [30,  39,  46]  as [number, number, number],
    gray:       [99,  110, 114] as [number, number, number],
    lightGray:  [236, 240, 241] as [number, number, number],
    white:      [255, 255, 255] as [number, number, number],
    border:     [189, 195, 199] as [number, number, number],
    gold:       [212, 172, 13]  as [number, number, number],
    red:        [192, 57,  43]  as [number, number, number],
  };

  const now = new Date();
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  const dataFormatada = `Araucária, ${now.getDate().toString().padStart(2, '0')} de ${meses[now.getMonth()]} de ${now.getFullYear()}`;

  /** Desenha uma via do requerimento de exclusão */
  const drawVia = (yStart: number) => {
    let y = yStart;

    // ── Faixa de cabeçalho ────────────────────────────────────────────────────
    doc.setFillColor(...colors.primary);
    doc.rect(margin, y, contentWidth, 14, 'F');

    doc.setTextColor(...colors.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('A.S.P.M.A.', margin + 4, y + 5.5);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Associação dos Servidores da Prefeitura do Município de Araucária', margin + 4, y + 10.5);

    // Selo dourado no canto direito
    doc.setFillColor(...colors.gold);
    doc.circle(pageWidth - margin - 7, y + 7, 6, 'F');
    doc.setTextColor(...colors.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.text('OFÍCIO', pageWidth - margin - 7, y + 6.2, { align: 'center' });
    doc.text('ORIGINAL', pageWidth - margin - 7, y + 8.8, { align: 'center' });

    y += 20;

    // ── Título ────────────────────────────────────────────────────────────────
    doc.setTextColor(...colors.dark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text('REQUERIMENTO DE EXCLUSÃO DE ASSOCIADO', pageWidth / 2, y, { align: 'center' });

    y += 3;
    // Linha decorativa abaixo do título
    doc.setDrawColor(...colors.primary);
    doc.setLineWidth(0.6);
    doc.line(margin + 20, y, pageWidth - margin - 20, y);
    doc.setLineWidth(0.2);

    y += 7;

    // ── Box de identificação do sócio ─────────────────────────────────────────
    doc.setFillColor(...colors.lightGray);
    doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'F');
    doc.setDrawColor(...colors.border);
    doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'S');

    // Matricula
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...colors.gray);
    doc.text('MATRÍCULA', margin + 4, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...colors.primary);
    doc.text(socio.matricula || '—', margin + 4, y + 12);

    // Divisor vertical
    doc.setDrawColor(...colors.border);
    doc.line(margin + 38, y + 3, margin + 38, y + 17);

    // Nome
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...colors.gray);
    doc.text('NOME DO ASSOCIADO', margin + 42, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...colors.dark);
    const nomeDisplay = socio.nome.toUpperCase();
    doc.text(nomeDisplay, margin + 42, y + 12);

    // CPF (se presente)
    if (socio.cpf) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...colors.gray);
      doc.text('CPF', pageWidth - margin - 40, y + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...colors.dark);
      doc.text(socio.cpf, pageWidth - margin - 40, y + 12);
    }

    y += 27;

    // ── Corpo do requerimento ─────────────────────────────────────────────────
    doc.setTextColor(...colors.dark);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const saudacao = `À Diretoria da A.S.P.M.A.,`;
    doc.setFont('helvetica', 'bold');
    doc.text(saudacao, margin, y);
    y += 7;

    const corpo1 = doc.splitTextToSize(
      `Eu, ${socio.nome.toUpperCase()}, associado(a) desta Associação sob o número de matrícula ${socio.matricula || 'N/I'}, venho por meio deste requerimento solicitar, mui respeitosamente, à Vossa Senhoria minha EXCLUSÃO do quadro de associados da A.S.P.M.A. (Associação dos Servidores da Prefeitura do Município de Araucária), a partir desta data, com a consequente suspensão do desconto de 2% (dois por cento) até então efetuado a favor desta Associação.`,
      contentWidth
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...colors.dark);
    for (const line of corpo1) {
      doc.text(line, margin, y);
      y += 5.8;
    }

    y += 4;

    // OBS em destaque
    doc.setFillColor(255, 243, 205);
    doc.setDrawColor(212, 172, 13);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(140, 100, 0);
    doc.text('OBS:', margin + 3, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const obsTxt = doc.splitTextToSize(
      'A A.S.P.M.A. tem prazo de 30 (trinta) dias para retirar o nome do Associado da lista, desde que o mesmo não possua dívidas pendentes junto à Associação.',
      contentWidth - 14
    );
    let yObs = y + 5.5;
    for (const line of obsTxt) {
      doc.text(line, margin + 12, yObs);
      yObs += 4.5;
    }

    y += 19;

    // ── Declaração final ──────────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...colors.dark);
    doc.text('E por ser expressão da verdade, assino o presente em 02 (duas) vias de igual teor e forma.', margin, y);

    y += 10;

    // Data
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text(dataFormatada + '.', margin, y);

    y += 18;

    // ── Assinaturas ───────────────────────────────────────────────────────────
    const signWidth = 65;
    const sign1X = margin + 5;
    const sign2X = pageWidth - margin - signWidth - 5;

    // Assinatura do associado
    doc.setDrawColor(...colors.dark);
    doc.setLineWidth(0.4);
    doc.line(sign1X, y, sign1X + signWidth, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...colors.dark);
    doc.text(socio.nome.toUpperCase(), sign1X + signWidth / 2, y + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.gray);
    doc.text(`Matrícula: ${socio.matricula || '—'}`, sign1X + signWidth / 2, y + 8.5, { align: 'center' });
    doc.text('Assinatura do Associado', sign1X + signWidth / 2, y + 12.5, { align: 'center' });

    // Assinatura do responsável ASPMA
    doc.setDrawColor(...colors.dark);
    doc.line(sign2X, y, sign2X + signWidth, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...colors.dark);
    doc.text('A.S.P.M.A.', sign2X + signWidth / 2, y + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.gray);
    doc.text('Representante Autorizado', sign2X + signWidth / 2, y + 8.5, { align: 'center' });
    doc.text('Carimbo e Assinatura', sign2X + signWidth / 2, y + 12.5, { align: 'center' });

    y += 20;

    return y;
  };

  // ── 1ª Via ────────────────────────────────────────────────────────────────
  const yAfterFirstVia = drawVia(10);

  // ── Linha de corte entre as vias ──────────────────────────────────────────
  const yCut = yAfterFirstVia + 4;
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 1.5], 0);
  doc.line(margin, yCut, pageWidth - margin, yCut);
  doc.setLineDashPattern([], 0);

  // Tesoura na linha de corte
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...colors.gray);
  doc.text('✂', pageWidth / 2 - 4, yCut + 1);
  doc.setFontSize(6.5);
  doc.text('2ª VIA', pageWidth / 2 + 2, yCut + 1);

  // ── 2ª Via ─────────────────────────────────────────────────────────────────
  drawVia(yCut + 5);

  // ── Rodapé na parte inferior ──────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(...colors.gray);
  doc.setFont('helvetica', 'normal');
  const footerY = pageHeight - 5;
  doc.text(
    `Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} • Sistema de Gestão A.S.P.M.A.`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  return doc.output('arraybuffer');
}
