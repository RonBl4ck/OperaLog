import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LoginView } from './components/LoginView';
import { TopNav, type AppTab } from './components/TopNav';
import { OperationsTab, clearOperationsCache } from './components/OperationsTab';
import { AdminTurnsView } from './components/AdminTurnsView';
import { AdminCatalogsTab } from './components/AdminCatalogsTab';
import { ToastContainer } from './components/ui/ToastContainer';
import { getCatalogs, getContratas, getTodayIsoDate, getTurn, getTurnsRange } from './services/gasClient';
import type { CatalogItem, ToastMessage, TurnRow, UserSession } from './types/operalog';

const ChartsTab = lazy(() => import('./components/ChartsTab'));

const SESSION_KEY = 'operalog_user_session_v1';
export const MASTER_HISTORY_PASSWORD =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_MASTER_PASSWORD ?? '').trim();

export default function App() {
  const [user, setUser] = useState<UserSession | null>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as UserSession) : null;
    } catch {
      return null;
    }
  });
  const [isHistoryUnlocked, setIsHistoryUnlocked] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as UserSession;
        return parsed.rol === 'ADMIN' ? 'graficos' : 'registro';
      }
    } catch {
      // Ignore
    }
    return 'registro';
  });
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([]);
  const [contratas, setContratas] = useState<string[]>(['ALFA', 'BETA']);
  const [currentRows, setCurrentRows] = useState<TurnRow[]>([]);
  const [currentFecha, setCurrentFecha] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [adminTurnsCache, setAdminTurnsCache] = useState<Record<string, TurnRow[]>>({});
  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [adminSelectedContrata, setAdminSelectedContrata] = useState<string>('ALL');
  const [chartFechaInicio, setChartFechaInicio] = useState<string>(() => getTodayIsoDate());
  const [chartFechaFin, setChartFechaFin] = useState<string>(() => getTodayIsoDate());
  const [adminRangeCache, setAdminRangeCache] = useState<Record<string, TurnRow[]>>({});
  const [adminRangeLoading, setAdminRangeLoading] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadBootstrapData = useCallback(async () => {
    try {
      const [cats, conts] = await Promise.all([
        getCatalogs(user?.rol === 'ADMIN'),
        getContratas(),
      ]);
      setCatalogs(cats);
      if (conts.length > 0) setContratas(conts);
    } catch {
      // Silencioso; cada tab maneja su feedback si falla
    }
  }, [user?.rol]);

  useEffect(() => {
    if (user) {
      void loadBootstrapData();
    }
  }, [user, loadBootstrapData]);

  const fetchAdminTurns = useCallback(
    async (fecha: string, force = false) => {
      if (!force && adminTurnsCache[fecha]) return;
      setAdminLoading(true);
      try {
        const allRows = await getTurn(fecha, 'ALL', 'ADMIN');
        setAdminTurnsCache((prev) => ({ ...prev, [fecha]: allRows }));
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Error al consultar turnos',
          description: err instanceof Error ? err.message : 'Intente nuevamente.',
        });
      } finally {
        setAdminLoading(false);
      }
    },
    [adminTurnsCache, addToast],
  );

  // Para ADMIN, cargar la fecha activa solo si aún no está en caché
  useEffect(() => {
    if (user?.rol === 'ADMIN' && activeTab === 'registro') {
      void fetchAdminTurns(currentFecha, false);
    }
  }, [user, activeTab, currentFecha, fetchAdminTurns]);

  const fetchAdminTurnsRange = useCallback(
    async (inicio: string, fin: string, force = false) => {
      const rangeKey = `${inicio}__${fin}`;
      if (!force && adminRangeCache[rangeKey]) return;
      setAdminRangeLoading(true);
      try {
        const rangeRows = await getTurnsRange(inicio, fin, 'ALL', 'ADMIN');
        setAdminRangeCache((prev) => ({ ...prev, [rangeKey]: rangeRows }));
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Error al consultar rango de gráficos',
          description: err instanceof Error ? err.message : 'Intente nuevamente.',
        });
      } finally {
        setAdminRangeLoading(false);
      }
    },
    [adminRangeCache, addToast],
  );

  useEffect(() => {
    if (user?.rol === 'ADMIN' && activeTab === 'graficos') {
      void fetchAdminTurnsRange(chartFechaInicio, chartFechaFin, false);
    }
  }, [user, activeTab, chartFechaInicio, chartFechaFin, fetchAdminTurnsRange]);

  const handleLoginSuccess = useCallback((loggedUser: UserSession) => {
    const today = getTodayIsoDate();
    setUser(loggedUser);
    setIsHistoryUnlocked(false);
    setCurrentFecha(today);
    setChartFechaInicio(today);
    setChartFechaFin(today);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(loggedUser));
    } catch {
      // Ignore storage errors
    }
    setActiveTab(loggedUser.rol === 'ADMIN' ? 'graficos' : 'registro');
  }, []);

  const handleLogout = useCallback(() => {
    const today = getTodayIsoDate();
    setUser(null);
    setIsHistoryUnlocked(false);
    setCurrentRows([]);
    setCurrentFecha(today);
    setChartFechaInicio(today);
    setChartFechaFin(today);
    setAdminTurnsCache({});
    setAdminRangeCache({});
    setAdminSelectedContrata('ALL');
    clearOperationsCache();
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const handleUnlockHistory = useCallback(
    (password: string): boolean => {
      if (MASTER_HISTORY_PASSWORD.length > 0 && password.trim() === MASTER_HISTORY_PASSWORD) {
        setIsHistoryUnlocked(true);
        addToast({
          type: 'success',
          title: 'Historial desbloqueado',
          description: 'Ya puedes consultar todos los días y administrar Catálogos.',
        });
        return true;
      }
      return false;
    },
    [addToast],
  );

  const handleLockHistory = useCallback(() => {
    const today = getTodayIsoDate();
    setIsHistoryUnlocked(false);
    setCurrentFecha(today);
    setChartFechaInicio(today);
    setChartFechaFin(today);
    setActiveTab((prev) => (prev === 'catalogos' ? 'graficos' : prev));
    addToast({
      type: 'info',
      title: 'Vista restringida a hoy',
      description: 'El historial de días anteriores y Catálogos han sido bloqueados.',
    });
  }, [addToast]);

  const handleRowsChange = useCallback((rows: TurnRow[], fecha: string) => {
    setCurrentRows(rows);
    setCurrentFecha(fecha);
  }, []);

  const activeHorarios = useMemo(
    () =>
      catalogs
        .filter((c) => c.tipo === 'HORARIO' && c.activo)
        .sort((a, b) => a.orden - b.orden)
        .map((c) => c.valor),
    [catalogs],
  );

  if (!user) {
    return (
      <>
        <LoginView onLoginSuccess={handleLoginSuccess} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const adminRowsForDate = adminTurnsCache[currentFecha] ?? [];
  const adminRangeRows = adminRangeCache[`${chartFechaInicio}__${chartFechaFin}`] ?? [];
  const chartRows = user.rol === 'ADMIN' ? adminRangeRows : currentRows;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--pluz-bg)' }}>
      <TopNav
        user={user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
        isHistoryUnlocked={isHistoryUnlocked}
        onUnlockHistory={handleUnlockHistory}
        onLockHistory={handleLockHistory}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'registro' &&
          (user.rol === 'ADMIN' ? (
            <AdminTurnsView
              fecha={currentFecha}
              onFechaChange={(nextFecha) => {
                if (!isHistoryUnlocked) return;
                setCurrentFecha(nextFecha);
              }}
              allowDateChange={isHistoryUnlocked}
              contratas={contratas}
              rows={adminRowsForDate}
              loading={adminLoading}
              onRefresh={() => void fetchAdminTurns(currentFecha, true)}
              selectedContrata={adminSelectedContrata}
              onSelectedContrataChange={setAdminSelectedContrata}
              onToast={addToast}
            />
          ) : (
            <OperationsTab
              user={user}
              catalogs={catalogs}
              contratas={contratas}
              initialFecha={currentFecha}
              onToast={addToast}
              onRowsChange={handleRowsChange}
            />
          ))}

        {activeTab === 'graficos' && (
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20 gap-3 text-sm" style={{ color: 'var(--pluz-muted)' }}>
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--pluz-primary)' }} />
                <span>Cargando panel de gráficos...</span>
              </div>
            }
          >
            <ChartsTab
              rows={chartRows}
              horariosCatalog={activeHorarios}
              user={user}
              contratas={contratas}
              selectedContrata={adminSelectedContrata}
              onSelectedContrataChange={setAdminSelectedContrata}
              fecha={currentFecha}
              onFechaChange={(nextFecha) => {
                if (!isHistoryUnlocked) return;
                setCurrentFecha(nextFecha);
              }}
              fechaInicio={chartFechaInicio}
              fechaFin={chartFechaFin}
              onFechaRangeChange={(inicio, fin) => {
                if (!isHistoryUnlocked) return;
                setChartFechaInicio(inicio);
                setChartFechaFin(fin);
              }}
              allowDateChange={isHistoryUnlocked}
              onRefresh={() => void fetchAdminTurnsRange(chartFechaInicio, chartFechaFin, true)}
              loading={user.rol === 'ADMIN' ? adminRangeLoading : adminLoading}
              onDrillDownContrata={(contratista) => {
                setAdminSelectedContrata(contratista);
                setActiveTab('registro');
              }}
            />
          </Suspense>
        )}

        {activeTab === 'catalogos' && user.rol === 'ADMIN' && isHistoryUnlocked && (
          <AdminCatalogsTab
            catalog={catalogs}
            onCatalogSaved={(updated) => {
              setCatalogs(updated);
              addToast({
                type: 'success',
                title: 'Catálogos actualizados',
                description: 'Los desplegables de horarios, skills y actividades ya reflejan los cambios.',
              });
            }}
            user={user}
          />
        )}
      </main>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
