import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LoginView } from './components/LoginView';
import { TopNav, type AppTab } from './components/TopNav';
import { OperationsTab, clearOperationsCache } from './components/OperationsTab';
import { AdminTurnsView } from './components/AdminTurnsView';
import { AdminCatalogsTab } from './components/AdminCatalogsTab';
import { ToastContainer } from './components/ui/ToastContainer';
import {
  clearSessionDataCache,
  getCatalogs,
  getContratasMeta,
  getPublicUsers,
  getTodayIsoDate,
  getTurn,
  getTurnsRange,
  readCachedCatalogs,
  readCachedContratasMeta,
  updateTurnRow,
} from './services/gasClient';
import {
  collectAvailableGroups,
  parseUserGroups,
  type CatalogItem,
  type ContrataMeta,
  type EditableTurnField,
  type OperalogGroup,
  type ToastMessage,
  type TurnRow,
  type UserGroupScope,
  type UserSession,
} from './types/operalog';

const ChartsTab = lazy(() => import('./components/ChartsTab'));

const SESSION_KEY = 'operalog_user_session_v1';
export const MASTER_HISTORY_PASSWORD =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_MASTER_PASSWORD ?? '').trim();

export function shouldUnlockHistoryByDefault(session: UserSession | null): boolean {
  return Boolean(session && session.rol === 'ADMIN' && session.ver_historico === true);
}

