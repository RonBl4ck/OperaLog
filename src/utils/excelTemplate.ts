import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import {
  getActiveFrontConfigs,
  matchesGroupCatalog,
  type CatalogItem,
  type FrontConfig,
  type FrontType,
  type OperalogGroup,
  type TurnRow,
  type UserGroupScope,
} from '../types/operalog';
import { generateRowId } from './pasteParser';

export type TemplateFieldKey =
  | 'nombres'
  | 'usuario_ssam'
  | 'celular'
  | 'actividad'
  | 'skill'
  | 'horario';

interface TemplateColumnDef {
  key: TemplateFieldKey;
  header: string;
  width: number;
}

const VALIDATION_ROW_LIMIT = 200;

const HEADER_ALIASES: Record<string, TemplateFieldKey> = {
  nombres: 'nombres',
  nombre: 'nombres',
  apellidosynombres: 'nombres',
  usuario_ssam: 'usuario_ssam',
  usuariossam: 'usuario_ssam',
  ssam: 'usuario_ssam',
  celular: 'celular',
  telefono: 'celular',
  actividad: 'actividad',
  skill: 'skill',
  horario: 'horario',
};

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getColumnLetter(colNumber: number): string {
  let dividend = colNumber;
  let columnName = '';
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  return columnName;
}

function getActiveCatalogValues(
  catalogs: CatalogItem[],
  tipo: CatalogItem['tipo'],
  frontId: FrontConfig['id'],
  grupo?: UserGroupScope,
): string[] {
  return catalogs
    .filter(
      (c) =>
        c.activo &&
        c.tipo === tipo &&
        (c.frente === 'ALL' || c.frente === frontId) &&
        matchesGroupCatalog(c.grupo, grupo),
    )
    .sort((a, b) => a.orden - b.orden)
    .map((c) => c.valor);
}

function matchCatalogValue(rawValue: string, options: string[]): string {
  const trimmed = rawValue.trim();
  if (!trimmed || options.length === 0) return trimmed;

  const exact = options.find((opt) => opt === trimmed);
  if (exact) return exact;

  const target = normalizeToken(trimmed);
  const matched = options.find((opt) => normalizeToken(opt) === target);
  return matched ?? trimmed;
}

/** Returns the ordered Excel column definitions for a given front. */
export function getTemplateColumns(front: FrontConfig): TemplateColumnDef[] {
  if (front.hasSsam) {
    return [
      { key: 'nombres', header: 'Nombres', width: 32 },
      { key: 'usuario_ssam', header: 'Usuario SSAM', width: 18 },
      { key: 'celular', header: 'Celular', width: 15 },
      { key: 'skill', header: 'Skill', width: 24 },
      { key: 'horario', header: 'Horario', width: 22 },
    ];
  }

  if (front.hasActivityDropdown) {
    return [
      { key: 'nombres', header: 'Nombres', width: 32 },
      { key: 'celular', header: 'Celular', width: 15 },
      { key: 'actividad', header: 'Actividad', width: 24 },
      { key: 'horario', header: 'Horario', width: 22 },
    ];
  }

  return [
    { key: 'nombres', header: 'Nombres', width: 32 },
    { key: 'celular', header: 'Celular', width: 15 },
    { key: 'horario', header: 'Horario', width: 22 },
  ];
}

export function getTemplateHeaders(front: FrontConfig): string[] {
  return getTemplateColumns(front).map((col) => col.header);
}

interface CatalogRangeRef {
  formula: string;
}

interface PendingCatalogColumn {
  title: string;
  values: string[];
}

function registerCatalogColumn(
  pendingCols: PendingCatalogColumn[],
  title: string,
  values: string[],
): CatalogRangeRef | null {
  const colIndex = pendingCols.length + 1;
  pendingCols.push({ title, values });
  if (values.length === 0) return null;

  const colLetter = getColumnLetter(colIndex);
  return {
    formula: `Catalogos!$${colLetter}$2:$${colLetter}$${values.length + 1}`,
  };
}

function writeCatalogSheet(
  wb: ExcelJS.Workbook,
  pendingCols: PendingCatalogColumn[],
): void {
  const catalogSheet = wb.addWorksheet('Catalogos');
  pendingCols.forEach((col, idx) => {
    const colIndex = idx + 1;
    const headerCell = catalogSheet.getCell(1, colIndex);
    headerCell.value = col.title;
    headerCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    headerCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF475569' },
    };
    catalogSheet.getColumn(colIndex).width = 26;

    col.values.forEach((val, rowIdx) => {
      catalogSheet.getCell(rowIdx + 2, colIndex).value = val;
    });
  });
}

