import { describe, expect, it } from 'vitest';
import { FRONT_CONFIGS, type FrontConfig } from '../types/operalog';
import { parseExcelPaste } from './pasteParser';

function getFront(id: FrontConfig['id']): FrontConfig {
  const found = FRONT_CONFIGS.find((f) => f.id === id);
  if (!found) {
    throw new Error(`FrontConfig not found: ${id}`);
  }
  return found;
}

describe('parseExcelPaste', () => {
  const meta = { fecha: '2026-11-13', contratista: 'CONTRATA_A' };

  it('parses RECLAMOS paste with 2 rows, assigns fixedActivity RECLAMISTA, and extracts usuario_ssam & celular', () => {
    const tsv = [
      'Juan Perez\tjperez\t999111222\tBT\t07:00-15:00',
      'Maria Lopez\tmlopez\t988777666\tMT\t15:00-23:00',
    ].join('\n');

    const rows = parseExcelPaste(tsv, getFront('RECLAMOS'), meta);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      fecha: '2026-11-13',
      contratista: 'CONTRATA_A',
      frente: 'RECLAMOS',
      nombres: 'Juan Perez',
      usuario_ssam: 'jperez',
      celular: '999111222',
      actividad: 'RECLAMISTA',
      skill: 'BT',
      horario: '07:00-15:00',
    });
    expect(rows[1]).toMatchObject({
      frente: 'RECLAMOS',
      nombres: 'Maria Lopez',
      usuario_ssam: 'mlopez',
      celular: '988777666',
      actividad: 'RECLAMISTA',
      skill: 'MT',
      horario: '15:00-23:00',
    });
    expect(rows[0].id).toBeTruthy();
    expect(rows[1].id).toBeTruthy();
    expect(rows[0].id).not.toBe(rows[1].id);
  });

  it('parses DESPACHADORES paste with actividad & celular', () => {
    const tsv = 'Carlos Ruiz\tDESPACHO BT\t912345678\t07:00-15:00';

    const rows = parseExcelPaste(tsv, getFront('DESPACHADORES'), meta);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      frente: 'DESPACHADORES',
      nombres: 'Carlos Ruiz',
      usuario_ssam: '',
      actividad: 'DESPACHO BT',
      celular: '912345678',
      skill: '',
      horario: '07:00-15:00',
    });
  });

  it('parses COORDINADORES paste without usuario_ssam and extracts celular & horario', () => {
    const tsv = 'Ana Torres\t955444333\t08:00-17:00';

    const rows = parseExcelPaste(tsv, getFront('COORDINADORES'), meta);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      frente: 'COORDINADORES',
      nombres: 'Ana Torres',
      usuario_ssam: '',
      celular: '955444333',
      actividad: '',
      skill: '',
      horario: '08:00-17:00',
    });
  });

  it('ignores blank lines and handles CRLF line endings', () => {
    const tsv = '\r\n  Ana Torres \t 955444333 \t 08:00-17:00 \r\n\r\n   \r\nLuis Vega\t944333222\t14:00-22:00\r\n\r\n';

    const rows = parseExcelPaste(tsv, getFront('COORDINADORES'), meta);

    expect(rows).toHaveLength(2);
    expect(rows[0].nombres).toBe('Ana Torres');
    expect(rows[0].celular).toBe('955444333');
    expect(rows[0].horario).toBe('08:00-17:00');
    expect(rows[1].nombres).toBe('Luis Vega');
  });
});