export default function App() {
  const [user, setUser] = useState<UserSession | null>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as UserSession) : null;
    } catch {
      return null;
    }
  });
  const [isHistoryUnlocked, setIsHistoryUnlocked] = useState<boolean>(() =>
    shouldUnlockHistoryByDefault(user),
  );

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
  const [contratasMeta, setContratasMeta] = useState<ContrataMeta[]>([]);
  const [adminGroupFilter, setAdminGroupFilter] = useState<UserGroupScope>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as UserSession;
        const allowed = parseUserGroups(parsed.grupo, 'ALL');
        return allowed.length === 1 ? allowed[0] : 'ALL';
      }
    } catch {
      // Ignore
    }
    return 'ALL';
  });
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
  const skipNextBootstrapRefreshRef = useRef<boolean>(false);
  const userRef = useRef<UserSession | null>(user);
  userRef.current = user;

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
    const currentUser = userRef.current;
    if (!currentUser) return;

    const includeInactive = currentUser.rol === 'ADMIN';
    const cachedCats = readCachedCatalogs(includeInactive);
    const cachedMeta = readCachedContratasMeta();

    if (cachedCats) setCatalogs(cachedCats);
    if (cachedMeta && cachedMeta.length > 0) {
      setContratasMeta(cachedMeta);
      setContratas(cachedMeta.map((m) => m.nombre));
    }

    const shouldSkipNetwork =
      skipNextBootstrapRefreshRef.current && cachedCats !== null && cachedMeta !== null;
    skipNextBootstrapRefreshRef.current = false;
    if (shouldSkipNetwork) return;

    try {
      const [cats, meta, publicUsers] = await Promise.all([
        getCatalogs(includeInactive, undefined, { forceRefresh: true }),
        getContratasMeta({ forceRefresh: true }),
        getPublicUsers(),
      ]);
      setCatalogs(cats);
      if (meta.length > 0) {
        setContratasMeta(meta);
        setContratas(meta.map((m) => m.nombre));
      }

      if (publicUsers.length > 0) {
        const freshUser = publicUsers.find(
          (u) => u.usuario.trim().toLowerCase() === currentUser.usuario.trim().toLowerCase(),
        );
        if (!freshUser) {
          clearOperationsCache();
          clearSessionDataCache();
          try {
            sessionStorage.removeItem(SESSION_KEY);
          } catch {
            // Ignore
          }
          setUser(null);
          return;
        }

        const nextUser: UserSession = {
          ...currentUser,
          usuario: freshUser.usuario,
          rol: freshUser.rol,
          contratista: freshUser.contratista,
          nombre_mostrar: freshUser.nombre_mostrar,
          grupo: freshUser.grupo,
          ...(typeof freshUser.ver_historico === 'boolean'
            ? { ver_historico: freshUser.ver_historico }
            : {}),
        };

        const sessionChanged =
          nextUser.usuario !== currentUser.usuario ||
          nextUser.rol !== currentUser.rol ||
          nextUser.contratista !== currentUser.contratista ||
          nextUser.nombre_mostrar !== currentUser.nombre_mostrar ||
          nextUser.grupo !== currentUser.grupo ||
          nextUser.ver_historico !== currentUser.ver_historico;

        if (sessionChanged) {
          setUser(nextUser);
          try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
          } catch {
            // Ignore storage errors
          }

          if (nextUser.grupo !== currentUser.grupo || nextUser.rol !== currentUser.rol) {
            const nextAllowed = parseUserGroups(
              nextUser.grupo,
              nextUser.rol === 'ADMIN' ? 'ALL' : 'BT',
            );
            setAdminGroupFilter(nextAllowed.length === 1 ? nextAllowed[0] : 'ALL');
            setAdminSelectedContrata('ALL');
          }

          if (
            typeof freshUser.ver_historico === 'boolean' &&
            nextUser.ver_historico !== currentUser.ver_historico
          ) {
            setIsHistoryUnlocked(shouldUnlockHistoryByDefault(nextUser));
          }
        }
      }
    } catch {
      // Silencioso; cada tab maneja su feedback si falla y se conserva el caché hidratado
    }
  }, []);

  useEffect(() => {
    if (user?.usuario) {
      void loadBootstrapData();
    }
  }, [user?.usuario, user?.rol, loadBootstrapData]);

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
    const allowed = parseUserGroups(loggedUser.grupo, loggedUser.rol === 'ADMIN' ? 'ALL' : 'BT');
    skipNextBootstrapRefreshRef.current = true;
    setUser(loggedUser);
    setAdminGroupFilter(allowed.length === 1 ? allowed[0] : 'ALL');
    setAdminSelectedContrata('ALL');
    setIsHistoryUnlocked(shouldUnlockHistoryByDefault(loggedUser));
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
    skipNextBootstrapRefreshRef.current = false;
    setUser(null);
    setIsHistoryUnlocked(false);
    setCurrentRows([]);
    setCurrentFecha(today);
    setChartFechaInicio(today);
    setChartFechaFin(today);
    setAdminTurnsCache({});
    setAdminRangeCache({});
    setAdminSelectedContrata('ALL');
    setAdminGroupFilter('ALL');
    clearOperationsCache();
    clearSessionDataCache();
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

  const handleAdminUpdateCell = useCallback(
    async (row: TurnRow, changes: Partial<Record<EditableTurnField, string>>) => {
      if (!user || user.rol !== 'ADMIN') return;
      const result = await updateTurnRow({
        id: row.id,
        fecha: row.fecha,
        contratista: row.contratista,
        changes,
        usuario: user.usuario,
        rol: user.rol,
        userGrupo: user.grupo,
      });
      if (result.changedFields.length === 0) return;

      setAdminTurnsCache((prev) => {
        const currentList = prev[row.fecha] ?? [];
        return {
          ...prev,
          [row.fecha]: currentList.map((item) => (item.id === row.id ? result.row : item)),
        };
      });
      setAdminRangeCache({});

      addToast({
        type: 'success',
        title: 'Registro actualizado',
        description: `Se corrigió ${result.changedFields.join(', ')} en ${result.row.nombres || row.contratista}.`,
      });
    },
    [user, addToast],
  );

  const activeHorarios = useMemo(
    () =>
      catalogs
        .filter((c) => c.tipo === 'HORARIO' && c.activo)
        .sort((a, b) => a.orden - b.orden)
        .map((c) => c.valor),
    [catalogs],
  );

  const availableGroups = useMemo(
    () => collectAvailableGroups(contratasMeta, catalogs, user?.grupo),
    [contratasMeta, catalogs, user?.grupo],
  );

  const allowedAdminGroups = useMemo(
    () => parseUserGroups(user?.grupo, 'ALL', availableGroups),
    [user?.grupo, availableGroups],
  );

  const handleAdminGroupFilterChange = useCallback(
    (nextGroup: UserGroupScope) => {
      if (user) {
        if (nextGroup === 'ALL' && allowedAdminGroups.length === 1) return;
        if (nextGroup !== 'ALL' && !allowedAdminGroups.includes(nextGroup)) return;
      }
      setAdminGroupFilter(nextGroup);
      setAdminSelectedContrata('ALL');
    },
    [user, allowedAdminGroups],
  );

  const contrataGroupMap = useMemo(
    () => new Map<string, OperalogGroup>(contratasMeta.map((c) => [c.nombre, c.grupo])),
    [contratasMeta],
  );

  const scopedContratas = useMemo(() => {
    if (adminGroupFilter === 'ALL') {
      if (allowedAdminGroups.length === availableGroups.length) return contratas;
      return contratas.filter((c) =>
        allowedAdminGroups.includes(contrataGroupMap.get(c) ?? 'BT'),
      );
    }
    return contratas.filter((c) => (contrataGroupMap.get(c) ?? 'BT') === adminGroupFilter);
  }, [contratas, contrataGroupMap, adminGroupFilter, allowedAdminGroups, availableGroups]);

  const filterRowsByGroup = useCallback(
    (rows: TurnRow[]): TurnRow[] => {
      if (adminGroupFilter === 'ALL') {
        if (allowedAdminGroups.length === availableGroups.length) return rows;
        return rows.filter((r) =>
          allowedAdminGroups.includes(r.grupo || contrataGroupMap.get(r.contratista) || 'BT'),
        );
      }
      return rows.filter(
        (r) => (r.grupo || contrataGroupMap.get(r.contratista) || 'BT') === adminGroupFilter,
      );
    },
    [adminGroupFilter, contrataGroupMap, allowedAdminGroups, availableGroups],
  );

  const adminRowsForDate = useMemo(
    () => filterRowsByGroup(adminTurnsCache[currentFecha] ?? []),
    [filterRowsByGroup, adminTurnsCache, currentFecha],
  );
  const adminRangeRows = useMemo(
    () => filterRowsByGroup(adminRangeCache[`${chartFechaInicio}__${chartFechaFin}`] ?? []),
    [filterRowsByGroup, adminRangeCache, chartFechaInicio, chartFechaFin],
  );

  if (!user) {
    return (
      <>
        <LoginView onLoginSuccess={handleLoginSuccess} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

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
        adminGroupFilter={adminGroupFilter}
        onAdminGroupFilterChange={handleAdminGroupFilterChange}
        availableGroups={availableGroups}
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
              contratas={scopedContratas}
              rows={adminRowsForDate}
              loading={adminLoading}
              onRefresh={() => void fetchAdminTurns(currentFecha, true)}
              selectedContrata={adminSelectedContrata}
              onSelectedContrataChange={setAdminSelectedContrata}
              onToast={addToast}
              contrataGroupMap={contrataGroupMap}
              activeGroup={adminGroupFilter}
              canEditToday={currentFecha === getTodayIsoDate()}
              catalogs={catalogs}
              onUpdateCell={handleAdminUpdateCell}
            />
          ) : (
            <OperationsTab
              user={user}
              catalogs={catalogs}
              contratas={contratas}
              contratasMeta={contratasMeta}
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
              contratas={scopedContratas}
              contrataGroupMap={contrataGroupMap}
              activeGroup={adminGroupFilter}
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
            availableGroups={availableGroups}
            onCatalogSaved={(updated) => {
              setCatalogs(updated);
              addToast({
                type: 'success',
                title: 'Catálogos actualizados',
                description: 'Los desplegables de horarios, skills y actividades ya reflejan los cambios.',
              });
            }}
            user={user}
            activeGroup={adminGroupFilter}
          />
        )}
      </main>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
