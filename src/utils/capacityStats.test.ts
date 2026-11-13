import { describe, expect, it } from 'vitest';
import type { TurnRow } from '../types/operalog';
import { computeCapacityStats } from './capacityStats';

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
