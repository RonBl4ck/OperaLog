import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  buildMatrixExcelHtml,
  buildMatrixTsv,
  copyMatrixAsImage,
  copyMatrixForExcel,
  type MatrixExportData,
} from './matrixExport';

const SAMPLE_DATA: MatrixExportData = {
  contratas: ['ALFA', 'BETA'],
  matrixRows: [
    {
      category: 'RECLAMISTA',
      label: 'Reclamistas',
      countsByContrata: { ALFA: 2, BETA: 1 },
      total: 3,
    },
    {
      category: 'TEKO',
      label: 'Tekos (Brazos Hidráulicos)',
      countsByContrata: { ALFA: 0, BETA: 1 },
      total: 1,
    },
  ],
  matrixTotalsByContrata: { ALFA: 2, BETA: 2 },
  totalField: 4,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('matrixExport', () => {
  it('builds valid TSV with headers, rows, and totals', () => {
    const tsv = buildMatrixTsv(SAMPLE_DATA);
    expect(tsv).toBe(
      [
        'Especialidad\tALFA\tBETA\tTotal',
        'Reclamistas\t2\t1\t3',
        'Tekos (Brazos Hidráulicos)\t0\t1\t1',
        'Total\t2\t2\t4',
      ].join('\n'),
    );
  });

  it('builds valid HTML table escaping special characters', () => {
    const html = buildMatrixExcelHtml({
      ...SAMPLE_DATA,
      contratas: ['A&B', 'BETA'],
      matrixRows: [
        {
          category: 'RECLAMISTA',
          label: 'Reclamistas <A>',
          countsByContrata: { 'A&B': 2, BETA: 1 },
          total: 3,
        },
      ],
      matrixTotalsByContrata: { 'A&B': 2, BETA: 1 },
      totalField: 3,
    });

    expect(html).toContain('<table');
    expect(html).toContain('A&amp;B');
    expect(html).toContain('Reclamistas &lt;A&gt;');
    expect(html).toContain('<tfoot>');
  });

  it('copies TSV via writeText fallback when ClipboardItem is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    await copyMatrixForExcel(SAMPLE_DATA);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(buildMatrixTsv(SAMPLE_DATA));
  });

  it('renders canvas and copies PNG image when ClipboardItem and write are available', async () => {
    const mockCtx = {
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      textAlign: 'left',
      textBaseline: 'middle',
      measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
      scale: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => {
      cb(new Blob(['fake-png'], { type: 'image/png' }));
    });

    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { write },
      configurable: true,
    });

    class MockClipboardItem {
      items: Record<string, Blob>;
      constructor(items: Record<string, Blob>) {
        this.items = items;
      }
    }
    vi.stubGlobal('ClipboardItem', MockClipboardItem);

    const result = await copyMatrixAsImage(SAMPLE_DATA);
    expect(result).toBe('copied');
    expect(write).toHaveBeenCalledTimes(1);
  });
});
