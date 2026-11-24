import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App, { shouldUnlockHistoryByDefault } from './App';
import * as gasClient from './services/gasClient';

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

describe('App bootstrap revalidation on F5 and logout cleanup', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('revalidates catalogs and contratas with forceRefresh=true on restored session mount and clears session cache on logout', async () => {
    sessionStorage.setItem(
      'operalog_user_session_v1',
      JSON.stringify({
        usuario: 'admin.pluz',
        rol: 'ADMIN',
        contratista: 'ALL',
        nombre_mostrar: 'Admin General',
        grupo: 'ALL',
        ver_historico: true,
      }),
    );

    const getCatalogsSpy = vi.spyOn(gasClient, 'getCatalogs').mockResolvedValue([]);
    const getContratasMetaSpy = vi
      .spyOn(gasClient, 'getContratasMeta')
      .mockResolvedValue([{ nombre: 'ALFA', grupo: 'BT' }]);
    vi.spyOn(gasClient, 'getTurnsRange').mockResolvedValue([]);
    vi.spyOn(gasClient, 'getPublicUsers').mockResolvedValue([]);
    const clearCacheSpy = vi.spyOn(gasClient, 'clearSessionDataCache');

    render(<App />);

    await waitFor(() => {
      expect(getCatalogsSpy).toHaveBeenCalledWith(true, undefined, { forceRefresh: true });
      expect(getContratasMetaSpy).toHaveBeenCalledWith({ forceRefresh: true });
    });

    const logoutBtn = screen.getByTitle('Cerrar sesión');
    fireEvent.click(logoutBtn);

    expect(clearCacheSpy).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('operalog_user_session_v1')).toBeNull();
  });

  it('refreshes stale user groups in sessionStorage on reload (Ctrl+F5) from live Usuarios_Contratas', async () => {
    sessionStorage.setItem(
      'operalog_user_session_v1',
      JSON.stringify({
        usuario: 'PLUZ',
        rol: 'ADMIN',
        contratista: 'PLUZ',
        nombre_mostrar: 'PLUZ',
        grupo: 'BT,AP',
        ver_historico: false,
      }),
    );

    vi.spyOn(gasClient, 'getCatalogs').mockResolvedValue([]);
    vi.spyOn(gasClient, 'getContratasMeta').mockResolvedValue([
      { nombre: 'ALFA', grupo: 'BT' },
      { nombre: 'NORTE', grupo: 'BT-N' },
    ]);
    vi.spyOn(gasClient, 'getTurnsRange').mockResolvedValue([]);
    vi.spyOn(gasClient, 'getPublicUsers').mockResolvedValue([
      {
        usuario: 'PLUZ',
        rol: 'ADMIN',
        contratista: 'PLUZ',
        nombre_mostrar: 'PLUZ',
        grupo: 'BT,BT-N',
        ver_historico: false,
      },
    ]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/ADMIN · BT · BT-N/i)).toBeTruthy();
    });

    expect(screen.queryByRole('button', { name: 'AP' })).toBeNull();
    expect(screen.getByRole('button', { name: 'BT-N' })).toBeTruthy();

    const persisted = JSON.parse(sessionStorage.getItem('operalog_user_session_v1') || '{}') as {
      grupo?: string;
    };
    expect(persisted.grupo).toBe('BT,BT-N');
  });
});
