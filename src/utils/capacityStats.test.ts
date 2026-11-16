import { describe, expect, it } from 'vitest';
import type { TurnRow } from '../types/operalog';
import {
  FIELD_CATEGORIES,
  classifyFieldRow,
  computeCapacityStats,
  computeFieldDashboardStats,
} from './capacityStats';

function makeRow(overrides: Partial<TurnRow>): TurnRow {
  return {
    id: Math.random().toString(36).slice(2),
    fecha: '2026-11-13',
    contratista: 'CONTRATA_A',
    frente: 'RECLAMOS',
    nombres: 'Operario Demo',
    usuario_ssam: 'odemo',
    celular: '999000111',
    actividad: 'RECLAMISTA',
    skill: 'BT',
    horario: '07:00-15:00',
    ...overrides,
  };
}

describe('computeCapacityStats', () => {
  it('computes total, campoCount, soporteCount, missingHorarioCount, uncoveredHorarios, and byContrata', () => {
    const rows: TurnRow[] = [
      makeRow({ contratista: 'CONTRATA_A', frente: 'RECLAMOS', horario: '07:00-15:00', skill: 'BT' }),
      makeRow({ contratista: 'CONTRATA_A', frente: 'TEKO', horario: '', usuario_ssam: '', skill: 'MT' }),
      makeRow({ contratista: 'CONTRATA_A', frente: 'COORDINADORES', horario: '07:00-15:00', usuario_ssam: '', skill: '' }),
      makeRow({ contratista: 'CONTRATA_B', frente: 'REPARACIONES', horario: '15:00-23:00', skill: 'BT' }),
      makeRow({ contratista: 'CONTRATA_B', frente: 'DESPACHADORES', horario: '15:00-23:00', usuario_ssam: '', skill: '' }),
      // Empty nombres row should be ignored
      makeRow({ nombres: '   ', contratista: 'CONTRATA_B', frente: 'RECLAMOS', horario: '23:00-07:00' }),
    ];

    const catalog = ['07:00-15:00', '15:00-23:00', '23:00-07:00'];
    const stats = computeCapacityStats(rows, catalog);

    expect(stats.total).toBe(5);
    expect(stats.campoCount).toBe(3); // RECLAMOS, TEKO, REPARACIONES
    expect(stats.soporteCount).toBe(2); // COORDINADORES, DESPACHADORES
    expect(stats.missingHorarioCount).toBe(1);
    expect(stats.missingSsamCount).toBe(1);
    expect(stats.uncoveredHorarios).toEqual(['23:00-07:00']);

    expect(stats.byContrata).toEqual([
      { contratista: 'CONTRATA_A', campo: 2, soporte: 1, total: 3 },
      { contratista: 'CONTRATA_B', campo: 1, soporte: 1, total: 2 },
    ]);

    expect(stats.byHorario).toHaveLength(3);
    expect(stats.byHorario[0]).toMatchObject({
      horario: '07:00-15:00',
      total: 2,
      RECLAMOS: 1,
      COORDINADORES: 1,
    });
    expect(stats.byHorario[2]).toMatchObject({
      horario: '23:00-07:00',
      total: 0,
    });
  });
});

describe('classifyFieldRow', () => {
  it('returns null when nombres is empty or whitespace', () => {
    expect(classifyFieldRow(makeRow({ nombres: '' }))).toBeNull();
    expect(classifyFieldRow(makeRow({ nombres: '   ' }))).toBeNull();
  });

  it('classifies RECLAMOS into RECLAMISTA or RECLAMISTA_APOYO based on skill containing APOYO', () => {
    expect(classifyFieldRow(makeRow({ frente: 'RECLAMOS', skill: 'BT' }))).toBe('RECLAMISTA');
    expect(classifyFieldRow(makeRow({ frente: 'RECLAMOS', skill: 'Apoyo Nocturno' }))).toBe(
      'RECLAMISTA_APOYO'
    );
  });

  it('classifies REPARACIONES into REPARACIONES or REPARACIONES_APOYO based on skill containing APOYO', () => {
    expect(classifyFieldRow(makeRow({ frente: 'REPARACIONES', skill: 'MT' }))).toBe('REPARACIONES');
    expect(classifyFieldRow(makeRow({ frente: 'REPARACIONES', skill: 'APOYO BT' }))).toBe(
      'REPARACIONES_APOYO'
    );
  });

  it('classifies TEKO as TEKO and support fronts as null', () => {
    expect(classifyFieldRow(makeRow({ frente: 'TEKO', skill: 'APOYO' }))).toBe('TEKO');
    expect(classifyFieldRow(makeRow({ frente: 'COORDINADORES', skill: 'BT' }))).toBeNull();
    expect(classifyFieldRow(makeRow({ frente: 'DESPACHADORES', skill: 'BT' }))).toBeNull();
  });
});

