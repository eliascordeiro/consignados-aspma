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

  // ── Desenha uma via a partir de yBase ───────────────────────────────────────
  function drawCopy(yBase: number) {

    // ── Faixa azul ──────────────────────────────────────────────────────────
    doc.setFillColor(...C.blue);
    doc.rect(0, yBase, W, 12, 'F');
    doc.setFillColor(...C.darkBlue);
    doc.rect(0, yBase, 5, 12, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.white);
    doc.text('A.S.P.M.A.', ML, yBase + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Associação dos Servidores da Prefeitura do Município de Araucária', ML + 22, yBase + 5.5);

    doc.setFontSize(7);
    doc.text('Rua Raimundo Suckow, 129 – Jardim Iguaçu – Araucária/PR  |  Fones: (41) 642-4155 / 642-7796', ML, yBase + 10.5);

    // ── Título ──────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...C.dark);
    doc.text('DECLARAÇÃO', W / 2, yBase + 20, { align: 'center' });

    doc.setDrawColor(...C.blue);
    doc.setLineWidth(0.7);
    doc.line(ML + 45, yBase + 22, W - ML - 45, yBase + 22);
    doc.setLineWidth(0.2);

    // ── Box de dados ────────────────────────────────────────────────────────
    const boxY = yBase + 26;
    const boxH = 30;
    doc.setFillColor(...C.lightBg);
    doc.setDrawColor(...C.accent);
    doc.setLineWidth(0.4);
    doc.roundedRect(ML, boxY, CW, boxH, 2, 2, 'FD');
    // Acento lateral
    doc.setFillColor(...C.blue);
    doc.rect(ML, boxY, 2.5, boxH, 'F');

    const rows: { label: string; value: string; bold?: boolean; blue?: boolean }[] = [
      { label: 'AO CONVÊNIO', value: (data.convenio || '—').toUpperCase() },
      { label: 'MATRÍCULA',   value: data.matricula || '—' },
      { label: 'ASSOCIADO',   value: (data.nome || '—').toUpperCase() },
      { label: 'VALOR',       value: valorFormatado, bold: true, blue: true },
    ];

    rows.forEach((row, i) => {
      const ry = boxY + 7.5 + i * 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.gray);
      doc.text(row.label + ':', ML + 5, ry);
      doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
      doc.setFontSize(8.5);
      if (row.blue) {
        doc.setTextColor(...C.blue);
      } else {
        doc.setTextColor(...C.dark);
      }
      doc.text(row.value, ML + 40, ry);
    });

    let y = boxY + boxH + 4;  // yBase + 60

    // ── Observações (opcional) ───────────────────────────────────────────────
    if (hasObs) {
      const obsH = hasObs2 ? 14 : 9;
      doc.setFillColor(...C.obsBg);
      doc.setDrawColor(...C.obsLine);
      doc.setLineWidth(0.3);
      doc.roundedRect(ML, y, CW, obsH, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.gray);
      doc.text('OBS:', ML + 3, y + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.dark);
      doc.text(data.obs1.toUpperCase().substring(0, 66), ML + 14, y + 5.5);
      if (hasObs2) {
        doc.text(data.obs2.toUpperCase().substring(0, 66), ML + 14, y + 11);
      }
      y += obsH + 4;
    }

    // ── Texto declaratório ───────────────────────────────────────────────────
    const bodyH = 27;
    doc.setFillColor(...C.bodyBg);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, CW, bodyH, 2, 2, 'FD');
    // Acento lateral azul
    doc.setFillColor(...C.blue);
    doc.rect(ML, y, 2.5, bodyH, 'F');

    const bodyLines = [
      '     Declaro para fins de crédito pessoal que o(a) Associado(a)',
      'acima apresenta vencimentos regulares dentro do limite consignável',
      'de 30% (trinta por cento), para desconto em contracheque no valor',
      'descrito acima, para fins de contrair empréstimos nesta instituição.',
    ];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.dark);
    bodyLines.forEach((line, i) => {
      doc.text(line, ML + 5, y + 7 + i * 5);
    });

    y += bodyH + 5;

    // ── Data ────────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...C.dark);
    doc.text(dataFormatada, ML, y);

    // ── Assinatura ───────────────────────────────────────────────────────────
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    doc.text('Atenciosamente,', ML, y);

    y += 10;
    const sigX = W / 2;
    doc.setDrawColor(...C.dark);
    doc.setLineWidth(0.3);
    doc.line(sigX - 28, y, sigX + 28, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.dark);
    doc.text('MIGUEL NUNES', sigX, y + 4.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.gray);
    doc.text('Presidente', sigX, y + 9, { align: 'center' });
  }

  // ── 1ª via ──────────────────────────────────────────────────────────────────
  drawCopy(5);

  // ── Separador tracejado ──────────────────────────────────────────────────────
  const sepY = 140;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  for (let dx = 0; dx <= CW; dx += 4) {
    doc.line(ML + dx, sepY, ML + Math.min(dx + 2.5, CW), sepY);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text('- - - - - - 2ª VIA - - - - - -', W / 2, sepY - 1.5, { align: 'center' });

  // ── 2ª via ──────────────────────────────────────────────────────────────────
  drawCopy(145);

  return doc.output('arraybuffer');
}
