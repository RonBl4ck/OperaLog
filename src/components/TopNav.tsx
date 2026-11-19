import React, { useEffect, useRef, useState } from 'react';
import {
  Zap,
  ClipboardList,
  BarChart3,
  Settings2,
  LogOut,
  FlaskConical,
  Lock,
  Unlock,
} from 'lucide-react';
import { isDemoMode } from '../services/gasClient';
import { normalizeGroup, type UserGroupScope, type UserSession } from '../types/operalog';

export type AppTab = 'registro' | 'graficos' | 'catalogos';

export interface TopNavProps {
  user: UserSession;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onLogout: () => void;
  isHistoryUnlocked?: boolean;
  onUnlockHistory?: (password: string) => boolean;
  onLockHistory?: () => void;
  adminGroupFilter?: UserGroupScope;
  onAdminGroupFilterChange?: (g: UserGroupScope) => void;
}

const GROUP_OPTIONS: { id: UserGroupScope; label: string }[] = [
  { id: 'ALL', label: 'Todos' },
  { id: 'BT', label: 'BT' },
  { id: 'AP', label: 'AP' },
  { id: 'MT', label: 'MT' },
];

interface TabDef {
  id: AppTab;
  label: string;
  icon: typeof ClipboardList;
  adminOnly?: boolean;
}

const TABS: TabDef[] = [
  { id: 'registro', label: 'Registro Operativo', icon: ClipboardList },
  { id: 'graficos', label: 'Gráficos y Estado', icon: BarChart3 },
  { id: 'catalogos', label: 'Catálogos (Admin)', icon: Settings2, adminOnly: true },
];

