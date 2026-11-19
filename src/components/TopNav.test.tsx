import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopNav } from './TopNav';
import type { UserSession } from '../types/operalog';

const ADMIN_USER: UserSession = {
  usuario: 'admin.pluz',
  rol: 'ADMIN',
  contratista: 'ALL',
  nombre_mostrar: 'Administrador PLUZ',
};

describe('TopNav master history unlock via double-click on logo', () => {
  it('hides Catálogos (Admin) when locked and opens password popover on double click', () => {
    const onUnlockHistory = vi.fn((pwd: string) => pwd === 'pluz2026');
    const onLockHistory = vi.fn();

    const { rerender } = render(
      <TopNav
        user={ADMIN_USER}
        activeTab="graficos"
        onTabChange={vi.fn()}
        onLogout={vi.fn()}
        isHistoryUnlocked={false}
        onUnlockHistory={onUnlockHistory}
        onLockHistory={onLockHistory}
      />,
    );

    // Catálogos (Admin) is hidden while locked
    expect(screen.queryByRole('button', { name: /Catálogos \(Admin\)/i })).toBeNull();

    // Double-click logo opens empty password input
    const logo = screen.getByRole('button', { name: 'Logo OperaLog' });
    fireEvent.doubleClick(logo);

    const input = screen.getByLabelText('Clave') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toBe('');

    // Wrong password clears input and does not unlock
    fireEvent.change(input, { target: { value: 'wrong' } });
    fireEvent.submit(input.closest('form')!);
    expect(onUnlockHistory).toHaveBeenCalledWith('wrong');
    expect(input.value).toBe('');

    // Correct password unlocks and closes popover
    fireEvent.change(input, { target: { value: 'pluz2026' } });
    fireEvent.submit(input.closest('form')!);
    expect(onUnlockHistory).toHaveBeenCalledWith('pluz2026');

    // Rerender unlocked state
    rerender(
      <TopNav
        user={ADMIN_USER}
        activeTab="graficos"
        onTabChange={vi.fn()}
        onLogout={vi.fn()}
        isHistoryUnlocked={true}
        onUnlockHistory={onUnlockHistory}
        onLockHistory={onLockHistory}
      />,
    );

    // Catálogos (Admin) is now visible, plus the quick re-lock pill
    expect(screen.getByRole('button', { name: /Catálogos \(Admin\)/i })).toBeTruthy();
    const lockBtn = screen.getByRole('button', { name: /Histórico activo · Bloquear/i });
    fireEvent.click(lockBtn);
    expect(onLockHistory).toHaveBeenCalledTimes(1);
  });
});

describe('TopNav group badge and admin group switcher', () => {
  it('renders group selector only for ADMIN with grupo === ALL and emits changes', () => {
    const onAdminGroupFilterChange = vi.fn();
    render(
      <TopNav
        user={{ ...ADMIN_USER, grupo: 'ALL' }}
        activeTab="graficos"
        onTabChange={vi.fn()}
        onLogout={vi.fn()}
        adminGroupFilter="ALL"
        onAdminGroupFilterChange={onAdminGroupFilterChange}
      />,
    );

    expect(screen.getByText('ADMIN · GENERAL')).toBeTruthy();
    const groupBar = screen.getByRole('group', { name: 'Filtro de grupo' });
    expect(groupBar).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'AP' }));
    expect(onAdminGroupFilterChange).toHaveBeenCalledWith('AP');
  });

  it('hides group switcher and shows fixed badge for group-specific admins (BT, AP, MT)', () => {
    render(
      <TopNav
        user={{ ...ADMIN_USER, usuario: 'admin.bt', grupo: 'BT' }}
        activeTab="graficos"
        onTabChange={vi.fn()}
        onLogout={vi.fn()}
        adminGroupFilter="BT"
        onAdminGroupFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByText('ADMIN · BT')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Filtro de grupo' })).toBeNull();
    expect(screen.getByLabelText('Grupo asignado: BT')).toBeTruthy();
  });

  it('shows CONTRATA group badge without admin group switcher', () => {
    render(
      <TopNav
        user={{
          usuario: 'contrata.lumina',
          rol: 'CONTRATA',
          contratista: 'LUMINA',
          nombre_mostrar: 'Contrata LUMINA',
          grupo: 'AP',
        }}
        activeTab="registro"
        onTabChange={vi.fn()}
        onLogout={vi.fn()}
        onAdminGroupFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByText('CONTRATA · AP')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Filtro de grupo' })).toBeNull();
  });
});
