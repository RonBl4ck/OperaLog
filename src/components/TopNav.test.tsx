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
