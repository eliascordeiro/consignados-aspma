import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      nome = '',
      matricula = '',
      cpf = '',
      contrato = '',
      situacao = '',
      admissao = '',
      margem = '',
      parcelas = '',
      valorParcela = '',
      valorTotal = '',
      prDesconto = '',
      consignataria = 'CAIXA ECONOMICA FEDERAL',
      convenio = 'FUNDO DE PREVIDENCIA MUNICIPAL DE ARAUCARIA',
      cnpj = '04.105.170/0001-38',
    } = body;

    if (!nome) {
      return NextResponse.json({ error: 'Dados do sócio são obrigatórios' }, { status: 400 });
    }

    const pdfBuffer = gerarPDFAverbacao({
      nome,
      matricula,
      cpf,
      contrato,
      situacao,
      admissao,
      margem,
      parcelas,
      valorParcela,
      valorTotal,
      prDesconto,
      consignataria,
      convenio,
      cnpj,
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="averbacao-${matricula || 'socio'}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Erro ao gerar confirmação de averbação:', error);
    return NextResponse.json({ error: 'Erro ao gerar PDF' }, { status: 500 });
  }
}

function formatarData(isoDate: string): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function formatarValor(val: string | number): string {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '0,00';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function gerarPDFAverbacao(data: {
  nome: string;
  matricula: string;
  cpf: string;
  contrato: string;
  situacao: string;
  admissao: string;
  margem: string;
  parcelas: string;
  valorParcela: string;
  valorTotal: string;
  prDesconto: string;
  consignataria: string;
  convenio: string;
  cnpj: string;
}): ArrayBuffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.width;
  const margin = 15;

  const now = new Date();
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  const dataHoje = `Araucária, ${now.getDate().toString().padStart(2, '0')} de ${meses[now.getMonth()]} de ${now.getFullYear()}`;

  // ── Cabeçalho ─────────────────────────────────────────────────────────────
  let y = 20;

  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);

  y += 5;
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(
    'FUNDO DE PREVIDÊNCIA MUNICIPAL DE ARAUCÁRIA – CNPJ 04.102.170/0001-38',
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 5;
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.text(
    'R. SÃO VICENTE DE PAULO, 131 – CENTRO - ARAUCÁRIA-PR – FONE: (41) 3642-4075',
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 3;
  doc.line(margin, y, pageWidth - margin, y);

  // ── Título ────────────────────────────────────────────────────────────────
  y += 10;
  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.text('CONFIRMAÇÃO DE AVERBAÇÃO', pageWidth / 2, y, { align: 'center' });

  y += 10;
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);

  // ── Campos ────────────────────────────────────────────────────────────────
  const lineH = 5;

  // CONVÊNIO
  doc.setFont('courier', 'bold');
  doc.text('CONVÊNIO: ', margin, y);
  doc.setFont('courier', 'normal');
  doc.text(`${data.convenio}     CNPJ: ${data.cnpj}`, margin + doc.getTextWidth('CONVÊNIO: '), y);
  y += lineH;

  // NOME + CPF
  const nomeDisplay = data.nome.toUpperCase().substring(0, 45);
  doc.setFont('courier', 'bold');
  doc.text('NOME: ', margin, y);
  doc.setFont('courier', 'normal');
  doc.text(nomeDisplay, margin + doc.getTextWidth('NOME: '), y);
  doc.setFont('courier', 'bold');
  doc.text('CPF: ', pageWidth / 2, y);
  doc.setFont('courier', 'normal');
  doc.text(data.cpf, pageWidth / 2 + doc.getTextWidth('CPF: '), y);
  y += lineH;

  // MATRÍCULA + SITUAÇÃO
  doc.setFont('courier', 'bold');
  doc.text('MATRÍCULA: ', margin, y);
  doc.setFont('courier', 'normal');
  doc.text(data.matricula, margin + doc.getTextWidth('MATRÍCULA: '), y);
  doc.setFont('courier', 'bold');
  doc.text('SITUAÇÃO: ', pageWidth / 2, y);
  doc.setFont('courier', 'normal');
  doc.text(data.situacao, pageWidth / 2 + doc.getTextWidth('SITUAÇÃO: '), y);
  y += lineH;

  // ADMISSÃO + CONTRATO
  doc.setFont('courier', 'bold');
  doc.text('ADMISSÃO: ', margin, y);
  doc.setFont('courier', 'normal');
  doc.text(formatarData(data.admissao), margin + doc.getTextWidth('ADMISSÃO: '), y);
  doc.setFont('courier', 'bold');
  doc.text('CONTRATO: ', pageWidth / 2, y);
  doc.setFont('courier', 'normal');
  doc.text(data.contrato, pageWidth / 2 + doc.getTextWidth('CONTRATO: '), y);
  y += lineH;

  // MARGEM + Nº PARCELAS
  doc.setFont('courier', 'bold');
  doc.text('MARGEM CONSIGNÁVEL (30%): ', margin, y);
  doc.setFont('courier', 'normal');
  doc.text(formatarValor(data.margem), margin + doc.getTextWidth('MARGEM CONSIGNÁVEL (30%): '), y);
  doc.setFont('courier', 'bold');
  doc.text('Nº DE PARCELA: ', pageWidth / 2, y);
  doc.setFont('courier', 'normal');
  doc.text(data.parcelas, pageWidth / 2 + doc.getTextWidth('Nº DE PARCELA: '), y);
  y += lineH;

  // VALOR DA PARCELA + VALOR CONTRATO
  doc.setFont('courier', 'bold');
  doc.text('VALOR DA PARCELA: ', margin, y);
  doc.setFont('courier', 'normal');
  doc.text(formatarValor(data.valorParcela), margin + doc.getTextWidth('VALOR DA PARCELA: '), y);
  doc.setFont('courier', 'bold');
  doc.text('VALOR CONTRATO: ', pageWidth / 2, y);
  doc.setFont('courier', 'normal');
  doc.text(formatarValor(data.valorTotal), pageWidth / 2 + doc.getTextWidth('VALOR CONTRATO: '), y);
  y += lineH;

  // 1º DESCONTO + CONSIGNATÁRIA
  doc.setFont('courier', 'bold');
  doc.text('1º DESCONTO: ', margin, y);
  doc.setFont('courier', 'normal');
  doc.text(formatarData(data.prDesconto), margin + doc.getTextWidth('1º DESCONTO: '), y);
  doc.setFont('courier', 'bold');
  doc.text('CONSIGNATÁRIA: ', pageWidth / 2, y);
  doc.setFont('courier', 'normal');
  doc.text(data.consignataria, pageWidth / 2 + doc.getTextWidth('CONSIGNATÁRIA: '), y);
  y += lineH + 3;

  // ── Texto declaratório ────────────────────────────────────────────────────
  doc.setFont('courier', 'normal');
  doc.setFontSize(10);

  const declaracao = [
    '      Declaro para fins de crédito pessoal que o(a) Servidor(a)  acima,',
    'apresenta para os meses conforme vencimentos regulares dentro do limite',
    'consignável  de 30% (trinta por cento) , para desconto em contra-cheque',
    'no valor descrito acima para  fins de contrair empréstimos junto a esta',
    'instituição.',
  ];

  for (const linha of declaracao) {
    doc.text(linha, margin, y);
    y += 5;
  }

  y += 10;

  // ── Data ──────────────────────────────────────────────────────────────────
  doc.text(dataHoje + '.', margin, y);
  y += 20;

  // ── Assinaturas ──────────────────────────────────────────────────────────
  const sigWidth = 60;
  const sig1X = pageWidth / 2 - sigWidth - 5;
  const sig2X = pageWidth / 2 + 5;

  // Linha assinatura servidor
  doc.setLineWidth(0.3);
  doc.line(sig1X, y, sig1X + sigWidth, y);
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  const nomeAbrev = data.nome.toUpperCase().substring(0, 28);
  doc.text(nomeAbrev, sig1X + sigWidth / 2, y + 5, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Servidor(a)', sig1X + sigWidth / 2, y + 9, { align: 'center' });

  // Linha assinatura presidente
  doc.line(sig2X, y, sig2X + sigWidth, y);
  doc.setFontSize(9);
  doc.text('MIGUEL NUNES', sig2X + sigWidth / 2, y + 5, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Presidente', sig2X + sigWidth / 2, y + 9, { align: 'center' });

  return doc.output('arraybuffer');
}
