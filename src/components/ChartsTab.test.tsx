import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChartsTab from './ChartsTab';
import type { TurnRow, UserSession } from '../types/operalog';

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const ADMIN_USER: UserSession = {
  usuario: 'admin.pluz',
  rol: 'ADMIN',
  contratista: 'ALL',
  nombre_mostrar: 'Administrador PLUZ',
};

function makeRow(overrides: Partial<TurnRow>): TurnRow {
  return {
    id: Math.random().toString(36).slice(2),
    fecha: '2026-11-16',
    contratista: 'ALFA',
    frente: 'RECLAMOS',
    nombres: 'Operario Demo',
    usuario_ssam: 'odemo',
    celular: '999000111',
    actividad: 'RECLAMISTA',
    skill: 'TOMA',
    horario: '07:00 - 16:00',
    ...overrides,
  };
}

describe('ChartsTab (Admin Field Dashboard)', () => {
  const sampleRows: TurnRow[] = [
    makeRow({ contratista: 'ALFA', frente: 'RECLAMOS', skill: 'TOMA', fecha: '2026-11-15' }),
    makeRow({ contratista: 'ALFA', frente: 'RECLAMOS', skill: 'TOMA', fecha: '2026-11-16' }),
    makeRow({ contratista: 'BETA', frente: 'RECLAMOS', skill: 'APOYO RECLAMOS', fecha: '2026-11-16' }),
    makeRow({ contratista: 'ALFA', frente: 'REPARACIONES', skill: 'CNX SUBTERRANEA', fecha: '2026-11-16' }),
    makeRow({ contratista: 'BETA', frente: 'REPARACIONES', skill: 'APOYO REPARACIONES', fecha: '2026-11-16' }),
    makeRow({ contratista: 'BETA', frente: 'TEKO', skill: 'CNX AEREA + RED AEREA', fecha: '2026-11-16' }),
    // Support fronts should NOT be counted in the field KPIs
    makeRow({ contratista: 'ALFA', frente: 'COORDINADORES', skill: '', fecha: '2026-11-16' }),
    makeRow({ contratista: 'BETA', frente: 'DESPACHADORES', skill: '', fecha: '2026-11-16' }),
  ];

  it('renders the 5 field KPI cards, the 3 priority blocks, and removes Cobertura por Horario', () => {
    render(
      <ChartsTab
        rows={sampleRows}
        user={ADMIN_USER}
        contratas={['ALFA', 'BETA']}
        fechaInicio="2026-11-15"
        fechaFin="2026-11-16"
        onFechaRangeChange={vi.fn()}
      />,
    );

    // 5 KPI cards (also appear as filter chips and matrix rows)
    expect(screen.getAllByText('Reclamistas').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Reclamistas de Apoyo').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Reparaciones').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Reparaciones de Apoyo').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Tekos (Brazos Hidráulicos)').length).toBeGreaterThanOrEqual(2);

    // 3 priority blocks + 2 new analytics charts
    expect(screen.getByText('Total Cuadrillas por Fecha')).toBeTruthy();
    expect(screen.getByText('Matriz Especialidad vs. Contratista')).toBeTruthy();
    expect(screen.getByText('Participación de Recursos por Empresa')).toBeTruthy();
    expect(screen.getByText('Total Cuadrillas por Especialidad y Empresa')).toBeTruthy();
    expect(screen.getByText('Capacidad Promedio por Día de la Semana')).toBeTruthy();

    // Total badge should only count 6 field rows (excluding 2 support rows)
    expect(screen.getByText('Total: 6')).toBeTruthy();

    // Removed chart should not exist
    expect(screen.queryByText(/Cobertura por Horario/i)).toBeNull();
  });

  it('filters counts when clicking a contractor chip', () => {
    render(
      <ChartsTab
        rows={sampleRows}
        user={ADMIN_USER}
        contratas={['ALFA', 'BETA']}
        fechaInicio="2026-11-15"
        fechaFin="2026-11-16"
        onFechaRangeChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Total: 6')).toBeTruthy();

    // Click ALFA filter chip (button)
    fireEvent.click(screen.getByRole('button', { name: 'ALFA' }));

    // ALFA has 3 field rows (2 Reclamistas + 1 Reparaciones)
    expect(screen.getByText('Total: 3')).toBeTruthy();
  });

  it('hides historical charts (by date and by weekday) when allowDateChange is false', () => {
    render(
      <ChartsTab
        rows={sampleRows}
        user={ADMIN_USER}
        contratas={['ALFA', 'BETA']}
        fechaInicio="2026-11-16"
        fechaFin="2026-11-16"
        onFechaRangeChange={vi.fn()}
        allowDateChange={false}
      />,
    );

    expect(screen.queryByText('Total Cuadrillas por Fecha')).toBeNull();
    expect(screen.queryByText('Capacidad Promedio por Día de la Semana')).toBeNull();
    expect(screen.getByText('Matriz Especialidad vs. Contratista')).toBeTruthy();
    expect(screen.getByText('Participación de Recursos por Empresa')).toBeTruthy();
    expect(screen.getByText('Total Cuadrillas por Especialidad y Empresa')).toBeTruthy();
  });
});