function appendFrontSheet(
  wb: ExcelJS.Workbook,
  pendingCols: PendingCatalogColumn[],
  front: FrontConfig,
  catalogs: CatalogItem[],
  grupo?: UserGroupScope,
): void {
  const safeSheetName =
    front.label.replace(/[:\\/?*[\]]/g, '').slice(0, 31) || 'Plantilla';
  const sheet = wb.addWorksheet(safeSheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const columns = getTemplateColumns(front);
  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3C5A9F' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  const validationRefs = new Map<TemplateFieldKey, CatalogRangeRef>();

  if (front.hasActivityDropdown) {
    const actValues = getActiveCatalogValues(catalogs, 'ACTIVIDAD', front.id, grupo);
    const ref = registerCatalogColumn(
      pendingCols,
      `${front.label} - Actividad`,
      actValues,
    );
    if (ref) validationRefs.set('actividad', ref);
  }

  if (front.hasSkill) {
    const skillValues = getActiveCatalogValues(catalogs, 'SKILL', front.id, grupo);
    const ref = registerCatalogColumn(
      pendingCols,
      `${front.label} - Skill`,
      skillValues,
    );
    if (ref) validationRefs.set('skill', ref);
  }

  const horarioValues = getActiveCatalogValues(catalogs, 'HORARIO', front.id, grupo);
  const horarioRef = registerCatalogColumn(
    pendingCols,
    `${front.label} - Horario`,
    horarioValues,
  );
  if (horarioRef) validationRefs.set('horario', horarioRef);

  const celularColIdx = columns.findIndex((c) => c.key === 'celular') + 1;
  if (celularColIdx > 0) {
    sheet.getColumn(celularColIdx).numFmt = '@';
  }

  for (const [fieldKey, ref] of validationRefs.entries()) {
    const colIdx = columns.findIndex((c) => c.key === fieldKey) + 1;
    if (colIdx <= 0) continue;

    for (let rowNum = 2; rowNum <= VALIDATION_ROW_LIMIT; rowNum += 1) {
      sheet.getCell(rowNum, colIdx).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [ref.formula],
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Valor no listado',
        error: 'Seleccione una opción válida de la lista desplegable.',
      };
    }
  }
}

/** Builds a styled ExcelJS workbook for a single front with dropdown data validations. */
export function buildExcelTemplateWorkbook(
  front: FrontConfig,
  catalogs: CatalogItem[],
  grupo?: UserGroupScope,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const pendingCols: PendingCatalogColumn[] = [];

  appendFrontSheet(wb, pendingCols, front, catalogs, grupo);
  writeCatalogSheet(wb, pendingCols);
  return wb;
}

/** Builds a general multi-sheet ExcelJS workbook for all active fronts. */
export function buildGeneralExcelTemplateWorkbook(
  catalogs: CatalogItem[],
  grupo?: UserGroupScope,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const pendingCols: PendingCatalogColumn[] = [];

  const templateFronts = getActiveFrontConfigs(catalogs, grupo);
  for (const front of templateFronts) {
    appendFrontSheet(wb, pendingCols, front, catalogs, grupo);
  }

  writeCatalogSheet(wb, pendingCols);
  return wb;
}

async function triggerWorkbookDownload(
  wb: ExcelJS.Workbook,
  filename: string,
): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Downloads a single-front Excel template with dropdowns. */
export async function downloadExcelTemplate(
  front: FrontConfig,
  catalogs: CatalogItem[],
  grupo?: UserGroupScope,
): Promise<void> {
  const wb = buildExcelTemplateWorkbook(front, catalogs, grupo);
  const slug = front.id.toLowerCase().replace(/\s+/g, '_');
  await triggerWorkbookDownload(wb, `Plantilla_${slug}.xlsx`);
}

/** Downloads the general multi-sheet Excel template with dropdowns for all active fronts. */
export async function downloadGeneralExcelTemplate(
  catalogs: CatalogItem[],
  grupo?: UserGroupScope,
): Promise<void> {
  const wb = buildGeneralExcelTemplateWorkbook(catalogs, grupo);
  await triggerWorkbookDownload(wb, 'Plantilla_OperaLog.xlsx');
}

function parseSheetRows(
  sheet: XLSX.WorkSheet,
  front: FrontConfig,
  meta: { fecha: string; contratista: string },
  catalogs: CatalogItem[],
  grupo?: UserGroupScope,
): TurnRow[] {
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
  });
  if (rawRows.length === 0) return [];

  const columns = getTemplateColumns(front);
  const firstRowCells = rawRows[0].map((cell) => String(cell ?? '').trim());
  const detectedMapping = firstRowCells.map(
    (cell) => HEADER_ALIASES[normalizeToken(cell)] ?? null,
  );
  const hasHeaderRow = detectedMapping.some((key) => key !== null);

  const columnKeys: Array<TemplateFieldKey | null> = hasHeaderRow
    ? detectedMapping
    : columns.map((c) => c.key);
  const dataRows = hasHeaderRow ? rawRows.slice(1) : rawRows;

  const horarioOptions = getActiveCatalogValues(catalogs, 'HORARIO', front.id, grupo);
  const activityOptions = front.hasActivityDropdown
    ? getActiveCatalogValues(catalogs, 'ACTIVIDAD', front.id, grupo)
    : [];
  const skillOptions = front.hasSkill
    ? getActiveCatalogValues(catalogs, 'SKILL', front.id, grupo)
    : [];

  const parsed: TurnRow[] = [];

  for (const rowCells of dataRows) {
    const values: Record<TemplateFieldKey, string> = {
      nombres: '',
      usuario_ssam: '',
      celular: '',
      actividad: '',
      skill: '',
      horario: '',
    };

    let hasContent = false;
    for (let i = 0; i < columnKeys.length; i += 1) {
      const key = columnKeys[i];
      if (!key) continue;
      const cellText = String(rowCells[i] ?? '').trim();
      if (cellText !== '') {
        hasContent = true;
      }
      values[key] = cellText;
    }

    if (!hasContent) continue;

    parsed.push({
      id: generateRowId(),
      fecha: meta.fecha,
      contratista: meta.contratista,
      frente: front.id,
      nombres: values.nombres,
      usuario_ssam: front.hasSsam ? values.usuario_ssam : '',
      celular: values.celular,
      actividad:
        front.fixedActivity ??
        (front.hasActivityDropdown
          ? matchCatalogValue(values.actividad, activityOptions)
          : ''),
      skill: front.hasSkill ? matchCatalogValue(values.skill, skillOptions) : '',
      horario: matchCatalogValue(values.horario, horarioOptions),
    });
  }

  return parsed;
}

