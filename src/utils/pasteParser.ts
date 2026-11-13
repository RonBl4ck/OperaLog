import type { FrontConfig, TurnRow } from '../types/operalog';

let fallbackCounter = 0;

export function generateRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackCounter += 1;
  return `row-${Date.now()}-${fallbackCounter}-${Math.random().toString(36).slice(2, 9)}`;
}

export function parseExcelPaste(
  tsvText: string,
  front: FrontConfig,
  meta: { fecha: string; contratista: string }
): TurnRow[] {
  const normalized = tsvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);

  return lines.map((line) => {
    const cols = line.split('\t').map((cell) => cell.trim());

    if (front.hasSsam) {
      const [nombres = '', usuario_ssam = '', celular = '', skill = '', horario = ''] = cols;
      return {
        id: generateRowId(),
        fecha: meta.fecha,
        contratista: meta.contratista,
        frente: front.id,
        nombres,
        usuario_ssam,
        celular,
        actividad: front.fixedActivity ?? '',
        skill,
        horario,
      };
    }

    if (front.hasActivityDropdown) {
      const [nombres = '', actividad = '', celular = '', horario = ''] = cols;
      return {
        id: generateRowId(),
        fecha: meta.fecha,
        contratista: meta.contratista,
        frente: front.id,
        nombres,
        usuario_ssam: '',
        celular,
        actividad,
        skill: '',
        horario,
      };
    }

    const [nombres = '', celular = '', horario = ''] = cols;
    return {
      id: generateRowId(),
      fecha: meta.fecha,
      contratista: meta.contratista,
      frente: front.id,
      nombres,
      usuario_ssam: '',
      celular,
      actividad: front.fixedActivity ?? '',
      skill: '',
      horario,
    };
  });
}
