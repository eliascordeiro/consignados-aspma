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

function fmt_data(isoDate: string): string {
  if (!isoDate) return '—';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function fmt_valor(val: string | number): string {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num) || num === 0) return '—';
  return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W  = doc.internal.pageSize.width;   // 210
  const H  = doc.internal.pageSize.height;  // 297
  const ML = 18;   // margin left/right
  const CW = W - ML * 2;

  // ── Paleta ────────────────────────────────────────────────────────────────
  const C = {
    primary:   [41,  128, 185] as [number,number,number],
    dark:      [30,   39,  46] as [number,number,number],
    gray:      [99,  110, 114] as [number,number,number],
    light:     [236, 240, 241] as [number,number,number],
    white:     [255, 255, 255] as [number,number,number],
    border:    [189, 195, 199] as [number,number,number],
    gold:      [212, 172,  13] as [number,number,number],
    accent:    [52,  152, 219] as [number,number,number],
    success:   [39,  174,  96] as [number,number,number],
    lightBlue: [235, 245, 251] as [number,number,number],
  };

  const now = new Date();
  const MESES = ['janeiro','fevereiro','março','abril','maio','junho',
                 'julho','agosto','setembro','outubro','novembro','dezembro'];
  const dataFormatada = `Araucária, ${String(now.getDate()).padStart(2,'0')} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`;

  // ══════════════════════════════════════════════════════════════════════════
  // FAIXA SUPERIOR COLORIDA
  // ══════════════════════════════════════════════════════════════════════════
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, W, 28, 'F');

  // Acento lateral escuro
  doc.setFillColor(26, 100, 145);
  doc.rect(0, 0, 5, 28, 'F');

  // Título da instituição
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(...C.white);
  doc.text('F.P.M.A.', ML, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Fundo de Previdência Municipal de Araucária', ML, 17);
  doc.text('R. São Vicente de Paulo, 131 – Centro – Araucária-PR  |  CNPJ: 04.105.170/0001-38', ML, 22);

  // Círculo dourado — Documento Oficial
  doc.setFillColor(...C.gold);
  doc.circle(W - ML - 8, 14, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(...C.white);
  doc.text('DOCUMENTO', W - ML - 8, 11.5, { align: 'center' });
  doc.text('OFICIAL', W - ML - 8, 14.5, { align: 'center' });
  doc.text('ASPMA', W - ML - 8, 17.5, { align: 'center' });

  // ══════════════════════════════════════════════════════════════════════════
  // TÍTULO DO DOCUMENTO
  // ══════════════════════════════════════════════════════════════════════════
  let y = 38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...C.dark);
  doc.text('CONFIRMAÇÃO DE AVERBAÇÃO', W / 2, y, { align: 'center' });

  // Linha decorativa abaixo do título
  y += 3;
  doc.setDrawColor(...C.primary);
  doc.setLineWidth(0.8);
  doc.line(ML + 30, y, W - ML - 30, y);
  doc.setLineWidth(0.2);

  // ══════════════════════════════════════════════════════════════════════════
  // BOX — IDENTIFICAÇÃO DO ASSOCIADO
  // ══════════════════════════════════════════════════════════════════════════
  y += 8;

  // Fundo do box
  doc.setFillColor(...C.lightBlue);
  doc.setDrawColor(...C.accent);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML, y, CW, 22, 2, 2, 'FD');

  // Badge "MATRÍCULA"
  doc.setFillColor(...C.primary);
  doc.roundedRect(ML + 3, y + 4, 32, 14, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.white);
  doc.text('MATRÍCULA', ML + 19, y + 9.5, { align: 'center' });
  doc.setFontSize(13);
  doc.text(data.matricula || '—', ML + 19, y + 16, { align: 'center' });

  // Separador
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(ML + 38, y + 4, ML + 38, y + 18);

  // Nome
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.gray);
  doc.text('NOME DO ASSOCIADO', ML + 42, y + 8);
  doc.setFontSize(11);
  doc.setTextColor(...C.dark);
  doc.text((data.nome || '—').toUpperCase().substring(0, 38), ML + 42, y + 15);

  // CPF (canto direito)
  if (data.cpf) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.gray);
    doc.text('C.P.F', W - ML - 35, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...C.dark);
    doc.text(data.cpf, W - ML - 35, y + 15);
  }

  y += 28;

  // ══════════════════════════════════════════════════════════════════════════
  // SEÇÃO — DADOS DO CONTRATO (grade de campos)
  // ══════════════════════════════════════════════════════════════════════════

  // Cabeçalho da seção
  doc.setFillColor(...C.light);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, 6, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.gray);
  doc.text('DADOS DO CONTRATO', ML + 4, y + 4.2);
  y += 10;

  // Helper: desenha um "campo" com label cinza + valor preto em box arredondado
  const campo = (label: string, value: string, x: number, yy: number, w: number): void => {
    doc.setFillColor(250, 251, 252);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, yy, w, 12, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.gray);
    doc.text(label.toUpperCase(), x + 3, yy + 4.5);
    // Ajusta font size para caber no campo
    const maxW = w - 6;
    let fs = 9.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fs);
    while (doc.getTextWidth(value || '—') > maxW && fs > 6) {
      fs -= 0.5;
      doc.setFontSize(fs);
    }
    doc.setTextColor(...C.dark);
    doc.text(value || '—', x + 3, yy + 10.5);
  };

  const half  = (CW - 4) / 2;
  const third = (CW - 8) / 3;
  const gap   = 4;

  // Linha 1: Situação | Nº Contrato
  campo('Situação',     data.situacao || '—',     ML,          y, half);
  campo('Nº do Contrato', data.contrato || '—',   ML + half + gap, y, half);
  y += 16;

  // Linha 2: Admissão | 1º Desconto | Margem (30%)
  campo('Admissão',       fmt_data(data.admissao),   ML,                   y, third);
  campo('1º Desconto',    fmt_data(data.prDesconto),  ML + third + gap,    y, third);
  campo('Margem (30%)',   fmt_valor(data.margem),     ML + (third+gap)*2,  y, third);
  y += 16;

  // Linha 3: Nº Parcelas | Valor da Parcela | Valor do Contrato
  campo('Nº de Parcelas',   data.parcelas || '—',     ML,                   y, third);
  campo('Valor da Parcela', fmt_valor(data.valorParcela), ML + third + gap, y, third);
  campo('Valor do Contrato',fmt_valor(data.valorTotal),   ML + (third+gap)*2, y, third);
  y += 20;

  // ══════════════════════════════════════════════════════════════════════════
  // SEÇÃO — CONSIGNATÁRIA / CONVÊNIO
  // ══════════════════════════════════════════════════════════════════════════
  doc.setFillColor(...C.light);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, 6, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.gray);
  doc.text('INSTITUIÇÃO FINANCEIRA', ML + 4, y + 4.2);
  y += 10;

  campo('Consignatária', data.consignataria || '—', ML, y, CW);
  y += 16;
  const convW = CW * 0.62;
  const cnpjW = CW - convW - gap;
  campo('Convênio', data.convenio || '—', ML, y, convW);
  campo('C.N.P.J', data.cnpj || '—', ML + convW + gap, y, cnpjW);
  y += 20;

  // ══════════════════════════════════════════════════════════════════════════
  // TEXTO DECLARATÓRIO
  // ══════════════════════════════════════════════════════════════════════════
  // Box azul claro
  doc.setFillColor(...C.lightBlue);
  doc.setDrawColor(...C.accent);
  doc.setLineWidth(0.35);
  doc.roundedRect(ML, y, CW, 34, 2, 2, 'FD');

  // Barra lateral colorida
  doc.setFillColor(...C.primary);
  doc.roundedRect(ML, y, 3.5, 34, 1, 1, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.dark);

  const declaracaoTexto =
    `Declaro para fins de crédito pessoal que o(a) Servidor(a) acima apresenta, para os meses ` +
    `conforme vencimentos regulares, renda dentro do limite consignável de 30% (trinta por cento), ` +
    `para desconto em contracheque, no valor descrito acima, para fins de contrair empréstimos ` +
    `junto a esta instituição.`;

  const linhas = doc.splitTextToSize(declaracaoTexto, CW - 14);
  let ly = y + 7;
  for (const linha of linhas) {
    doc.text(linha, ML + 7, ly);
    ly += 5.5;
  }
  y += 38;

  // ══════════════════════════════════════════════════════════════════════════
  // DATA + ASSINATURAS
  // ══════════════════════════════════════════════════════════════════════════
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.dark);
  doc.text(dataFormatada + '.', W / 2, y, { align: 'center' });
  y += 16;

  const sigW = 65;
  const sig1X = W / 2 - sigW - 6;
  const sig2X = W / 2 + 6;

  // Assinatura 1 — Servidor(a)
  doc.setDrawColor(...C.gray);
  doc.setLineWidth(0.4);
  doc.line(sig1X, y, sig1X + sigW, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.dark);
  doc.text(
    (data.nome || '').toUpperCase().substring(0, 30),
    sig1X + sigW / 2, y + 5.5, { align: 'center' }
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.gray);
  doc.text('Servidor(a) / Associado(a)', sig1X + sigW / 2, y + 10, { align: 'center' });

  // Assinatura 2 — Presidente
  doc.setDrawColor(...C.gray);
  doc.line(sig2X, y, sig2X + sigW, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.dark);
  doc.text('MIGUEL NUNES', sig2X + sigW / 2, y + 5.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.gray);
  doc.text('Presidente — F.P.M.A.', sig2X + sigW / 2, y + 10, { align: 'center' });

  // ══════════════════════════════════════════════════════════════════════════
  // RODAPÉ
  // ══════════════════════════════════════════════════════════════════════════
  doc.setFillColor(...C.primary);
  doc.rect(0, H - 10, W, 10, 'F');
  doc.setFillColor(26, 100, 145);
  doc.rect(0, H - 10, 5, 10, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.white);
  doc.text(
    'F.P.M.A. — Fundo de Previdência Municipal de Araucária  |  (41) 3642-4075',
    W / 2, H - 4.5, { align: 'center' }
  );

  return doc.output('arraybuffer');
}
