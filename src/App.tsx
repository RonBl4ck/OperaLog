import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LoginView } from './components/LoginView';
import { TopNav, type AppTab } from './components/TopNav';
import { OperationsTab } from './components/OperationsTab';
import { AdminTurnsView } from './components/AdminTurnsView';
import { AdminCatalogsTab } from './components/AdminCatalogsTab';
import { ToastContainer } from './components/ui/ToastContainer';
import { getCatalogs, getContratas, getTurn } from './services/gasClient';
import type { CatalogItem, ToastMessage, TurnRow, UserSession } from './types/operalog';

const ChartsTab = lazy(() => import('./components/ChartsTab'));

const SESSION_KEY = 'operalog_user_session_v1';

export default function App() {
  const [user, setUser] = useState<UserSession | null>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as UserSession) : null;
    } catch {
      return null;
    }
  });

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
  const [adminChartRows, setAdminChartRows] = useState<TurnRow[] | null>(null);
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
      const [cats, conts] = await Promise.all([getCatalogs(), getContratas()]);
      setCatalogs(cats);
      if (conts.length > 0) setContratas(conts);
    } catch {
      // Silencioso; cada tab maneja su feedback si falla
    }
  }, []);

  useEffect(() => {
    if (user) {
      void loadBootstrapData();
    }
  }, [user, loadBootstrapData]);

  // Para ADMIN en pestaña Gráficos, cargar todas las contratistas de la fecha activa
  useEffect(() => {
    if (user?.rol === 'ADMIN' && activeTab === 'graficos') {
      getTurn(currentFecha, 'ALL', 'ADMIN')
        .then((allRows) => setAdminChartRows(allRows))
        .catch(() => setAdminChartRows(null));
    } else {
      setAdminChartRows(null);
    }
  }, [user, activeTab, currentFecha]);

  const handleLoginSuccess = useCallback((loggedUser: UserSession) => {
    setUser(loggedUser);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(loggedUser));
    } catch {
      // Ignore storage errors
    }
    setActiveTab(loggedUser.rol === 'ADMIN' ? 'graficos' : 'registro');
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setCurrentRows([]);
    setAdminChartRows(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore
    }
  }, []);

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

  const chartRows = user.rol === 'ADMIN' && adminChartRows ? adminChartRows : currentRows;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--pluz-bg)' }}>
      <TopNav
        user={user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'registro' &&
          (user.rol === 'ADMIN' ? (
            <AdminTurnsView
              fecha={currentFecha}
              onFechaChange={setCurrentFecha}
              contratas={contratas}
              onToast={addToast}
            />
          ) : (
            <OperationsTab
              user={user}
              catalogs={catalogs}
              contratas={contratas}
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
            />
          </Suspense>
        )}

        {activeTab === 'catalogos' && user.rol === 'ADMIN' && (
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
