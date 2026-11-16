import type { MatrixRowStat } from './capacityStats';

export interface MatrixExportData {
  title?: string;
  contratas: string[];
  matrixRows: MatrixRowStat[];
  matrixTotalsByContrata: Record<string, number>;
  totalField: number;
}

const DEFAULT_TITLE = 'Matriz Especialidad vs. Contratista';

function sanitizeTsvCell(value: string | number): string {
  return String(value).replace(/[\t\r\n]+/g, ' ').trim();
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds a tab-separated values (TSV) representation of the matrix
 * suitable for pasting into Excel, Google Sheets, or plain text editors.
 */
export function buildMatrixTsv(data: MatrixExportData): string {
  const header = ['Especialidad', ...data.contratas, 'Total'].map(sanitizeTsvCell).join('\t');

  const bodyRows = data.matrixRows.map((row) =>
    [
      row.label,
      ...data.contratas.map((c) => row.countsByContrata[c] ?? 0),
      row.total,
    ]
      .map(sanitizeTsvCell)
      .join('\t'),
  );

  const footer = [
    'Total',
    ...data.contratas.map((c) => data.matrixTotalsByContrata[c] ?? 0),
    data.totalField,
  ]
    .map(sanitizeTsvCell)
    .join('\t');

  return [header, ...bodyRows, footer].join('\n');
}

/**
 * Builds an HTML table with inline styles so Excel preserves headers,
 * borders, alternating row shading, and number alignment on paste.
 */
export function buildMatrixExcelHtml(data: MatrixExportData): string {
  const thStyle =
    'background-color:#EEF2FF;color:#1E3A8A;font-weight:700;border:1px solid #CBD5E1;padding:6px 10px;font-family:Segoe UI,Arial,sans-serif;font-size:12px;';

  const headerCells = [
    `<th style="${thStyle}text-align:left;">Especialidad</th>`,
    ...data.contratas.map((c) => `<th style="${thStyle}text-align:right;">${escapeHtml(c)}</th>`),
    `<th style="${thStyle}text-align:right;">Total</th>`,
  ].join('');

  const bodyRows = data.matrixRows
    .map((row, idx) => {
      const bg = idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
      const baseCell = `background-color:${bg};border:1px solid #E2E8F0;padding:5px 10px;font-family:Segoe UI,Arial,sans-serif;font-size:12px;`;
      const contractorCells = data.contratas
        .map((c) => {
          const val = row.countsByContrata[c] ?? 0;
          const color = val > 0 ? '#0F172A' : '#94A3B8';
          return `<td style="${baseCell}text-align:right;color:${color};">${val}</td>`;
        })
        .join('');

      return `<tr><td style="${baseCell}text-align:left;font-weight:600;color:#0F172A;">${escapeHtml(row.label)}</td>${contractorCells}<td style="${baseCell}text-align:right;font-weight:700;color:#3C5A9F;">${row.total}</td></tr>`;
    })
    .join('');

  const footStyle =
    'background-color:#F1F5F9;border:1px solid #CBD5E1;padding:6px 10px;font-family:Segoe UI,Arial,sans-serif;font-size:12px;font-weight:700;';
  const footerCells = [
    `<td style="${footStyle}text-align:left;color:#0F172A;">Total</td>`,
    ...data.contratas.map(
      (c) =>
        `<td style="${footStyle}text-align:right;color:#0F172A;">${data.matrixTotalsByContrata[c] ?? 0}</td>`,
    ),
    `<td style="${footStyle}text-align:right;color:#3C5A9F;">${data.totalField}</td>`,
  ].join('');

  return `<table style="border-collapse:collapse;"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody><tfoot><tr>${footerCells}</tr></tfoot></table>`;
}

/**
 * Copies the matrix to the clipboard as rich HTML + plain TSV for Excel.
 */
export async function copyMatrixForExcel(data: MatrixExportData): Promise<void> {
  const tsv = buildMatrixTsv(data);
  const html = buildMatrixExcelHtml(data);

  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  ) {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([tsv], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return;
    } catch {
      // Fallback to plain text TSV below
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(tsv);
    return;
  }

  throw new Error('Portapapeles no disponible en este navegador.');
}

/**
 * Renders the matrix card onto a high-DPI HTML5 canvas without external dependencies.
 */
export function renderMatrixToCanvas(data: MatrixExportData): HTMLCanvasElement {
  const title = data.title ?? DEFAULT_TITLE;
  const dpr = 2;
  const fontFamily = '"Segoe UI", system-ui, -apple-system, Arial, sans-serif';

  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  if (!mCtx) {
    throw new Error('No se pudo inicializar el contexto 2D del canvas.');
  }

  const padX = 14;
  const bannerHeight = 40;
  const headerHeight = 36;
  const rowHeight = 32;
  const footerHeight = 36;

  mCtx.font = `700 12px ${fontFamily}`;
  const labelWidth = Math.max(
    180,
    ...data.matrixRows.map((r) => Math.ceil(mCtx.measureText(r.label).width) + padX * 2),
  );

  const contrataWidths = data.contratas.map((c) => {
    const headerW = Math.ceil(mCtx.measureText(c).width) + padX * 2;
    return Math.max(76, headerW);
  });

  const totalColWidth = 76;
  const minBannerWidth = Math.ceil(mCtx.measureText(title).width) + 40;
  const columnsWidth =
    labelWidth + contrataWidths.reduce((sum, w) => sum + w, 0) + totalColWidth;
  const totalWidth = Math.max(columnsWidth, minBannerWidth);

  // If banner forced extra width, give it to the first column
  const firstColWidth = labelWidth + (totalWidth - columnsWidth);
  const totalHeight =
    bannerHeight + headerHeight + data.matrixRows.length * rowHeight + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth * dpr;
  canvas.height = totalHeight * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el contexto 2D del canvas.');
  }

  ctx.scale(dpr, dpr);
  ctx.textBaseline = 'middle';

  // Card background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Title banner
  ctx.fillStyle = '#3C5A9F';
  ctx.fillRect(0, 0, totalWidth, bannerHeight);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 14px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.fillText(title, 16, bannerHeight / 2);

  // Column x-offsets
  const colWidths = [firstColWidth, ...contrataWidths, totalColWidth];
  const colStarts: number[] = [];
  let cursorX = 0;
  for (const w of colWidths) {
    colStarts.push(cursorX);
    cursorX += w;
  }

  // Table header row
  let y = bannerHeight;
  ctx.fillStyle = '#EEF2FF';
  ctx.fillRect(0, y, totalWidth, headerHeight);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y + headerHeight - 0.5);
  ctx.lineTo(totalWidth, y + headerHeight - 0.5);
  ctx.stroke();

  ctx.fillStyle = '#1E3A8A';
  ctx.font = `700 12px ${fontFamily}`;
  const headers = ['Especialidad', ...data.contratas, 'Total'];
  headers.forEach((text, i) => {
    const isFirst = i === 0;
    ctx.textAlign = isFirst ? 'left' : 'right';
    const textX = isFirst ? colStarts[i] + padX : colStarts[i] + colWidths[i] - padX;
    ctx.fillText(text, textX, y + headerHeight / 2);
  });

  // Body rows
  y += headerHeight;
  data.matrixRows.forEach((row, idx) => {
    ctx.fillStyle = idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
    ctx.fillRect(0, y, totalWidth, rowHeight);

    ctx.strokeStyle = '#F1F5F9';
    ctx.beginPath();
    ctx.moveTo(0, y + rowHeight - 0.5);
    ctx.lineTo(totalWidth, y + rowHeight - 0.5);
    ctx.stroke();

    // Label
    ctx.fillStyle = '#0F172A';
    ctx.font = `600 12px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.fillText(row.label, colStarts[0] + padX, y + rowHeight / 2);

    // Contractor counts
    ctx.font = `400 12px ${fontFamily}`;
    ctx.textAlign = 'right';
    data.contratas.forEach((c, cIdx) => {
      const val = row.countsByContrata[c] ?? 0;
      ctx.fillStyle = val > 0 ? '#0F172A' : '#94A3B8';
      const colIdx = cIdx + 1;
      ctx.fillText(String(val), colStarts[colIdx] + colWidths[colIdx] - padX, y + rowHeight / 2);
    });

    // Row total
    const lastIdx = colWidths.length - 1;
    ctx.fillStyle = '#3C5A9F';
    ctx.font = `700 12px ${fontFamily}`;
    ctx.fillText(String(row.total), colStarts[lastIdx] + colWidths[lastIdx] - padX, y + rowHeight / 2);

    y += rowHeight;
  });

  // Footer row
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(0, y, totalWidth, footerHeight);
  ctx.strokeStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.moveTo(0, y + 0.5);
  ctx.lineTo(totalWidth, y + 0.5);
  ctx.stroke();

  ctx.font = `700 12px ${fontFamily}`;
  ctx.fillStyle = '#0F172A';
  ctx.textAlign = 'left';
  ctx.fillText('Total', colStarts[0] + padX, y + footerHeight / 2);

  ctx.textAlign = 'right';
  data.contratas.forEach((c, cIdx) => {
    const colIdx = cIdx + 1;
    const total = data.matrixTotalsByContrata[c] ?? 0;
    ctx.fillText(String(total), colStarts[colIdx] + colWidths[colIdx] - padX, y + footerHeight / 2);
  });

  const lastIdx = colWidths.length - 1;
  ctx.fillStyle = '#3C5A9F';
  ctx.fillText(
    String(data.totalField),
    colStarts[lastIdx] + colWidths[lastIdx] - padX,
    y + footerHeight / 2,
  );

  // Outer border
  ctx.strokeStyle = '#CBD5E1';
  ctx.strokeRect(0.5, 0.5, totalWidth - 1, totalHeight - 1);

  return canvas;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('No se pudo generar la imagen PNG.'));
      }
    }, 'image/png');
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Renders the matrix to a PNG image and copies it to the clipboard.
 * Falls back to downloading the PNG if clipboard image write is unsupported.
 */
export async function copyMatrixAsImage(
  data: MatrixExportData,
): Promise<'copied' | 'downloaded'> {
  const canvas = renderMatrixToCanvas(data);
  const blob = await canvasToPngBlob(canvas);

  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  ) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return 'copied';
    } catch {
      // Fallback to downloading the image
    }
  }

  downloadBlob(blob, 'matriz-especialidad-contratista.png');
  return 'downloaded';
}
