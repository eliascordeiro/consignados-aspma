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
      obs1 = '',
      obs2 = '',
      valor = '',
      convenio = '',
    } = body;

    if (!nome) {
      return NextResponse.json({ error: 'Dados do sócio são obrigatórios' }, { status: 400 });
    }

    const pdfBuffer = gerarPDFDeclaracao({ nome, matricula, obs1, obs2, valor, convenio });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="declaracao-${matricula || 'socio'}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Erro ao gerar declaração P.M.A.:', error);
    return NextResponse.json({ error: 'Erro ao gerar PDF' }, { status: 500 });
  }
}

function fmt_valor(val: string | number): string {
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  if (isNaN(num) || num === 0) return '—';
  return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function gerarPDFDeclaracao(data: {
  nome: string;
  matricula: string;
  obs1: string;
  obs2: string;
  valor: string;
  convenio: string;
}): ArrayBuffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W  = doc.internal.pageSize.width;   // 210
  const ML = 18;
  const CW = W - ML * 2;                    // 174

  const MESES = ['janeiro','fevereiro','março','abril','maio','junho',
                 'julho','agosto','setembro','outubro','novembro','dezembro'];
  const now = new Date();
  const dataFormatada = `Araucária, ${String(now.getDate()).padStart(2, '0')} de ${MESES[now.getMonth()]} de ${now.getFullYear()}.`;

  const valorFormatado = fmt_valor(data.valor);
  const hasObs  = !!data.obs1.trim();
  const hasObs2 = !!data.obs2.trim();

  // ── Paleta ─────────────────────────────────────────────────────────────────
  const C = {
    blue:    [41, 128, 185]  as [number,number,number],
    darkBlue:[26, 100, 145]  as [number,number,number],
    dark:    [30,  39,  46]  as [number,number,number],
    gray:    [99, 110, 114]  as [number,number,number],
    border:  [189,195, 199]  as [number,number,number],
    lightBg: [235,245, 251]  as [number,number,number],
    bodyBg:  [248,249, 250]  as [number,number,number],
    obsBg:   [255,249, 219]  as [number,number,number],
    obsLine: [212,172,  13]  as [number,number,number],
    accent:  [52, 152, 219]  as [number,number,number],
    white:   [255,255, 255]  as [number,number,number],
  };

  // ── Desenha uma via; retorna posição Y do fim ───────────────────────────────
  function drawCopy(yBase: number): number {
    const HDR = 20; // cabeçalho mais alto para acomodar fontes maiores

    // ── Faixa de cabeçalho ───────────────────────────────────────────────────
    doc.setFillColor(...C.darkBlue);
    doc.rect(0, yBase, W, HDR, 'F');
    doc.setFillColor(...C.blue);
    doc.rect(12, yBase, W - 12, HDR, 'F');
    doc.setFillColor(180, 220, 240);
    doc.rect(12, yBase, 0.8, HDR, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...C.white);
    doc.text('A.S.P.M.A.', ML, yBase + 9);

    doc.setDrawColor(180, 220, 240);
    doc.setLineWidth(0.2);
    doc.line(ML, yBase + 11.5, W - ML, yBase + 11.5);

    // Fontes do cabeçalho aumentadas conforme solicitado
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(220, 235, 245);
    doc.text('Associação dos Servidores da Prefeitura do Município de Araucária', ML, yBase + 15.5);
    doc.setFontSize(8);
    doc.setTextColor(190, 215, 235);
    doc.text('Rua Raimundo Suckow, 129 – Jardim Iguaçu – Araucária/PR  |  Fones: (41) 642-4155 / 642-7796', ML, yBase + 19.5);

    // ── Título do documento ──────────────────────────────────────────────────
    const titleY = yBase + HDR + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...C.dark);
    doc.text('DECLARAÇÃO', W / 2, titleY, { align: 'center' });

    doc.setDrawColor(...C.blue);
    doc.setLineWidth(0.8);
    doc.line(ML + 38, titleY + 2, W - ML - 38, titleY + 2);
    doc.setLineWidth(0.25);
    doc.line(ML + 42, titleY + 3.5, W - ML - 42, titleY + 3.5);
    doc.setLineWidth(0.2);

    // ── Box de dados ────────────────────────────────────────────────────────
    const boxY = titleY + 5;
    const rows: { label: string; value: string; bold?: boolean; blue?: boolean }[] = [
      { label: 'AO CONVÊNIO', value: (data.convenio || '—').toUpperCase() },
      { label: 'MATRÍCULA',   value: data.matricula || '—' },
      { label: 'ASSOCIADO',   value: (data.nome || '—').toUpperCase() },
      { label: 'VALOR',       value: valorFormatado, bold: true, blue: true },
    ];
    const rowH = 7.0;
    const boxH = rows.length * rowH + 2;   // 30mm

    doc.setFillColor(...C.lightBg);
    doc.setDrawColor(...C.accent);
    doc.setLineWidth(0.35);
    doc.roundedRect(ML, boxY, CW, boxH, 2.5, 2.5, 'FD');
    doc.setFillColor(...C.blue);
    doc.roundedRect(ML, boxY, 3, boxH, 1.5, 1.5, 'F');

    rows.forEach((row, i) => {
      const ry = boxY + 7 + i * rowH;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.gray);
      doc.text(row.label + ':', ML + 6, ry);
      if (i > 0) {
        doc.setDrawColor(220, 228, 235);
        doc.setLineWidth(0.15);
        doc.line(ML + 3, ry - 5, ML + CW - 1, ry - 5);
      }
      doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
      doc.setFontSize(9);
      doc.setTextColor(row.blue ? C.blue[0] : C.dark[0], row.blue ? C.blue[1] : C.dark[1], row.blue ? C.blue[2] : C.dark[2]);
      doc.text(row.value, ML + 42, ry);
    });

    let y = boxY + boxH + 4;

    // ── Observações (opcional) ───────────────────────────────────────────────
    if (hasObs) {
      const obsH = hasObs2 ? 12 : 8;
      doc.setFillColor(...C.obsBg);
      doc.setDrawColor(...C.obsLine);
      doc.setLineWidth(0.35);
      doc.roundedRect(ML, y, CW, obsH, 2, 2, 'FD');
      doc.setFillColor(...C.obsLine);
      doc.roundedRect(ML, y, 3, obsH, 1.5, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(140, 100, 10);
      doc.text('OBS.:', ML + 6, y + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...C.dark);
      doc.text(data.obs1.toUpperCase().substring(0, 64), ML + 20, y + 5.5);
      if (hasObs2) {
        doc.text(data.obs2.toUpperCase().substring(0, 64), ML + 20, y + 10);
      }
      y += obsH + 3;
    }

    // ── Texto declaratório ───────────────────────────────────────────────────
    const bodyH = 26;
    doc.setFillColor(...C.bodyBg);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, CW, bodyH, 2.5, 2.5, 'FD');
    doc.setFillColor(...C.blue);
    doc.roundedRect(ML, y, 3, bodyH, 1.5, 1.5, 'F');

    const txtX = ML + 8;
    const txtW = CW - 10;
    const bodyText =
      '     Declaro para fins de crédito pessoal que o(a) Associado(a) acima ' +
      'apresenta vencimentos regulares dentro do limite consignável de 30% ' +
      '(trinta por cento), para desconto em contracheque no valor descrito ' +
      'acima, para fins de contrair empréstimos junto a esta instituição.';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...C.dark);
    const wrappedLines = doc.splitTextToSize(bodyText, txtW);
    wrappedLines.forEach((line: string, i: number) => {
      doc.text(line, txtX, y + 7 + i * 6);
    });

    y += bodyH + 4;

    // ── Data ─────────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...C.dark);
    doc.text(dataFormatada, ML, y);
    y += 8;

    // ── Atenciosamente ────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.gray);
    doc.text('Atenciosamente,', ML, y);
    y += 9;

    // ── Assinatura ────────────────────────────────────────────────────────────
    const sigX = W / 2;
    doc.setDrawColor(...C.dark);
    doc.setLineWidth(0.4);
    doc.line(sigX - 34, y, sigX + 34, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...C.dark);
    doc.text('MIGUEL NUNES', sigX, y + 4, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    doc.text('Presidente', sigX, y + 8, { align: 'center' });

    return y + 10; // retorna o Y do fim desta via
  }

  // ── 1ª via ──────────────────────────────────────────────────────────────────
  const via1End = drawCopy(4);

  // ── Separador tracejado (dinâmico: sempre após o fim real da 1ª via) ─────────
  const sepY = via1End + 5;
  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.25);
  for (let dx = 0; dx <= CW; dx += 3.5) {
    doc.line(ML + dx, sepY, ML + Math.min(dx + 2, CW), sepY);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(160, 160, 160);
  doc.text('✂  2ª VIA', W / 2, sepY - 1.5, { align: 'center' });

  // ── 2ª via ──────────────────────────────────────────────────────────────────
  drawCopy(sepY + 4);

  return doc.output('arraybuffer');
}
