import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDemoMode, login } from './gasClient';

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
