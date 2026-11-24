import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  FRONT_CONFIGS,
  type CatalogItem,
  type FrontConfig,
  type FrontType,
  type OperalogGroup,
  type TurnRow,
} from '../types/operalog';
import {
  buildAdminTurnsExcelWorkbook,
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

  it('builds general workbook with all active fronts including Coordinadores, Supervisores CAPA, and Localizadores and only returns non-empty sheets on parse', async () => {
    const wb = buildGeneralExcelTemplateWorkbook(sampleCatalogs);
    const sheetNames = wb.worksheets.map((ws) => ws.name);
    expect(sheetNames).toEqual([
      'Coordinadores',
      'Supervisores CAPA',
      'Localizadores',
      'Despachadores',
      'Reclamos',
      'Teko',
      'Reparaciones',
      'Catalogos',
    ]);

    const coordSheet = wb.getWorksheet('Coordinadores')!;
    expect(coordSheet.getCell('C2').dataValidation?.type).toBe('list');
    coordSheet.addRow(['Pedro Gomez', '911000111', '07:00 - 15:00']);

    const capaSheet = wb.getWorksheet('Supervisores CAPA')!;
    expect(capaSheet.getCell('C2').dataValidation?.type).toBe('list');
    capaSheet.addRow(['Rosa Diaz', '922000222', '15:00 - 23:00']);

    const locSheet = wb.getWorksheet('Localizadores')!;
    expect(locSheet.getCell('C2').dataValidation?.type).toBe('list');
    locSheet.addRow(['Marco Silva', '933000333', '07:00 - 15:00']);

    const reclamosSheet = wb.getWorksheet('Reclamos')!;
    expect(reclamosSheet.getCell('D2').dataValidation?.type).toBe('list');
    expect(reclamosSheet.getCell('E2').dataValidation?.type).toBe('list');

    // Fill Coordinadores, Supervisores CAPA, Localizadores, Reclamos, and Teko; leave Despachadores and Reparaciones empty
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

    expect(Object.keys(parsedByFront)).toEqual([
      'COORDINADORES',
      'SUPERVISORES CAPA',
      'LOCALIZADORES',
      'RECLAMOS',
      'TEKO',
    ]);
    expect(parsedByFront.DESPACHADORES).toBeUndefined();
    expect(parsedByFront.REPARACIONES).toBeUndefined();

    expect(parsedByFront.COORDINADORES).toHaveLength(1);
    expect(parsedByFront.COORDINADORES![0]).toMatchObject({
      frente: 'COORDINADORES',
      nombres: 'Pedro Gomez',
      usuario_ssam: '',
      celular: '911000111',
      actividad: '',
      skill: '',
      horario: '07:00 - 15:00',
    });

    expect(parsedByFront['SUPERVISORES CAPA']).toHaveLength(1);
    expect(parsedByFront['SUPERVISORES CAPA']![0]).toMatchObject({
      frente: 'SUPERVISORES CAPA',
      nombres: 'Rosa Diaz',
      celular: '922000222',
      horario: '15:00 - 23:00',
    });

    expect(parsedByFront.LOCALIZADORES).toHaveLength(1);
    expect(parsedByFront.LOCALIZADORES![0]).toMatchObject({
      frente: 'LOCALIZADORES',
      nombres: 'Marco Silva',
      celular: '933000333',
      horario: '07:00 - 15:00',
    });

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

  it('filters general template sheets and catalog dropdowns by group', async () => {
    const groupedCatalogs: CatalogItem[] = [
      { tipo: 'HORARIO', frente: 'ALL', valor: '07:00 - 15:00', orden: 1, activo: true, grupo: 'ALL' },
      { tipo: 'FRENTE', frente: 'ALL', valor: 'RECLAMOS', orden: 1, activo: true, grupo: 'AP' },
      { tipo: 'FRENTE', frente: 'ALL', valor: 'REPARACIONES', orden: 2, activo: true, grupo: 'AP' },
      { tipo: 'FRENTE', frente: 'ALL', valor: 'TEKO', orden: 3, activo: false, grupo: 'AP' },
      { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'LUMINARIA_AP', orden: 1, activo: true, grupo: 'AP' },
      { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'TOMA_BT', orden: 2, activo: true, grupo: 'BT' },
      { tipo: 'SKILL', frente: 'REPARACIONES', valor: 'POSTE_AP', orden: 1, activo: true, grupo: 'AP' },
    ];

    const wb = buildGeneralExcelTemplateWorkbook(groupedCatalogs, 'AP');
    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      'Reclamos',
      'Reparaciones',
      'Catalogos',
    ]);

    const catalogSheet = wb.getWorksheet('Catalogos')!;
    const col1Values: string[] = [];
    catalogSheet.getColumn(1).eachCell((cell, rowNum) => {
      if (rowNum > 1 && cell.value) col1Values.push(String(cell.value));
    });
    expect(col1Values).toEqual(['LUMINARIA_AP']);

    const reclamosSheet = wb.getWorksheet('Reclamos')!;
    reclamosSheet.addRow(['Mario Luz', 'MLUZ', '911222333', 'luminaria_ap', '07:00 - 15:00']);
    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;

    const parsed = parseGeneralExcelWorkbook(
      buffer,
      { fecha: '2026-11-18', contratista: 'LUMINA' },
      groupedCatalogs,
      'AP',
    );
    expect(Object.keys(parsed)).toEqual(['RECLAMOS']);
    expect(parsed.RECLAMOS![0]).toMatchObject({
      frente: 'RECLAMOS',
      skill: 'LUMINARIA_AP',
      horario: '07:00 - 15:00',
    });
  });

  it('builds admin turns export workbook with 10 styled columns, frozen header, text formats, and group fallback', () => {
    const frontLabelMap = new Map<FrontType, string>(
      FRONT_CONFIGS.map((f) => [f.id, f.label]),
    );
    const contrataGroupMap = new Map<string, OperalogGroup>([
      ['LUMINA', 'AP'],
      ['ALFA', 'BT'],
    ]);

    const rows: TurnRow[] = [
      {
        id: 'r1',
        fecha: '2026-11-18',
        contratista: 'REDES MT',
        grupo: 'MT',
        frente: 'TEKO',
        nombres: 'Juan Perez',
        usuario_ssam: 'JPEREZ',
        celular: '987654321',
        actividad: 'TEKO',
        skill: 'MT_LINEA',
        horario: '07:00 - 16:00',
      },
      {
        id: 'r2',
        fecha: '2026-11-18',
        contratista: 'LUMINA',
        frente: 'RECLAMOS',
        nombres: 'Ana Luz',
        usuario_ssam: 'ALUZ',
        celular: '912345678',
        actividad: 'RECLAMISTA',
        skill: 'AP_LUMINARIA',
        horario: '15:00 - 23:00',
      },
      {
        id: 'r3',
        fecha: '2026-11-18',
        contratista: 'OTRA',
        frente: 'COORDINADORES',
        nombres: 'Luis Gomez',
        usuario_ssam: '',
        celular: '900111222',
        actividad: '',
        skill: '',
        horario: '07:00 - 16:00',
      },
    ];

    const wb = buildAdminTurnsExcelWorkbook(rows, frontLabelMap, contrataGroupMap);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['Turnos']);

    const sheet = wb.getWorksheet('Turnos')!;
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });

    const headerValues = sheet.getRow(1).values as Array<string | undefined>;
    expect(headerValues.slice(1)).toEqual([
      'Fecha',
      'Grupo',
      'Contratista',
      'Frente',
      'Nombres',
      'Usuario SSAM',
      'Celular',
      'Actividad',
      'Skill',
      'Horario',
    ]);

    const headerCell = sheet.getCell('A1');
    expect(headerCell.fill).toMatchObject({
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3C5A9F' },
    });
    expect(headerCell.font).toMatchObject({ bold: true, color: { argb: 'FFFFFFFF' } });
    expect(headerCell.border?.top?.style).toBe('thin');

    expect(sheet.getColumn(1).numFmt).toBe('@');
    expect(sheet.getColumn(7).numFmt).toBe('@');
    expect((sheet.getColumn(1).width ?? 0) >= 10).toBe(true);
    expect((sheet.getColumn(5).width ?? 0) >= 15).toBe(true);

    expect(sheet.getRow(2).getCell(2).value).toBe('MT');
    expect(sheet.getRow(2).getCell(4).value).toBe('Teko');
    expect(sheet.getRow(3).getCell(2).value).toBe('AP');
    expect(sheet.getRow(4).getCell(2).value).toBe('BT');
  });
});