describe('computeFieldDashboardStats', () => {
  it('exposes the 5 FIELD_CATEGORIES in order', () => {
    expect(FIELD_CATEGORIES.map((c) => c.id)).toEqual([
      'RECLAMISTA',
      'RECLAMISTA_APOYO',
      'REPARACIONES',
      'REPARACIONES_APOYO',
      'TEKO',
    ]);
  });

  it('computes totals, dailyAverage, sorted byDate with DD/MM labels, matrix, and companyShare', () => {
    const rows: TurnRow[] = [
      makeRow({ fecha: '2026-11-15', contratista: 'BETA', frente: 'RECLAMOS', skill: 'BT' }),
      makeRow({ fecha: '2026-11-13', contratista: 'ALPHA', frente: 'RECLAMOS', skill: 'APOYO' }),
      makeRow({ fecha: '2026-11-13', contratista: 'ALPHA', frente: 'REPARACIONES', skill: 'BT' }),
      makeRow({ fecha: '2026-11-15', contratista: 'ALPHA', frente: 'REPARACIONES', skill: 'Apoyo' }),
      makeRow({ fecha: '2026-11-13', contratista: '', frente: 'TEKO', skill: '' }),
      // Non-field / empty rows ignored
      makeRow({ fecha: '2026-11-13', contratista: 'ALPHA', frente: 'COORDINADORES', skill: '' }),
      makeRow({ fecha: '2026-11-13', contratista: 'ALPHA', frente: 'RECLAMOS', nombres: '   ' }),
    ];

    const stats = computeFieldDashboardStats(rows);

    expect(stats.totalField).toBe(5);
    expect(stats.countsByCategory).toEqual({
      RECLAMISTA: 1,
      RECLAMISTA_APOYO: 1,
      REPARACIONES: 1,
      REPARACIONES_APOYO: 1,
      TEKO: 1,
    });
    expect(stats.dailyAverage).toBe(3); // Math.round(5 / 2)

    expect(stats.byDate).toEqual([
      {
        fecha: '2026-11-13',
        label: '13/11',
        total: 3,
        RECLAMISTA: 0,
        RECLAMISTA_APOYO: 1,
        REPARACIONES: 1,
        REPARACIONES_APOYO: 0,
        TEKO: 1,
      },
      {
        fecha: '2026-11-15',
        label: '15/11',
        total: 2,
        RECLAMISTA: 1,
        RECLAMISTA_APOYO: 0,
        REPARACIONES: 0,
        REPARACIONES_APOYO: 1,
        TEKO: 0,
      },
    ]);

    expect(stats.contratas).toEqual(['ALPHA', 'BETA', 'SIN CONTRATA']);
    expect(stats.matrixRows).toHaveLength(5);
    expect(stats.matrixRows[0]).toEqual({
      category: 'RECLAMISTA',
      label: 'Reclamistas',
      countsByContrata: { ALPHA: 0, BETA: 1, 'SIN CONTRATA': 0 },
      total: 1,
    });
    expect(stats.matrixTotalsByContrata).toEqual({
      ALPHA: 3,
      BETA: 1,
      'SIN CONTRATA': 1,
    });

    expect(stats.companyShare).toEqual([
      { contratista: 'ALPHA', count: 3, percentage: 60 },
      { contratista: 'BETA', count: 1, percentage: 20 },
      { contratista: 'SIN CONTRATA', count: 1, percentage: 20 },
    ]);
  });

  it('filters by selectedContratas and selectedCategories, and supports allContratas and non-ISO fecha', () => {
    const rows: TurnRow[] = [
      makeRow({ fecha: 'FECHA_LIBRE', contratista: 'ALPHA', frente: 'RECLAMOS', skill: 'BT' }),
      makeRow({ fecha: '2026-11-14', contratista: 'BETA', frente: 'TEKO', skill: '' }),
      makeRow({ fecha: '2026-11-14', contratista: 'ALPHA', frente: 'REPARACIONES', skill: 'BT' }),
    ];

    const stats = computeFieldDashboardStats(rows, {
      selectedContratas: ['ALPHA'],
      selectedCategories: ['RECLAMISTA'],
      allContratas: ['BETA', 'ALPHA', ''],
    });

    expect(stats.totalField).toBe(1);
    expect(stats.byDate[0]).toMatchObject({
      fecha: 'FECHA_LIBRE',
      label: 'FECHA_LIBRE',
      total: 1,
      RECLAMISTA: 1,
    });
    expect(stats.contratas).toEqual(['ALPHA', 'BETA']);
    expect(stats.matrixTotalsByContrata).toEqual({ ALPHA: 1, BETA: 0 });
    expect(stats.companyShare).toEqual([{ contratista: 'ALPHA', count: 1, percentage: 100 }]);
  });

  it('handles empty rows cleanly without unnecessary contratas', () => {
    const stats = computeFieldDashboardStats([]);
    expect(stats.totalField).toBe(0);
    expect(stats.dailyAverage).toBe(0);
    expect(stats.byDate).toEqual([]);
    expect(stats.contratas).toEqual([]);
    expect(stats.matrixRows).toHaveLength(5);
    expect(stats.matrixTotalsByContrata).toEqual({});
    expect(stats.companyShare).toEqual([]);
    expect(stats.byCategoryCompany).toHaveLength(5);
    expect(stats.byWeekday).toHaveLength(7);
  });

  it('computes byCategoryCompany and byWeekday (Lun-Dom) averages accurately', () => {
    const rows: TurnRow[] = [
      // 2026-11-09 (Monday): 2 crews
      makeRow({ fecha: '2026-11-09', contratista: 'ALFA', frente: 'RECLAMOS', skill: 'TOMA' }),
      makeRow({ fecha: '2026-11-09', contratista: 'BETA', frente: 'TEKO', skill: '' }),
      // 2026-11-16 (Monday): 4 crews -> Monday avg = Math.round(6 / 2) = 3
      makeRow({ fecha: '2026-11-16', contratista: 'ALFA', frente: 'RECLAMOS', skill: 'TOMA' }),
      makeRow({ fecha: '2026-11-16', contratista: 'ALFA', frente: 'RECLAMOS', skill: 'APOYO' }),
      makeRow({ fecha: '2026-11-16', contratista: 'BETA', frente: 'REPARACIONES', skill: 'MT' }),
      makeRow({ fecha: '2026-11-16', contratista: 'BETA', frente: 'TEKO', skill: '' }),
      // 2026-11-15 (Sunday): 1 crew -> Sunday avg = 1
      makeRow({ fecha: '2026-11-15', contratista: 'ALFA', frente: 'REPARACIONES', skill: 'APOYO' }),
    ];

    const stats = computeFieldDashboardStats(rows);

    expect(stats.byCategoryCompany[0]).toEqual({
      category: 'RECLAMISTA',
      label: 'Reclamistas',
      ALFA: 2,
      BETA: 0,
    });
    expect(stats.byCategoryCompany[4]).toEqual({
      category: 'TEKO',
      label: 'Tekos (Brazos Hidráulicos)',
      ALFA: 0,
      BETA: 2,
    });

    expect(stats.byWeekday[0]).toEqual({
      weekdayIndex: 0,
      label: 'Lun',
      total: 6,
      daysCount: 2,
      average: 3,
    });
    expect(stats.byWeekday[6]).toEqual({
      weekdayIndex: 6,
      label: 'Dom',
      total: 1,
      daysCount: 1,
      average: 1,
    });
  });
});