/** Parses an uploaded Excel/CSV buffer into TurnRow entries for a single front. */
export function parseExcelWorkbook(
  data: ArrayBuffer,
  front: FrontConfig,
  meta: { fecha: string; contratista: string },
  catalogs: CatalogItem[],
  grupo?: UserGroupScope,
): TurnRow[] {
  const wb = XLSX.read(data, { type: 'array' });
  const targetToken = normalizeToken(front.label);
  const matchedSheetName =
    wb.SheetNames.find((name) => normalizeToken(name) === targetToken) ??
    wb.SheetNames[0];
  if (!matchedSheetName) return [];

  return parseSheetRows(wb.Sheets[matchedSheetName], front, meta, catalogs, grupo);
}

/**
 * Parses a multi-sheet general Excel workbook.
 * Only sheets containing at least one non-empty data row are included in the returned map;
 * empty or missing sheets are omitted so existing UI rows for those fronts are preserved.
 */
export function parseGeneralExcelWorkbook(
  data: ArrayBuffer,
  meta: { fecha: string; contratista: string },
  catalogs: CatalogItem[],
  grupo?: UserGroupScope,
): Partial<Record<FrontType, TurnRow[]>> {
  const wb = XLSX.read(data, { type: 'array' });
  const result: Partial<Record<FrontType, TurnRow[]>> = {};
  const templateFronts = getActiveFrontConfigs(catalogs, grupo);

  for (const front of templateFronts) {
    const targetTokens = new Set([
      normalizeToken(front.label),
      normalizeToken(front.id),
    ]);
    const matchedSheetName = wb.SheetNames.find((name) =>
      targetTokens.has(normalizeToken(name)),
    );
    if (!matchedSheetName) continue;

    const parsedRows = parseSheetRows(
      wb.Sheets[matchedSheetName],
      front,
      meta,
      catalogs,
      grupo,
    );
    if (parsedRows.length > 0) {
      result[front.id] = parsedRows;
    }
  }

  return result;
}

/** Builds a styled ExcelJS workbook for exporting Admin turn records. */
export function buildAdminTurnsExcelWorkbook(
  rows: TurnRow[],
  frontLabelMap: Map<FrontType, string>,
  contrataGroupMap?: Map<string, OperalogGroup>,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Turnos', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const headers = [
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
  ];

  const minWidths = [12, 9, 15, 18, 28, 16, 14, 20, 24, 18];
  const maxLengths = headers.map((h, i) => Math.max(h.length + 2, minWidths[i]));

  const dataRows = rows.map((row) => {
    const resolvedGroup = row.grupo || contrataGroupMap?.get(row.contratista) || 'BT';
    const values = [
      row.fecha || '',
      resolvedGroup,
      row.contratista || '',
      frontLabelMap.get(row.frente) ?? row.frente ?? '',
      row.nombres || '',
      row.usuario_ssam || '',
      row.celular || '',
      row.actividad || '',
      row.skill || '',
      row.horario || '',
    ];
    values.forEach((val, idx) => {
      maxLengths[idx] = Math.min(42, Math.max(maxLengths[idx], val.length + 3));
    });
    return values;
  });

  sheet.columns = headers.map((header, idx) => ({
    header,
    width: maxLengths[idx],
  }));

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  const headerRow = sheet.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3C5A9F' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = thinBorder;
  });

  dataRows.forEach((values) => {
    const added = sheet.addRow(values);
    added.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  sheet.getColumn(1).numFmt = '@';
  sheet.getColumn(7).numFmt = '@';

  return wb;
}

/** Downloads the Admin turns Excel report. */
export async function downloadAdminTurnsExcel(
  rows: TurnRow[],
  filename: string,
  frontLabelMap: Map<FrontType, string>,
  contrataGroupMap?: Map<string, OperalogGroup>,
): Promise<void> {
  const wb = buildAdminTurnsExcelWorkbook(rows, frontLabelMap, contrataGroupMap);
  await triggerWorkbookDownload(wb, filename);
}
