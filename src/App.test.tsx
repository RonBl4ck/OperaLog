import { describe, expect, it } from 'vitest';
import { shouldUnlockHistoryByDefault } from './App';

describe('shouldUnlockHistoryByDefault', () => {
  it('unlocks history automatically only for ADMIN with ver_historico=true', () => {
    expect(
      shouldUnlockHistoryByDefault({
        usuario: 'admin.pluz',
        rol: 'ADMIN',
        contratista: 'ALL',
        nombre_mostrar: 'Admin General',
        grupo: 'ALL',
        ver_historico: true,
      }),
    ).toBe(true);

    expect(
      shouldUnlockHistoryByDefault({
        usuario: 'admin.bt',
        rol: 'ADMIN',
        contratista: 'ALL',
        nombre_mostrar: 'Admin BT',
        grupo: 'BT',
        ver_historico: false,
      }),
    ).toBe(false);

    expect(
      shouldUnlockHistoryByDefault({
        usuario: 'contrata.alfa',
        rol: 'CONTRATA',
        contratista: 'ALFA',
        nombre_mostrar: 'Alfa',
        grupo: 'BT',
        ver_historico: true,
      }),
    ).toBe(false);

    expect(shouldUnlockHistoryByDefault(null)).toBe(false);
  });
});