export function TopNav({
  user,
  activeTab,
  onTabChange,
  onLogout,
  isHistoryUnlocked = false,
  onUnlockHistory,
  onLockHistory,
  adminGroupFilter = 'ALL',
  onAdminGroupFilterChange,
}: TopNavProps) {
  const demoMode = isDemoMode();
  const isAdmin = user.rol === 'ADMIN';
  const userGroup = normalizeGroup(user.grupo, isAdmin ? 'ALL' : 'BT');
  const groupBadgeLabel = userGroup === 'ALL' ? 'GENERAL' : userGroup;
  const canSwitchGroup = isAdmin && userGroup === 'ALL';

  const [unlockMenuOpen, setUnlockMenuOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [unlockError, setUnlockError] = useState(false);

  const logoContainerRef = useRef<HTMLDivElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const lastClickTimeRef = useRef<number>(0);
  const lastToggleTimeRef = useRef<number>(0);

  const visibleTabs: TabDef[] = isAdmin
    ? [
        { id: 'graficos', label: 'Gráficos y Estado', icon: BarChart3 },
        { id: 'registro', label: 'Consulta de Turnos', icon: ClipboardList },
        ...(isHistoryUnlocked
          ? [{ id: 'catalogos' as const, label: 'Catálogos (Admin)', icon: Settings2, adminOnly: true }]
          : []),
      ]
    : TABS.filter((tab) => !tab.adminOnly);

  useEffect(() => {
    if (!unlockMenuOpen) return;
    const focusTimer = setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 30);

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        logoContainerRef.current &&
        !logoContainerRef.current.contains(event.target as Node)
      ) {
        setUnlockMenuOpen(false);
        setUnlockError(false);
        setPasswordInput('');
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUnlockMenuOpen(false);
        setUnlockError(false);
        setPasswordInput('');
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [unlockMenuOpen]);

  const openUnlockPopover = () => {
    if (!isAdmin) return;
    lastToggleTimeRef.current = Date.now();
    setUnlockError(false);
    setPasswordInput('');
    setUnlockMenuOpen((prev) => !prev);
  };

  const handleLogoClick = () => {
    if (!isAdmin) return;
    const now = Date.now();
    if (now - lastClickTimeRef.current < 360) {
      lastClickTimeRef.current = 0;
      openUnlockPopover();
    } else {
      lastClickTimeRef.current = now;
    }
  };

  const handleLogoDoubleClick = () => {
    if (!isAdmin) return;
    if (Date.now() - lastToggleTimeRef.current < 200) return;
    openUnlockPopover();
  };

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUnlockHistory) return;
    const trimmed = passwordInput.trim();
    if (!trimmed) {
      setUnlockError(true);
      return;
    }
    const ok = onUnlockHistory(trimmed);
    if (ok) {
      setUnlockMenuOpen(false);
      setPasswordInput('');
      setUnlockError(false);
    } else {
      setUnlockError(true);
      setPasswordInput('');
    }
  };

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-sm"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: 'var(--pluz-border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top Row: Brand + User & Actions */}
        <div className="h-14 flex items-center justify-between gap-3">
          {/* PLUZ Logo Mark + Secret Master Popover */}
          <div ref={logoContainerRef} className="relative flex items-center gap-2.5 min-w-0">
            <div
              role={isAdmin ? 'button' : undefined}
              tabIndex={isAdmin ? 0 : undefined}
              aria-label="Logo OperaLog"
              onClick={handleLogoClick}
              onDoubleClick={handleLogoDoubleClick}
              onKeyDown={(e) => {
                if (isAdmin && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  openUnlockPopover();
                }
              }}
              className={`flex items-center gap-2.5 select-none ${
                isAdmin ? 'cursor-pointer' : ''
              }`}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs transition-transform active:scale-95"
                style={{
                  backgroundColor: 'var(--pluz-primary)',
                  boxShadow:
                    isAdmin && isHistoryUnlocked
                      ? '0 0 0 2px rgba(251, 193, 64, 0.75)'
                      : undefined,
                }}
              >
                <Zap
                  className="w-4 h-4"
                  style={{ color: 'var(--pluz-accent)' }}
                  fill="currentColor"
                />
              </div>
              <div className="flex items-baseline gap-2 min-w-0">
                <span
                  className="text-base font-bold tracking-tight truncate"
                  style={{ color: 'var(--pluz-ink)' }}
                >
                  OperaLog
                </span>
                <span
                  className="hidden sm:inline text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--pluz-primary)' }}
                >
                  PLUZ
                </span>
              </div>
            </div>

            {isAdmin && isHistoryUnlocked && (
              <button
                type="button"
                onClick={() => {
                  setUnlockMenuOpen(false);
                  onLockHistory?.();
                }}
                className="tactile-btn inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 cursor-pointer"
                style={{
                  backgroundColor: 'rgba(60, 90, 159, 0.1)',
                  borderColor: 'rgba(60, 90, 159, 0.35)',
                  color: 'var(--pluz-primary)',
                }}
                title="Clic para volver a bloquear al día de hoy"
              >
                <Unlock className="w-3 h-3" />
                <span className="hidden xs:inline">Histórico activo · Bloquear</span>
              </button>
            )}

            {demoMode && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0"
                style={{
                  backgroundColor: 'rgba(251, 193, 64, 0.16)',
                  borderColor: 'rgba(251, 193, 64, 0.5)',
                  color: '#92610A',
                }}
              >
                <FlaskConical className="w-3 h-3" />
                <span className="hidden xs:inline">Demo Mode</span>
              </span>
            )}

            {/* Desplegable discreto al dar doble clic en el ícono */}
            {isAdmin && unlockMenuOpen && (
              <div
                role="dialog"
                aria-label="Desbloqueo"
                className="absolute left-0 top-full mt-2 z-50 w-48 rounded-xl border bg-white p-2 shadow-xl"
                style={{ borderColor: 'var(--pluz-border)' }}
              >
                {!isHistoryUnlocked ? (
                  <form onSubmit={handleUnlockSubmit}>
                    <input
                      ref={passwordInputRef}
                      type="password"
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        if (unlockError) setUnlockError(false);
                      }}
                      aria-label="Clave"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none focus:ring-2"
                      style={{
                        borderColor: unlockError ? 'var(--pluz-danger)' : 'var(--pluz-border)',
                        color: 'var(--pluz-ink)',
                        backgroundColor: 'var(--pluz-surface)',
                      }}
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setUnlockMenuOpen(false);
                      onLockHistory?.();
                    }}
                    className="tactile-btn w-full py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 hover:bg-slate-50 cursor-pointer"
                    style={{
                      borderColor: 'var(--pluz-border)',
                      color: 'var(--pluz-ink)',
                    }}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Restringir solo a hoy</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* User Badge & Logout */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg border"
              style={{
                backgroundColor: 'var(--pluz-bg)',
                borderColor: 'var(--pluz-border)',
              }}
            >
              <span
                className="text-xs font-semibold truncate max-w-[140px] sm:max-w-[200px]"
                style={{ color: 'var(--pluz-ink)' }}
              >
                {user.nombre_mostrar}
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style={{
                  backgroundColor:
                    user.rol === 'ADMIN'
                      ? 'rgba(60, 90, 159, 0.12)'
                      : 'rgba(108, 171, 94, 0.16)',
                  color:
                    user.rol === 'ADMIN'
                      ? 'var(--pluz-primary)'
                      : 'var(--pluz-success)',
                }}
              >
                {user.rol} · {groupBadgeLabel}
              </span>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              style={{
                borderColor: 'var(--pluz-border)',
                color: 'var(--pluz-muted)',
              }}
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Row */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto -mb-px">
          <nav
            aria-label="Navegación principal"
            className="flex items-center gap-1"
          >
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className="tactile-btn relative inline-flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap rounded-t-lg cursor-pointer"
                  style={{
                    color: isActive ? 'var(--pluz-primary)' : 'var(--pluz-muted)',
                    backgroundColor: isActive ? 'rgba(60, 90, 159, 0.05)' : 'transparent',
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full"
                      style={{
                        background:
                          'linear-gradient(90deg, var(--pluz-primary) 0%, var(--pluz-primary) 70%, var(--pluz-accent) 100%)',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {isAdmin &&
            (canSwitchGroup && onAdminGroupFilterChange ? (
              <div
                role="group"
                aria-label="Filtro de grupo"
                className="flex items-center gap-1 py-1.5 shrink-0"
              >
                {GROUP_OPTIONS.map((opt) => {
                  const isSelected = adminGroupFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onAdminGroupFilterChange(opt.id)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer"
                      style={{
                        backgroundColor: isSelected ? 'var(--pluz-primary)' : 'var(--pluz-surface)',
                        color: isSelected ? '#FFFFFF' : 'var(--pluz-muted)',
                        borderColor: isSelected ? 'var(--pluz-primary)' : 'var(--pluz-border)',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            ) : userGroup !== 'ALL' ? (
              <span
                aria-label={`Grupo asignado: ${userGroup}`}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0"
                style={{
                  backgroundColor: 'rgba(60, 90, 159, 0.08)',
                  borderColor: 'rgba(60, 90, 159, 0.25)',
                  color: 'var(--pluz-primary)',
                }}
              >
                Grupo {userGroup}
              </span>
            ) : null)}
        </div>
      </div>
    </header>
  );
}

export default TopNav;
