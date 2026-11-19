import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminCatalogsTab } from './AdminCatalogsTab';
import type { CatalogItem, UserSession } from '../types/operalog';
import * as gasClient from '../services/gasClient';

vi.mock('../services/gasClient', async () => {
  const actual = await vi.importActual<typeof import('../services/gasClient')>('../services/gasClient');
  return {
    ...actual,
    saveCatalog: vi.fn(),
    refreshAllCatalogs: vi.fn(),
  };
});

const ADMIN_USER: UserSession = {
  usuario: 'admin.pluz',
  rol: 'ADMIN',
  contratista: 'ALL',
  nombre_mostrar: 'Administrador PLUZ',
};

const SAMPLE_CATALOG: CatalogItem[] = [
  { tipo: 'HORARIO', frente: 'ALL', valor: '06:00 - 22:00', orden: 1, activo: true },
  { tipo: 'HORARIO', frente: 'ALL', valor: '07:00 - 23:00', orden: 2, activo: false },
  { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'TOMA', orden: 1, activo: true },
  { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'TOMA + CNX AEREA', orden: 2, activo: true },
  { tipo: 'SKILL', frente: 'TEKO', valor: 'CNX AEREA + RED AEREA', orden: 1, activo: true },
  { tipo: 'ACTIVIDAD', frente: 'DESPACHADORES', valor: 'RECLAMO', orden: 1, activo: true },
];

