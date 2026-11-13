import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationsTab, clearOperationsCache } from './OperationsTab';
import * as gasClient from '../services/gasClient';
import { buildGeneralExcelTemplateWorkbook } from '../utils/excelTemplate';
import type { TurnRow, UserSession } from '../types/operalog';

const cobraUser: UserSession = {
  usuario: 'cobra.user',
  rol: 'CONTRATA',
  contratista: 'COBRA',
  nombre_mostrar: 'COBRA Operador',
};

const sampleRow: TurnRow = {
  id: 'row-1',
  fecha: '2026-11-13',
  contratista: 'COBRA',
  frente: 'COORDINADORES',
  nombres: 'Juan Perez',
  usuario_ssam: 'JPEREZ',
  celular: '999888777',
  actividad: 'COORDINACION',
  skill: 'GENERAL',
  horario: '07:00 - 15:00',
};

describe('OperationsTab cache persistence across tab switches', () => {
  beforeEach(() => {
    clearOperationsCache();
    vi.restoreAllMocks();
  });

  it('preserves loaded rows after unmount and remount under StrictMode', async () => {
    const getTurnSpy = vi.spyOn(gasClient, 'getTurn').mockResolvedValue([sampleRow]);
    const onToast = vi.fn();
    const onRowsChange = vi.fn();

    const { unmount } = render(
      <StrictMode>
        <OperationsTab
          user={cobraUser}
          catalogs={[]}
          initialFecha="2026-11-13"
          onToast={onToast}
          onRowsChange={onRowsChange}
        />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Juan Perez')).toBeTruthy();
    });

    // Simulate switching to Gráficos (unmounting OperationsTab)
    unmount();

    // Simulate switching back to Registro Operativo (remounting OperationsTab)
    render(
      <StrictMode>
        <OperationsTab
          user={cobraUser}
          catalogs={[]}
          initialFecha="2026-11-13"
          onToast={onToast}
          onRowsChange={onRowsChange}
        />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Juan Perez')).toBeTruthy();
    });

    // Should serve from cache on remount without refetching
    expect(getTurnSpy).toHaveBeenCalledTimes(2); // StrictMode runs initial mount effect twice before cache populates
  });

  it('shows Plantilla and Cargar Excel buttons only for Despachadores, Reclamos, Teko, and Reparaciones', async () => {
    vi.spyOn(gasClient, 'getTurn').mockResolvedValue([]);

    render(
      <OperationsTab
        user={cobraUser}
        catalogs={[]}
        initialFecha="2026-11-13"
        onToast={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Plantilla/i })).toHaveLength(5);
      expect(screen.getAllByRole('button', { name: /Cargar Excel/i })).toHaveLength(5);
    });

    for (const label of ['Despachadores', 'Reclamos', 'Teko', 'Reparaciones']) {
      expect(
        screen.getByTitle(`Descargar plantilla Excel para ${label}`),
      ).toBeTruthy();
      expect(
        screen.getByTitle(`Cargar Excel para llenar ${label}`),
      ).toBeTruthy();
    }

    for (const label of ['Coordinadores', 'Supervisores CAPA', 'Localizadores']) {
      expect(
        screen.queryByTitle(`Descargar plantilla Excel para ${label}`),
      ).toBeNull();
      expect(
        screen.queryByTitle(`Cargar Excel para llenar ${label}`),
      ).toBeNull();
    }
  });

  it('replaces only non-empty sheets when uploading the general Excel template', async () => {
    const existingDespachador: TurnRow = {
      ...sampleRow,
      id: 'desp-1',
      frente: 'DESPACHADORES',
      nombres: 'Maria Existing',
      actividad: 'DESPACHO',
    };
    const existingReclamo: TurnRow = {
      ...sampleRow,
      id: 'rec-1',
      frente: 'RECLAMOS',
      nombres: 'Old Reclamo',
      actividad: 'RECLAMISTA',
    };

    vi.spyOn(gasClient, 'getTurn').mockResolvedValue([
      existingDespachador,
      existingReclamo,
    ]);
    const onToast = vi.fn();

    render(
      <OperationsTab
        user={cobraUser}
        catalogs={[]}
        initialFecha="2026-11-13"
        onToast={onToast}
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Maria Existing')).toBeTruthy();
      expect(screen.getByDisplayValue('Old Reclamo')).toBeTruthy();
    });

    const wb = buildGeneralExcelTemplateWorkbook([]);
    wb.getWorksheet('Reclamos')!.addRow([
      'Nuevo Reclamista',
      'NREC',
      '999000111',
      '',
      '07:00 - 15:00',
    ]);
    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const file = new File([buffer], 'Plantilla_OperaLog.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => buffer,
    });

    const input = screen.getByLabelText('Cargar plantilla Excel general');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nuevo Reclamista')).toBeTruthy();
    });

    // Reclamos was replaced, while Despachadores (empty sheet) was preserved
    expect(screen.queryByDisplayValue('Old Reclamo')).toBeNull();
    expect(screen.getByDisplayValue('Maria Existing')).toBeTruthy();
  });
});
