import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  Users,
  HardHat,
  Headset,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { computeCapacityStats } from '../utils/capacityStats';
import {
  FRONT_CONFIGS,
  type CatalogItem,
  type FrontType,
  type TurnRow,
  type UserSession,
} from '../types/operalog';

export interface ChartsTabProps {
  rows: TurnRow[];
  horariosCatalog: string[] | CatalogItem[];
  user: UserSession;
  contratas?: string[];
  selectedContrata?: string;
  onSelectedContrataChange?: (contratista: string) => void;
  fecha?: string;
  onFechaChange?: (fecha: string) => void;
  onRefresh?: () => void;
  loading?: boolean;
  onDrillDownContrata?: (contratista: string) => void;
}

const FRONT_COLORS: Record<FrontType, string> = {
  COORDINADORES: '#3C5A9F',
  'SUPERVISORES CAPA': '#5573B8',
  LOCALIZADORES: '#64748B',
  DESPACHADORES: '#94A3B8',
  RECLAMOS: '#6CAB5E',
  TEKO: '#4F9442',
  REPARACIONES: '#88C07C',
};

const FRONT_SHORT_LABELS: Record<string, string> = {
  COORDINADORES: 'Coord.',
  'SUPERVISORES CAPA': 'Sup. CAPA',
  LOCALIZADORES: 'Localiz.',
  DESPACHADORES: 'Despach.',
  RECLAMOS: 'Reclamos',
  TEKO: 'Teko',
  REPARACIONES: 'Reparac.',
};

