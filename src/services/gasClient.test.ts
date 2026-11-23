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

describe('GAS cache-busting and sessionStorage revalidation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
    sessionStorage.clear();
  });

  async function loadLiveGasClient() {
    vi.resetModules();
    vi.stubEnv('VITE_GAS_URL', 'https://script.google.com/macros/s/test-deploy/exec');
    return import('./gasClient');
  }

  it('appends cache-buster _t and uses cache: no-store on gasGet requests', async () => {
    const client = await loadLiveGasClient();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, rows: [] }),
    } as Response);

    await client.getTurn('2026-11-23', 'ALL', 'ADMIN');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchSpy.mock.calls[0];
    const parsedUrl = new URL(String(calledUrl));
    expect(parsedUrl.searchParams.get('action')).toBe('getTurn');
    expect(parsedUrl.searchParams.get('_t')).toMatch(/^\d+$/);
    expect(init).toMatchObject({ method: 'GET', cache: 'no-store' });
  });

  it('bypasses sessionStorage cache when forceRefresh=true and clears cache on clearSessionDataCache', async () => {
    const client = await loadLiveGasClient();
    sessionStorage.setItem(
      'operalog_cache_catalogs_v2',
      JSON.stringify([
        { tipo: 'HORARIO', frente: 'ALL', valor: 'OLD', orden: 1, activo: true, grupo: 'ALL' },
      ]),
    );
    sessionStorage.setItem(
      'operalog_cache_contratas_meta_v2',
      JSON.stringify([{ nombre: 'OLD_CONTRATA', grupo: 'BT' }]),
    );
    sessionStorage.setItem('operalog_cache_contratas_v2', JSON.stringify(['OLD_CONTRATA']));

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('action=getAllCatalogs')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            catalogs: [
              { tipo: 'HORARIO', frente: 'ALL', valor: 'FRESH', orden: 1, activo: true, grupo: 'ALL' },
            ],
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          ok: true,
          contratas: ['NEW_CONTRATA'],
          contratasMeta: [{ nombre: 'NEW_CONTRATA', grupo: 'BT' }],
        }),
      } as Response;
    });

    expect(client.readCachedCatalogs(true)?.[0]?.valor).toBe('OLD');
    expect(client.readCachedContratasMeta()?.[0]?.nombre).toBe('OLD_CONTRATA');

    const freshCatalogs = await client.getCatalogs(true, undefined, { forceRefresh: true });
    const freshMeta = await client.getContratasMeta({ forceRefresh: true });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(freshCatalogs[0].valor).toBe('FRESH');
    expect(freshMeta).toEqual([{ nombre: 'NEW_CONTRATA', grupo: 'BT' }]);
    expect(JSON.parse(sessionStorage.getItem('operalog_cache_contratas_v2') || '[]')).toEqual([
      'NEW_CONTRATA',
    ]);

    client.clearSessionDataCache();
    expect(sessionStorage.getItem('operalog_cache_catalogs_v2')).toBeNull();
    expect(sessionStorage.getItem('operalog_cache_contratas_v2')).toBeNull();
    expect(sessionStorage.getItem('operalog_cache_contratas_meta_v2')).toBeNull();
  });

  it('merges scoped saveCatalog updates into SESSION_CATALOGS without dropping other groups', async () => {
    const client = await loadLiveGasClient();
    sessionStorage.setItem(
      'operalog_cache_catalogs_v2',
      JSON.stringify([
        { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'OLD_BT', orden: 1, activo: true, grupo: 'BT' },
        { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'KEEP_AP', orden: 1, activo: true, grupo: 'AP' },
      ]),
    );

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        items: [
          { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'NEW_BT', orden: 1, activo: true, grupo: 'BT' },
        ],
      }),
    } as Response);

    await client.saveCatalog({
      items: [
        { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'NEW_BT', orden: 1, activo: true, grupo: 'BT' },
      ],
      rol: 'ADMIN',
      usuario: 'admin.bt',
      grupo: 'BT',
    });

    const stored = JSON.parse(sessionStorage.getItem('operalog_cache_catalogs_v2') || '[]') as {
      valor: string;
      grupo: string;
    }[];
    expect(stored.map((item) => item.valor).sort()).toEqual(['KEEP_AP', 'NEW_BT']);
  });
});
