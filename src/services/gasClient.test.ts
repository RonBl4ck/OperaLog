import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTodayIsoDate, getTurn, isDemoMode, login, saveTurn, updateTurnRow } from './gasClient';

describe('login ver_historico flag', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ver_historico=true for admin.pluz and false for restricted group admins', async () => {
    if (!isDemoMode()) {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        const isGeneral = url.includes('usuario=admin.pluz');
        return {
          ok: true,
          json: async () => ({
            ok: true,
            user: {
              usuario: isGeneral ? 'admin.pluz' : 'admin.bt',
              rol: 'ADMIN',
              contratista: 'ALL',
              nombre_mostrar: isGeneral ? 'Administrador PLUZ' : 'Administrador BT',
              grupo: isGeneral ? 'ALL' : 'BT',
              ver_historico: isGeneral,
            },
            catalogs: [],
            contratas: [],
          }),
        } as Response;
      });
    }

    const general = await login('admin.pluz', '1234');
    expect(general.rol).toBe('ADMIN');
    expect(general.ver_historico).toBe(true);

    const btAdmin = await login('admin.bt', '1234');
    expect(btAdmin.rol).toBe('ADMIN');
    expect(btAdmin.ver_historico).toBe(false);
  });
});

describe('updateTurnRow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('rejects non-ADMIN users and non-today dates', async () => {
    const today = getTodayIsoDate();
    await expect(
      updateTurnRow({
        id: 'row-1',
        fecha: today,
        contratista: 'ALFA',
        changes: { celular: '999000111' },
        usuario: 'contrata.alfa',
        rol: 'CONTRATA',
      }),
    ).rejects.toThrow(/ADMIN/i);

    await expect(
      updateTurnRow({
        id: 'row-1',
        fecha: '2025-01-01',
        contratista: 'ALFA',
        changes: { celular: '999000111' },
        usuario: 'admin.pluz',
        rol: 'ADMIN',
        userGrupo: 'ALL',
      }),
    ).rejects.toThrow(/hoy/i);
  });

  it('updates a cell, validates group scope in demo mode, and normalizes admin_edited_fields', async () => {
    const today = getTodayIsoDate();
    if (!isDemoMode()) {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          changedFields: ['celular'],
          row: {
            id: 'row-bt-1',
            fecha: today,
            contratista: 'ALFA',
            grupo: 'BT',
            frente: 'RECLAMOS',
            nombres: 'Pedro Castillo',
            usuario_ssam: 'PCASTILLO',
            celular: '900111222',
            actividad: 'RECLAMISTA',
            skill: 'TOMA',
            horario: '06:00 - 22:00',
            updated_by: 'admin.bt',
            admin_edited_fields: 'celular',
          },
        }),
      } as Response);

      const res = await updateTurnRow({
        id: 'row-bt-1',
        fecha: today,
        contratista: 'ALFA',
        changes: { celular: '900111222' },
        usuario: 'admin.bt',
        rol: 'ADMIN',
        userGrupo: 'BT',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(res.ok).toBe(true);
      expect(res.row.celular).toBe('900111222');
      expect(res.row.admin_edited_fields).toEqual(['celular']);
      return;
    }

    await saveTurn({
      fecha: today,
      contratista: 'ALFA',
      grupo: 'BT',
      usuario: 'contrata.alfa',
      rows: [
        {
          id: 'row-bt-1',
          fecha: today,
          contratista: 'ALFA',
          grupo: 'BT',
          frente: 'RECLAMOS',
          nombres: 'Pedro Castillo',
          usuario_ssam: 'PCASTILLO',
          celular: '987654321',
          actividad: 'RECLAMISTA',
          skill: 'TOMA',
          horario: '06:00 - 22:00',
        },
      ],
    });

    await expect(
      updateTurnRow({
        id: 'row-bt-1',
        fecha: today,
        contratista: 'ALFA',
        changes: { celular: '900111222' },
        usuario: 'admin.ap',
        rol: 'ADMIN',
        userGrupo: 'AP',
      }),
    ).rejects.toThrow(/grupo/i);

    const firstEdit = await updateTurnRow({
      id: 'row-bt-1',
      fecha: today,
      contratista: 'ALFA',
      changes: { celular: '900111222' },
      usuario: 'admin.bt',
      rol: 'ADMIN',
      userGrupo: 'BT',
    });
    expect(firstEdit.ok).toBe(true);
    expect(firstEdit.row.celular).toBe('900111222');
    expect(firstEdit.row.admin_edited_fields).toEqual(['celular']);
    expect(firstEdit.row.updated_by).toBe('admin.bt');

    const secondEdit = await updateTurnRow({
      id: 'row-bt-1',
      fecha: today,
      contratista: 'ALFA',
      changes: { horario: '07:00 - 16:00' },
      usuario: 'admin.bt',
      rol: 'ADMIN',
      userGrupo: 'BT',
    });
    expect(secondEdit.row.admin_edited_fields).toEqual(['celular', 'horario']);

    const fetched = await getTurn(today, 'ALFA', 'ADMIN');
    expect(fetched[0].celular).toBe('900111222');
    expect(fetched[0].admin_edited_fields).toEqual(['celular', 'horario']);
  });
});
