import {
  Zap,
  ClipboardList,
  BarChart3,
  Settings2,
  LogOut,
  FlaskConical,
} from 'lucide-react';
import { isDemoMode } from '../services/gasClient';
import type { UserSession } from '../types/operalog';

export type AppTab = 'registro' | 'graficos' | 'catalogos';

export interface TopNavProps {
  user: UserSession;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onLogout: () => void;
}

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

export function TopNav({ user, activeTab, onTabChange, onLogout }: TopNavProps) {
  const demoMode = isDemoMode();
  const isAdmin = user.rol === 'ADMIN';
  const visibleTabs: TabDef[] = isAdmin
    ? [
        { id: 'graficos', label: 'Gráficos y Estado', icon: BarChart3 },
        { id: 'registro', label: 'Consulta de Turnos', icon: ClipboardList },
        { id: 'catalogos', label: 'Catálogos (Admin)', icon: Settings2, adminOnly: true },
      ]
    : TABS.filter((tab) => !tab.adminOnly);

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
          {/* PLUZ Logo Mark */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
              style={{ backgroundColor: 'var(--pluz-primary)' }}
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
                {user.rol}
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
        <nav
          aria-label="Navegación principal"
          className="flex items-center gap-1 overflow-x-auto -mb-px"
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
      </div>
    </header>
  );
}

export default TopNav;