describe('AdminCatalogsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds, edits inline, reorders within frente, and saves with ADMIN rol', async () => {
    const onCatalogSaved = vi.fn();
    vi.mocked(gasClient.saveCatalog).mockImplementation(async (payload) => {
      const items = Array.isArray(payload) ? payload : payload.items;
      return { ok: true, items };
    });

    render(
      <AdminCatalogsTab
        catalog={SAMPLE_CATALOG}
        onCatalogSaved={onCatalogSaved}
        user={ADMIN_USER}
      />,
    );

    // Inactive items remain visible in admin view
    expect(screen.getByText('07:00 - 23:00')).toBeTruthy();
    expect(screen.getByText('Inactivo')).toBeTruthy();

    // Add a new HORARIO
    const input = screen.getByLabelText('Nuevo horario');
    fireEvent.change(input, { target: { value: '19:00 - 07:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Agregar/i }));

    expect(screen.getByText('19:00 - 07:00')).toBeTruthy();
    expect(screen.getByText(/Tienes cambios pendientes en memoria/i)).toBeTruthy();

    // Edit inline
    fireEvent.click(screen.getByRole('button', { name: 'Editar 19:00 - 07:00' }));
    const editInput = screen.getByRole('textbox', { name: 'Editar 19:00 - 07:00' });
    fireEvent.change(editInput, { target: { value: '20:00 - 08:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar edición' }));

    expect(screen.getByText('20:00 - 08:00')).toBeTruthy();

    // Save to Sheets and verify rol + usuario are sent
    fireEvent.click(screen.getByRole('button', { name: /Guardar en Sheets/i }));

    await waitFor(() => {
      expect(gasClient.saveCatalog).toHaveBeenCalledTimes(1);
    });

    const callArg = vi.mocked(gasClient.saveCatalog).mock.calls[0][0];
    expect(Array.isArray(callArg)).toBe(false);
    if (!Array.isArray(callArg)) {
      expect(callArg.rol).toBe('ADMIN');
      expect(callArg.usuario).toBe('admin.pluz');
      expect(callArg.items.some((i) => i.valor === '20:00 - 08:00')).toBe(true);
    }
    expect(onCatalogSaved).toHaveBeenCalledTimes(1);
  });

  it('reorders items within their own frente in Skills tab and supports discarding changes', () => {
    render(
      <AdminCatalogsTab
        catalog={SAMPLE_CATALOG}
        onCatalogSaved={vi.fn()}
        user={ADMIN_USER}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Skills/i }));
    // Filter by RECLAMOS
    fireEvent.click(screen.getByRole('button', { name: 'RECLAMOS' }));

    // Move 'TOMA + CNX AEREA' up
    fireEvent.click(screen.getByRole('button', { name: 'Subir TOMA + CNX AEREA' }));
    expect(screen.getByText(/Tienes cambios pendientes en memoria/i)).toBeTruthy();

    // Discard changes
    fireEvent.click(screen.getByRole('button', { name: /Descartar/i }));
    expect(screen.queryByText(/Tienes cambios pendientes en memoria/i)).toBeNull();
  });

  it('allows ALL admin to switch between BT, AP, MT and manage Frentes / Bloques', async () => {
    const groupedCatalog: CatalogItem[] = [
      { tipo: 'HORARIO', frente: 'ALL', valor: '06:00 - 22:00', orden: 1, activo: true, grupo: 'ALL' },
      { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'TOMA BT', orden: 1, activo: true, grupo: 'BT' },
      { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'LUMINARIA LED', orden: 1, activo: true, grupo: 'AP' },
      { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'SUBESTACION MT', orden: 1, activo: true, grupo: 'MT' },
    ];

    vi.mocked(gasClient.saveCatalog).mockImplementation(async (payload) => {
      const items = Array.isArray(payload) ? payload : payload.items;
      return { ok: true, items };
    });

    render(
      <AdminCatalogsTab
        catalog={groupedCatalog}
        onCatalogSaved={vi.fn()}
        user={{ ...ADMIN_USER, grupo: 'ALL' }}
      />,
    );

    // Group selector buttons BT, AP, MT are visible
    const btBtn = screen.getByRole('button', { name: 'BT' });
    const apBtn = screen.getByRole('button', { name: 'AP' });
    const mtBtn = screen.getByRole('button', { name: 'MT' });
    expect(btBtn).toBeTruthy();
    expect(apBtn).toBeTruthy();
    expect(mtBtn).toBeTruthy();

    // Switch to Skills tab -> defaults to BT
    fireEvent.click(screen.getByRole('button', { name: /Skills/i }));
    expect(screen.getByText('TOMA BT')).toBeTruthy();
    expect(screen.queryByText('LUMINARIA LED')).toBeNull();

    // Switch to AP -> shows AP skills
    fireEvent.click(apBtn);
    expect(screen.getByText('LUMINARIA LED')).toBeTruthy();
    expect(screen.queryByText('TOMA BT')).toBeNull();

    // Switch to MT -> shows MT skills
    fireEvent.click(mtBtn);
    expect(screen.getByText('SUBESTACION MT')).toBeTruthy();
    expect(screen.queryByText('LUMINARIA LED')).toBeNull();

    // Switch to Frentes / Bloques tab and initialize group fronts
    fireEvent.click(screen.getByRole('button', { name: /Frentes \/ Bloques/i }));
    fireEvent.click(screen.getByRole('button', { name: /Inicializar frentes del grupo \(MT\)/i }));

    expect(screen.getByText('COORDINADORES')).toBeTruthy();
    expect(screen.getByText('RECLAMOS')).toBeTruthy();

    // Save should pass grupo: 'MT'
    fireEvent.click(screen.getByRole('button', { name: /Guardar en Sheets/i }));
    await waitFor(() => {
      expect(gasClient.saveCatalog).toHaveBeenCalledWith(
        expect.objectContaining({
          grupo: 'MT',
          rol: 'ADMIN',
        }),
      );
    });
  });

  it('locks group-scoped AP admin to AP with a read-only badge', () => {
    const groupedCatalog: CatalogItem[] = [
      { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'TOMA BT', orden: 1, activo: true, grupo: 'BT' },
      { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'LUMINARIA LED', orden: 1, activo: true, grupo: 'AP' },
    ];

    render(
      <AdminCatalogsTab
        catalog={groupedCatalog}
        onCatalogSaved={vi.fn()}
        user={{ ...ADMIN_USER, usuario: 'admin.ap', grupo: 'AP' }}
      />,
    );

    expect(screen.getByText(/Grupo: Alumbrado Público \(AP\)/i)).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Seleccionar grupo de catálogo' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Skills/i }));
    expect(screen.getByText('LUMINARIA LED')).toBeTruthy();
    expect(screen.queryByText('TOMA BT')).toBeNull();
  });
});
