import React, { useEffect, useState } from 'react';
import { Zap, Lock, User, Eye, EyeOff, AlertCircle, Sparkles } from 'lucide-react';
import { getPublicUsers, login, isDemoMode, type PublicUserOption } from '../services/gasClient';
import type { UserSession } from '../types/operalog';

export interface LoginViewProps {
  onLoginSuccess: (user: UserSession) => void;
}

interface DemoAccount {
  label: string;
  roleLabel: string;
  usuario: string;
  pin: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: 'admin.pluz / 1234',
    roleLabel: 'ADMIN · GENERAL',
    usuario: 'admin.pluz',
    pin: '1234',
  },
  {
    label: 'admin.bt / 1234',
    roleLabel: 'ADMIN · BT',
    usuario: 'admin.bt',
    pin: '1234',
  },
  {
    label: 'admin.ap / 1234',
    roleLabel: 'ADMIN · AP',
    usuario: 'admin.ap',
    pin: '1234',
  },
  {
    label: 'contrata.alfa / 5678',
    roleLabel: 'CONTRATA · BT',
    usuario: 'contrata.alfa',
    pin: '5678',
  },
  {
    label: 'contrata.lumina / 5678',
    roleLabel: 'CONTRATA · AP',
    usuario: 'contrata.lumina',
    pin: '5678',
  },
  {
    label: 'contrata.redesmt / 5678',
    roleLabel: 'CONTRATA · MT',
    usuario: 'contrata.redesmt',
    pin: '5678',
  },
];

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [usuario, setUsuario] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userOptions, setUserOptions] = useState<PublicUserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [manualUserMode, setManualUserMode] = useState(false);

  const demoMode = isDemoMode();

  useEffect(() => {
    let active = true;
    getPublicUsers()
      .then((list) => {
        if (!active) return;
        setUserOptions(list);
        if (list.length === 0) {
          setManualUserMode(true);
        }
      })
      .finally(() => {
        if (active) setLoadingUsers(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUser = usuario.trim();
    const trimmedPin = pin.trim();

    if (!trimmedUser || !trimmedPin) {
      setError('Ingresa tu usuario y contraseña.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const session = await login(trimmedUser, trimmedPin);
      onLoginSuccess(session);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Credenciales inválidas. Verifica usuario y contraseña.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (account: DemoAccount) => {
    setUsuario(account.usuario);
    setPin(account.pin);
    setError(null);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ backgroundColor: 'var(--pluz-bg)' }}
    >
      <div className="w-full max-w-md">
        <div
          className="rounded-2xl border shadow-sm overflow-hidden"
          style={{
            backgroundColor: 'var(--pluz-surface)',
            borderColor: 'var(--pluz-border)',
          }}
        >
          {/* Top PLUZ accent bar */}
          <div className="h-1.5 w-full flex">
            <div className="flex-1" style={{ backgroundColor: 'var(--pluz-primary)' }} />
            <div className="w-24" style={{ backgroundColor: 'var(--pluz-accent)' }} />
          </div>

          <div className="p-8">
            {/* Brand Header */}
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm shrink-0"
                style={{ backgroundColor: 'var(--pluz-primary)' }}
              >
                <Zap className="w-6 h-6" style={{ color: 'var(--pluz-accent)' }} fill="currentColor" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1
                    className="text-xl font-bold tracking-tight"
                    style={{ color: 'var(--pluz-ink)' }}
                  >
                    OperaLog
                  </h1>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'rgba(60, 90, 159, 0.1)',
                      color: 'var(--pluz-primary)',
                    }}
                  >
                    PLUZ
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--pluz-muted)' }}>
                  Gestión Operativa de Turnos y Capacidad
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-usuario"
                    className="block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--pluz-muted)' }}
                  >
                    Usuario / Contratista
                  </label>
                  {userOptions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setManualUserMode((prev) => !prev)}
                      className="text-[11px] font-medium hover:underline"
                      style={{ color: 'var(--pluz-primary)' }}
                    >
                      {manualUserMode ? 'Usar lista' : 'Escribir manual'}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <User
                    className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'var(--pluz-muted)' }}
                  />
                  {!manualUserMode ? (
                    <select
                      id="login-usuario"
                      value={usuario}
                      onChange={(e) => setUsuario(e.target.value)}
                      disabled={isLoading || loadingUsers}
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg border outline-none transition-colors focus:ring-2"
                      style={{
                        borderColor: 'var(--pluz-border)',
                        color: usuario ? 'var(--pluz-ink)' : 'var(--pluz-muted)',
                        backgroundColor: 'var(--pluz-surface)',
                      }}
                    >
                      <option value="">
                        {loadingUsers ? 'Cargando usuarios...' : 'Selecciona tu usuario...'}
                      </option>
                      {userOptions.map((u) => (
                        <option key={u.usuario} value={u.usuario}>
                          {u.nombre_mostrar} ({u.usuario})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="login-usuario"
                      type="text"
                      autoComplete="username"
                      value={usuario}
                      onChange={(e) => setUsuario(e.target.value)}
                      placeholder="ej. admin.pluz o contrata.alfa"
                      disabled={isLoading}
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg border outline-none transition-colors focus:ring-2"
                      style={{
                        borderColor: 'var(--pluz-border)',
                        color: 'var(--pluz-ink)',
                        backgroundColor: 'var(--pluz-surface)',
                      }}
                    />
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-pin"
                  className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                  style={{ color: 'var(--pluz-muted)' }}
                >
                  Contraseña
                </label>
                <div className="relative">
                  <Lock
                    className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'var(--pluz-muted)' }}
                  />
                  <input
                    id="login-pin"
                    type={showPin ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    className="w-full pl-10 pr-10 py-2.5 text-sm rounded-lg border outline-none transition-colors focus:ring-2"
                    style={{
                      borderColor: 'var(--pluz-border)',
                      color: 'var(--pluz-ink)',
                      backgroundColor: 'var(--pluz-surface)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100 transition-colors"
                    style={{ color: 'var(--pluz-muted)' }}
                    aria-label={showPin ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3 rounded-lg border text-xs font-medium"
                  style={{
                    backgroundColor: 'rgba(230, 57, 70, 0.08)',
                    borderColor: 'rgba(230, 57, 70, 0.25)',
                    color: 'var(--pluz-danger)',
                  }}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="tactile-btn w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                style={{ backgroundColor: 'var(--pluz-primary)' }}
              >
                {isLoading ? 'Verificando acceso...' : 'Ingresar a OperaLog'}
              </button>
            </form>

            {/* Quick-fill demo chips */}
            {demoMode && (
              <div
                className="mt-6 pt-5 border-t"
                style={{ borderColor: 'var(--pluz-border)' }}
              >
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--pluz-accent)' }} />
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--pluz-muted)' }}
                  >
                    Modo Demo Local — Acceso Rápido
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DEMO_ACCOUNTS.map((acc) => {
                    const isSelected = usuario === acc.usuario && pin === acc.pin;
                    return (
                      <button
                        key={acc.usuario}
                        type="button"
                        onClick={() => handleQuickFill(acc)}
                        className="tactile-btn text-xs px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 cursor-pointer"
                        style={{
                          borderColor: isSelected ? 'var(--pluz-primary)' : 'var(--pluz-border)',
                          backgroundColor: isSelected
                            ? 'rgba(60, 90, 159, 0.08)'
                            : 'var(--pluz-bg)',
                          color: isSelected ? 'var(--pluz-primary)' : 'var(--pluz-ink)',
                        }}
                      >
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.2 rounded"
                          style={{
                            backgroundColor:
                              acc.roleLabel.startsWith('ADMIN')
                                ? 'rgba(60, 90, 159, 0.14)'
                                : 'rgba(108, 171, 94, 0.16)',
                            color:
                              acc.roleLabel.startsWith('ADMIN')
                                ? 'var(--pluz-primary)'
                                : 'var(--pluz-success)',
                          }}
                        >
                          {acc.roleLabel}
                        </span>
                        <span className="font-mono text-[11px]">{acc.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginView;