export default function ChartsTab({
  rows,
  horariosCatalog,
  user,
  contratas = [],
  selectedContrata = 'ALL',
  onSelectedContrataChange,
  fecha,
  onFechaChange,
  onRefresh,
  loading = false,
  onDrillDownContrata,
}: ChartsTabProps) {
  const horarioStrings = useMemo(
    () =>
      horariosCatalog
        .map((item) =>
          typeof item === 'string'
            ? item
            : item.tipo === 'HORARIO' && item.activo
            ? item.valor
            : ''
        )
        .filter((v) => v.trim().length > 0),
    [horariosCatalog]
  );

  const filteredRows = useMemo(() => {
    if (user.rol !== 'ADMIN' || selectedContrata === 'ALL') return rows;
    return rows.filter((r) => r.contratista === selectedContrata);
  }, [rows, user.rol, selectedContrata]);

  const stats = useMemo(
    () => computeCapacityStats(filteredRows, horarioStrings),
    [filteredRows, horarioStrings]
  );

  const allContrataStats = useMemo(
    () => computeCapacityStats(rows, horarioStrings),
    [rows, horarioStrings]
  );

  const contrataOptions = useMemo(() => {
    const set = new Set<string>(contratas);
    for (const r of rows) {
      if (r.contratista) set.add(r.contratista);
    }
    return Array.from(set).sort();
  }, [contratas, rows]);

  const incompleteCount = stats.missingHorarioCount + stats.missingSsamCount;
  const totalAlertCount = incompleteCount + stats.uncoveredHorarios.length;
  const alertColor = totalAlertCount > 0 ? '#E63946' : '#6CAB5E';

  const frontChartData = useMemo(
    () =>
      stats.byFront.map((item) => ({
        ...item,
        label: FRONT_SHORT_LABELS[item.frente] ?? item.frente,
      })),
    [stats.byFront]
  );

  return (
    <div className="space-y-6">
      {/* Admin Filter Bar */}
      {user.rol === 'ADMIN' && (
        <div
          className="rounded-xl border p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--pluz-surface)',
            borderColor: 'var(--pluz-border)',
          }}
        >
          <div className="flex flex-wrap items-center gap-3">
            {fecha && onFechaChange && (
              <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--pluz-muted)' }}>
                <Calendar className="w-4 h-4" style={{ color: 'var(--pluz-primary)' }} />
                <span>Fecha:</span>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => onFechaChange(e.target.value)}
                  className="px-2.5 py-1.5 text-sm rounded-lg border outline-none"
                  style={{
                    borderColor: 'var(--pluz-border)',
                    color: 'var(--pluz-ink)',
                    backgroundColor: 'var(--pluz-surface)',
                  }}
                />
              </label>
            )}

            {onSelectedContrataChange && (
              <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--pluz-muted)' }}>
                <Building2 className="w-4 h-4" style={{ color: 'var(--pluz-primary)' }} />
                <span>Contratista:</span>
                <select
                  value={selectedContrata}
                  onChange={(e) => onSelectedContrataChange(e.target.value)}
                  className="px-2.5 py-1.5 text-sm rounded-lg border outline-none"
                  style={{
                    borderColor: 'var(--pluz-border)',
                    color: 'var(--pluz-ink)',
                    backgroundColor: 'var(--pluz-surface)',
                  }}
                >
                  <option value="ALL">Todas las contratistas</option>
                  {contrataOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer disabled:opacity-60"
              style={{
                borderColor: 'var(--pluz-border)',
                color: 'var(--pluz-primary)',
                backgroundColor: 'var(--pluz-surface)',
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Actualizando...' : 'Actualizar'}</span>
            </button>
          )}
        </div>
      )}
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Personal Programado */}
        <div
          className="rounded-xl border p-4 shadow-2xs"
          style={{
            backgroundColor: 'var(--pluz-surface)',
            borderColor: 'var(--pluz-border)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--pluz-muted)' }}
            >
              Total Personal Programado
            </span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(60, 90, 159, 0.12)' }}
            >
              <Users className="w-4 h-4" style={{ color: '#3C5A9F' }} />
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: '#3C5A9F' }}>
            {stats.total}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--pluz-muted)' }}>
            Registros con nombre asignado
          </p>
        </div>

        {/* KPI 2: Personal en Campo */}
        <div
          className="rounded-xl border p-4 shadow-2xs"
          style={{
            backgroundColor: 'var(--pluz-surface)',
            borderColor: 'var(--pluz-border)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--pluz-muted)' }}
            >
              Personal en Campo
            </span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(108, 171, 94, 0.14)' }}
            >
              <HardHat className="w-4 h-4" style={{ color: '#6CAB5E' }} />
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: '#6CAB5E' }}>
            {stats.campoCount}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--pluz-muted)' }}>
            Reclamos / Teko / Reparaciones
          </p>
        </div>

        {/* KPI 3: Personal de Soporte */}
        <div
          className="rounded-xl border p-4 shadow-2xs"
          style={{
            backgroundColor: 'var(--pluz-surface)',
            borderColor: 'var(--pluz-border)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--pluz-muted)' }}
            >
              Personal de Soporte
            </span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(100, 116, 139, 0.14)' }}
            >
              <Headset className="w-4 h-4" style={{ color: '#64748B' }} />
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: '#64748B' }}>
            {stats.soporteCount}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--pluz-muted)' }}>
            Coord / Sup / Loc / Desp
          </p>
        </div>

        {/* KPI 4: Alertas / Sin Horario o SSAM */}
        <div
          className="rounded-xl border p-4 shadow-2xs"
          style={{
            backgroundColor: 'var(--pluz-surface)',
            borderColor:
              totalAlertCount > 0 ? 'rgba(230, 57, 70, 0.35)' : 'var(--pluz-border)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--pluz-muted)' }}
            >
              Alertas / Sin Horario o SSAM
            </span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor:
                  totalAlertCount > 0
                    ? 'rgba(230, 57, 70, 0.12)'
                    : 'rgba(108, 171, 94, 0.14)',
              }}
            >
              {totalAlertCount > 0 ? (
                <AlertTriangle className="w-4 h-4" style={{ color: alertColor }} />
              ) : (
                <CheckCircle2 className="w-4 h-4" style={{ color: alertColor }} />
              )}
            </div>
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: alertColor }}>
            {incompleteCount}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--pluz-muted)' }}>
            {stats.uncoveredHorarios.length} horario(s) sin cobertura
          </p>
        </div>
      </div>

      {/* Charts Grid: Chart 1 & Chart 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Capacidad por Frente */}
        <div
          className="rounded-xl border p-5 shadow-2xs"
          style={{
            backgroundColor: 'var(--pluz-surface)',
            borderColor: 'var(--pluz-border)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--pluz-ink)' }}>
                Capacidad por Frente
              </h3>
              <p className="text-xs" style={{ color: 'var(--pluz-muted)' }}>
                Verde: Campo • Azul: Soporte operativo
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={frontChartData}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 16, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={84}
                  tick={{ fontSize: 11, fill: '#0F172A', fontWeight: 600 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(60, 90, 159, 0.06)' }}
                  contentStyle={{
                    borderRadius: '10px',
                    borderColor: '#E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" name="Personal" radius={[0, 6, 6, 0]} barSize={22}>
                  {frontChartData.map((entry) => (
                    <Cell
                      key={entry.frente}
                      fill={entry.isField ? '#6CAB5E' : '#3C5A9F'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Cobertura por Horario */}
        <div
          className="rounded-xl border p-5 shadow-2xs"
          style={{
            backgroundColor: 'var(--pluz-surface)',
            borderColor: 'var(--pluz-border)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--pluz-ink)' }}>
                Cobertura por Horario
              </h3>
              <p className="text-xs" style={{ color: 'var(--pluz-muted)' }}>
                Distribución apilada por frente y detección de turnos descubiertos
              </p>
            </div>
            <Clock className="w-4 h-4" style={{ color: 'var(--pluz-muted)' }} />
          </div>

          <div className="h-72 w-full">
            {stats.byHorario.length === 0 ? (
              <div
                className="h-full flex items-center justify-center text-sm"
                style={{ color: 'var(--pluz-muted)' }}
              >
                No hay horarios configurados en el catálogo.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.byHorario}
                  margin={{ top: 4, right: 12, left: 0, bottom: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="horario"
                    tick={{ fontSize: 10, fill: '#0F172A' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={46}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      borderColor: '#E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  {FRONT_CONFIGS.map((cfg) => (
                    <Bar
                      key={cfg.id}
                      dataKey={cfg.id}
                      name={FRONT_SHORT_LABELS[cfg.id] ?? cfg.label}
                      stackId="front"
                      fill={FRONT_COLORS[cfg.id]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Chart 3 (ADMIN only): Comparativa por Contratista */}
      {user.rol === 'ADMIN' && (
        <div
          className="rounded-xl border p-5 shadow-2xs"
          style={{
            backgroundColor: 'var(--pluz-surface)',
            borderColor: 'var(--pluz-border)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--pluz-ink)' }}>
                Comparativa por Contratista
              </h3>
              <p className="text-xs" style={{ color: 'var(--pluz-muted)' }}>
                Personal en campo vs. soporte operativo por contratista (haz clic en una barra para ver el detalle)
              </p>
            </div>
            <Building2 className="w-4 h-4" style={{ color: 'var(--pluz-primary)' }} />
          </div>

          <div className="h-72 w-full">
            {allContrataStats.byContrata.length === 0 ? (
              <div
                className="h-full flex items-center justify-center text-sm"
                style={{ color: 'var(--pluz-muted)' }}
              >
                No hay registros de contratistas para comparar.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={allContrataStats.byContrata}
                  margin={{ top: 4, right: 20, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="contratista"
                    tick={{ fontSize: 12, fill: '#0F172A', fontWeight: 600 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      borderColor: '#E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="campo"
                    name="Campo"
                    fill="#6CAB5E"
                    radius={[6, 6, 0, 0]}
                    barSize={32}
                    cursor="pointer"
                    onClick={(data) => {
                      const c = (data as unknown as { contratista?: string })?.contratista;
                      if (c) onDrillDownContrata?.(c);
                    }}
                  />
                  <Bar
                    dataKey="soporte"
                    name="Soporte"
                    fill="#3C5A9F"
                    radius={[6, 6, 0, 0]}
                    barSize={32}
                    cursor="pointer"
                    onClick={(data) => {
                      const c = (data as unknown as { contratista?: string })?.contratista;
                      if (c) onDrillDownContrata?.(c);
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Alertas Panel */}
      <div
        className="rounded-xl border p-5 shadow-2xs"
        style={{
          backgroundColor: 'var(--pluz-surface)',
          borderColor:
            totalAlertCount > 0 ? 'rgba(230, 57, 70, 0.3)' : 'var(--pluz-border)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          {totalAlertCount > 0 ? (
            <AlertTriangle className="w-4 h-4" style={{ color: 'var(--pluz-danger)' }} />
          ) : (
            <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--pluz-success)' }} />
          )}
          <h3 className="text-sm font-bold" style={{ color: 'var(--pluz-ink)' }}>
            Panel de Alertas Operativas
          </h3>
        </div>

        {totalAlertCount === 0 ? (
          <p className="text-xs font-medium" style={{ color: 'var(--pluz-success)' }}>
            Sin alertas activas: todos los horarios tienen cobertura y no hay filas incompletas.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Uncovered Horarios */}
            <div
              className="rounded-lg border p-3.5"
              style={{
                backgroundColor: 'var(--pluz-bg)',
                borderColor: 'var(--pluz-border)',
              }}
            >
              <p
                className="text-xs font-bold uppercase tracking-wider mb-2"
                style={{ color: 'var(--pluz-muted)' }}
              >
                Horarios sin Cobertura ({stats.uncoveredHorarios.length})
              </p>
              {stats.uncoveredHorarios.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--pluz-success)' }}>
                  Todos los horarios del catálogo cuentan con personal.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {stats.uncoveredHorarios.map((h) => (
                    <span
                      key={h}
                      className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md border"
                      style={{
                        backgroundColor: 'rgba(230, 57, 70, 0.08)',
                        borderColor: 'rgba(230, 57, 70, 0.25)',
                        color: 'var(--pluz-danger)',
                      }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Incomplete Rows */}
            <div
              className="rounded-lg border p-3.5"
              style={{
                backgroundColor: 'var(--pluz-bg)',
                borderColor: 'var(--pluz-border)',
              }}
            >
              <p
                className="text-xs font-bold uppercase tracking-wider mb-2"
                style={{ color: 'var(--pluz-muted)' }}
              >
                Filas Incompletas ({incompleteCount})
              </p>
              <ul className="space-y-1.5 text-xs" style={{ color: 'var(--pluz-ink)' }}>
                <li className="flex items-center justify-between">
                  <span>Sin horario asignado</span>
                  <span
                    className="font-bold tabular-nums px-2 py-0.5 rounded"
                    style={{
                      backgroundColor:
                        stats.missingHorarioCount > 0
                          ? 'rgba(230, 57, 70, 0.1)'
                          : 'rgba(108, 171, 94, 0.12)',
                      color:
                        stats.missingHorarioCount > 0
                          ? 'var(--pluz-danger)'
                          : 'var(--pluz-success)',
                    }}
                  >
                    {stats.missingHorarioCount}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Frentes de campo sin usuario SSAM</span>
                  <span
                    className="font-bold tabular-nums px-2 py-0.5 rounded"
                    style={{
                      backgroundColor:
                        stats.missingSsamCount > 0
                          ? 'rgba(230, 57, 70, 0.1)'
                          : 'rgba(108, 171, 94, 0.12)',
                      color:
                        stats.missingSsamCount > 0
                          ? 'var(--pluz-danger)'
                          : 'var(--pluz-success)',
                    }}
                  >
                    {stats.missingSsamCount}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
