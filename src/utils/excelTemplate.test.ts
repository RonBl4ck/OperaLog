import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { FRONT_CONFIGS, type CatalogItem, type FrontConfig } from '../types/operalog';
import {
  buildExcelTemplateWorkbook,
  buildGeneralExcelTemplateWorkbook,
  getTemplateHeaders,
  parseExcelWorkbook,
  parseGeneralExcelWorkbook,
} from './excelTemplate';

function getFront(id: FrontConfig['id']): FrontConfig {
  const found = FRONT_CONFIGS.find((f) => f.id === id);
  if (!found) throw new Error(`FrontConfig not found: ${id}`);
  return found;
}

const sampleCatalogs: CatalogItem[] = [
  { tipo: 'HORARIO', frente: 'ALL', valor: '07:00 - 15:00', orden: 1, activo: true },
  { tipo: 'HORARIO', frente: 'ALL', valor: '15:00 - 23:00', orden: 2, activo: true },
  { tipo: 'ACTIVIDAD', frente: 'DESPACHADORES', valor: 'DESPACHO BT', orden: 1, activo: true },
  { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'RECLAMO_DOMICILIARIO', orden: 1, activo: true },
  { tipo: 'SKILL', frente: 'TEKO', valor: 'TEKO_MT', orden: 1, activo: true },
  { tipo: 'SKILL', frente: 'REPARACIONES', valor: 'REP_SUBTERRANEO', orden: 1, activo: true },
];

describe('excelTemplate', () => {
  it('enables Excel templates only for DESPACHADORES, RECLAMOS, TEKO, and REPARACIONES', () => {
    const enabled = FRONT_CONFIGS.filter((f) => f.supportsExcelTemplate).map((f) => f.id);
    expect(enabled).toEqual(['DESPACHADORES', 'RECLAMOS', 'TEKO', 'REPARACIONES']);
  });

  it('builds DESPACHADORES ExcelJS template with dropdown validations and parses uploaded rows', async () => {
    const front = getFront('DESPACHADORES');
    expect(getTemplateHeaders(front)).toEqual(['Nombres', 'Celular', 'Actividad', 'Horario']);

    const wb = buildExcelTemplateWorkbook(front, sampleCatalogs);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['Despachadores', 'Catalogos']);

    const sheet = wb.getWorksheet('Despachadores')!;
    expect(sheet.getCell('C2').dataValidation?.type).toBe('list');
    expect(sheet.getCell('D2').dataValidation?.type).toBe('list');

    sheet.addRow(['Ana Torres', '987654321', 'despacho bt', '07:00-15:00']);
    sheet.addRow(['', '', '', '']);

    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const rows = parseExcelWorkbook(
      buffer,
      front,
      { fecha: '2026-11-13', contratista: 'ALFA' },
      sampleCatalogs,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fecha: '2026-11-13',
      contratista: 'ALFA',
      frente: 'DESPACHADORES',
      nombres: 'Ana Torres',
      usuario_ssam: '',
      celular: '987654321',
      actividad: 'DESPACHO BT',
      skill: '',
      horario: '07:00 - 15:00',
    });
  });

  it('builds general 4-sheet workbook with dropdowns and only returns non-empty sheets on parse', async () => {
    const wb = buildGeneralExcelTemplateWorkbook(sampleCatalogs);
    const sheetNames = wb.worksheets.map((ws) => ws.name);
    expect(sheetNames).toEqual([
      'Despachadores',
      'Reclamos',
      'Teko',
      'Reparaciones',
      'Catalogos',
    ]);

    const reclamosSheet = wb.getWorksheet('Reclamos')!;
    expect(reclamosSheet.getCell('D2').dataValidation?.type).toBe('list');
    expect(reclamosSheet.getCell('E2').dataValidation?.type).toBe('list');

    // Fill only Reclamos and Teko; leave Despachadores and Reparaciones empty
    reclamosSheet.addRow([
      'Carlos Ruiz',
      'CRUIZ',
      '999111222',
      'reclamo_domiciliario',
      '15:00 - 23:00',
    ]);
    const tekoSheet = wb.getWorksheet('Teko')!;
    tekoSheet.addRow(['Luis Vega', 'LVEGA', '988777666', 'teko_mt', '07:00 - 15:00']);

    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const parsedByFront = parseGeneralExcelWorkbook(
      buffer,
      { fecha: '2026-11-13', contratista: 'BETA' },
      sampleCatalogs,
    );

    expect(Object.keys(parsedByFront)).toEqual(['RECLAMOS', 'TEKO']);
    expect(parsedByFront.DESPACHADORES).toBeUndefined();
    expect(parsedByFront.REPARACIONES).toBeUndefined();

    expect(parsedByFront.RECLAMOS).toHaveLength(1);
    expect(parsedByFront.RECLAMOS![0]).toMatchObject({
      frente: 'RECLAMOS',
      nombres: 'Carlos Ruiz',
      usuario_ssam: 'CRUIZ',
      actividad: 'RECLAMISTA',
      skill: 'RECLAMO_DOMICILIARIO',
      horario: '15:00 - 23:00',
    });

    expect(parsedByFront.TEKO).toHaveLength(1);
    expect(parsedByFront.TEKO![0]).toMatchObject({
      frente: 'TEKO',
      nombres: 'Luis Vega',
      usuario_ssam: 'LVEGA',
      actividad: 'TEKO',
      skill: 'TEKO_MT',
      horario: '07:00 - 15:00',
    });

    // Also ensure SheetJS compatibility with the generated buffer
    const xlsxWb = XLSX.read(buffer, { type: 'array' });
    expect(xlsxWb.SheetNames).toContain('Catalogos');
  });
});
