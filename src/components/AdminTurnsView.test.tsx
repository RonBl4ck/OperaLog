import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminTurnsView } from './AdminTurnsView';
import type { OperalogGroup, TurnRow } from '../types/operalog';

const downloadAdminTurnsExcelMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../utils/excelTemplate', () => ({
  downloadAdminTurnsExcel: (...args: unknown[]) => downloadAdminTurnsExcelMock(...args),
}));

const sampleRows: TurnRow[] = [
  {
    id: '1',
    fecha: '2026-11-13',
    contratista: 'ALFA',
    frente: 'DESPACHADORES',
    nombres: 'Carlos Zapata',
    usuario_ssam: 'CZAPATA',
    celular: '999111222',
    actividad: 'DESPACHO',
    skill: 'BT',
    horario: '07:00 - 15:00',
  },
  {
    id: '2',
    fecha: '2026-11-13',
    contratista: 'BETA',
    frente: 'RECLAMOS',
    nombres: 'Ana Alvarez',
    usuario_ssam: 'AALVAREZ',
    celular: '999333444',
    actividad: 'RECLAMISTA',
    skill: 'MT',
    horario: '15:00 - 23:00',
  },
  {
    id: '3',
    fecha: '2026-11-13',
    contratista: 'GAMMA',
    frente: 'TEKO',
    nombres: 'Bruno Mendez',
    usuario_ssam: 'BMENDEZ',
    celular: '999555666',
    actividad: 'TEKO',
    skill: 'GENERAL',
    horario: '07:00 - 15:00',
  },
];

function renderAdminView(selectedContrata = 'ALL') {
  const onSelectedContrataChange = vi.fn();
  render(
    <AdminTurnsView
      fecha="2026-11-13"
      onFechaChange={vi.fn()}
      contratas={['ALFA', 'BETA', 'GAMMA']}
      rows={sampleRows}
      loading={false}
      onRefresh={vi.fn()}
      selectedContrata={selectedContrata}
      onSelectedContrataChange={onSelectedContrataChange}
      onToast={vi.fn()}
    />,
  );
  return { onSelectedContrataChange };
}

describe('AdminTurnsView multi-select filters and table sorting', () => {
  it('filters by multiple contratistas and multiple frentes', () => {
    renderAdminView();

    expect(screen.getByText('Carlos Zapata')).toBeTruthy();
    expect(screen.getByText('Ana Alvarez')).toBeTruthy();
    expect(screen.getByText('Bruno Mendez')).toBeTruthy();

    // Open Contratista multi-select and select ALFA and GAMMA
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar por Contratista' }));
    const contrataListbox = screen.getByRole('listbox', { name: 'Opciones de Contratista' });
    fireEvent.click(within(contrataListbox).getByRole('option', { name: 'ALFA' }));
    fireEvent.click(within(contrataListbox).getByRole('option', { name: 'GAMMA' }));

    expect(screen.getByText('Carlos Zapata')).toBeTruthy();
    expect(screen.queryByText('Ana Alvarez')).toBeNull();
    expect(screen.getByText('Bruno Mendez')).toBeTruthy();

    // Open Frente multi-select and select Despachadores and Reclamos
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar por Frente' }));
    const frenteListbox = screen.getByRole('listbox', { name: 'Opciones de Frente' });
    fireEvent.click(within(frenteListbox).getByRole('option', { name: 'Despachadores' }));
    fireEvent.click(within(frenteListbox).getByRole('option', { name: 'Reclamos' }));

    // Intersection: ALFA/GAMMA + Despachadores/Reclamos => only Carlos Zapata
    expect(screen.getByText('Carlos Zapata')).toBeTruthy();
    expect(screen.queryByText('Ana Alvarez')).toBeNull();
    expect(screen.queryByText('Bruno Mendez')).toBeNull();

    // Reset Frente to all
    fireEvent.click(within(frenteListbox).getByRole('button', { name: 'Todos los frentes' }));
    expect(screen.getByText('Bruno Mendez')).toBeTruthy();
  });

  it('sorts table rows ascending, descending, and back to default on header click', () => {
    renderAdminView();

    const getBodyNames = () => {
      const tbody = screen.getByRole('table').querySelector('tbody')!;
      return Array.from(tbody.querySelectorAll('tr')).map(
        (tr) => tr.querySelectorAll('td')[3].textContent,
      );
    };

    // Initial order
    expect(getBodyNames()).toEqual(['Carlos Zapata', 'Ana Alvarez', 'Bruno Mendez']);

    const nombresBtn = screen.getByRole('button', { name: 'Nombres' });

    // Click 1 -> Ascending
    fireEvent.click(nombresBtn);
    expect(getBodyNames()).toEqual(['Ana Alvarez', 'Bruno Mendez', 'Carlos Zapata']);
    expect(nombresBtn.closest('th')?.getAttribute('aria-sort')).toBe('ascending');

    // Click 2 -> Descending
    fireEvent.click(nombresBtn);
    expect(getBodyNames()).toEqual(['Carlos Zapata', 'Bruno Mendez', 'Ana Alvarez']);
    expect(nombresBtn.closest('th')?.getAttribute('aria-sort')).toBe('descending');

    // Click 3 -> Reset to original order
    fireEvent.click(nombresBtn);
    expect(getBodyNames()).toEqual(['Carlos Zapata', 'Ana Alvarez', 'Bruno Mendez']);
    expect(nombresBtn.closest('th')?.getAttribute('aria-sort')).toBe('none');
  });

  it('displays Grupo column and exports native Excel .xlsx via downloadAdminTurnsExcel', async () => {
    downloadAdminTurnsExcelMock.mockClear();
    const contrataGroupMap = new Map<string, OperalogGroup>([
      ['ALFA', 'BT'],
      ['BETA', 'AP'],
      ['GAMMA', 'MT'],
    ]);

    render(
      <AdminTurnsView
        fecha="2026-11-13"
        onFechaChange={vi.fn()}
        contratas={['ALFA', 'BETA', 'GAMMA']}
        rows={sampleRows}
        loading={false}
        onRefresh={vi.fn()}
        selectedContrata="ALL"
        onSelectedContrataChange={vi.fn()}
        onToast={vi.fn()}
        contrataGroupMap={contrataGroupMap}
        activeGroup="AP"
      />,
    );

    expect(screen.getByRole('button', { name: 'Grupo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Exportar CSV/i })).toBeNull();

    const exportBtn = screen.getByRole('button', { name: /Exportar Excel/i });
    fireEvent.click(exportBtn);

    await vi.waitFor(() => {
      expect(downloadAdminTurnsExcelMock).toHaveBeenCalledTimes(1);
    });

    const [exportedRows, filename, frontLabelMap, passedMap] =
      downloadAdminTurnsExcelMock.mock.calls[0];
    expect(exportedRows).toHaveLength(3);
    expect(filename).toBe('OperaLog_2026-11-13_AP_ALL.xlsx');
    expect(frontLabelMap).toBeInstanceOf(Map);
    expect(passedMap).toBe(contrataGroupMap);
  });
});
