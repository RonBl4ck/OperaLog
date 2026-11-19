import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  LabelList,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  HardHat,
  Wrench,
  LifeBuoy,
  Truck,
  ShieldAlert,
  Building2,
  Calendar,
  RefreshCw,
  Filter,
  Image as ImageIcon,
  FileSpreadsheet,
  Check,
} from 'lucide-react';
import {
  FIELD_CATEGORIES,
  computeFieldDashboardStats,
  type FieldCategoryId,
} from '../utils/capacityStats';
import { copyMatrixAsImage, copyMatrixForExcel } from '../utils/matrixExport';
import type {
  CatalogItem,
  OperalogGroup,
  TurnRow,
  UserGroupScope,
  UserSession,
} from '../types/operalog';

export interface ChartsTabProps {
  rows: TurnRow[];
  horariosCatalog?: string[] | CatalogItem[];
  user: UserSession;
  contratas?: string[];
  selectedContrata?: string;
  onSelectedContrataChange?: (contratista: string) => void;
  fecha?: string;
  onFechaChange?: (fecha: string) => void;
  fechaInicio?: string;
  fechaFin?: string;
  onFechaRangeChange?: (inicio: string, fin: string) => void;
  onRefresh?: () => void;
  loading?: boolean;
  onDrillDownContrata?: (contratista: string) => void;
  allowDateChange?: boolean;
  contrataGroupMap?: Map<string, OperalogGroup>;
  activeGroup?: UserGroupScope;
}

const COMPANY_COLORS = [
  '#0070F3',
  '#1E3A8A',
  '#E67E22',
  '#6B21A8',
  '#EC4899',
  '#10B981',
  '#0EA5E9',
  '#F59E0B',
];

const CATEGORY_ICONS: Record<FieldCategoryId, typeof HardHat> = {
  RECLAMISTA: HardHat,
  RECLAMISTA_APOYO: LifeBuoy,
  REPARACIONES: Wrench,
  REPARACIONES_APOYO: ShieldAlert,
  TEKO: Truck,
};

export default function ChartsTab({
  rows,
  user,
  contratas = [],
  fechaInicio,
  fechaFin,
  onFechaRangeChange,
  onRefresh,
  loading = false,
  allowDateChange = true,
  activeGroup = 'ALL',
}: ChartsTabProps) {
  const [selectedContratas, setSelectedContratas] = useState<string[]>([]);

  useEffect(() => {
    setSelectedContratas([]);
  }, [activeGroup]);
  const [selectedCategories, setSelectedCategories] = useState<FieldCategoryId[]>([]);
  const [matrixCopyFeedback, setMatrixCopyFeedback] = useState<
    'image-copied' | 'image-downloaded' | 'excel-copied' | 'error' | null
  >(null);
  const [copyingMatrix, setCopyingMatrix] = useState(false);

  const contrataOptions = useMemo(() => {
    const set = new Set<string>(contratas.filter((c) => c.trim().length > 0));
    for (const r of rows) {
      if (r.contratista.trim()) set.add(r.contratista.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [contratas, rows]);

  const stats = useMemo(
    () =>
      computeFieldDashboardStats(rows, {
        selectedContratas,
        selectedCategories,
        allContratas: selectedContratas.length > 0 ? selectedContratas : contrataOptions,
      }),
    [rows, selectedContratas, selectedCategories, contrataOptions],
  );

  const toggleContrata = (c: string) => {
    setSelectedContratas((prev) =>
      prev.includes(c) ? prev.filter((item) => item !== c) : [...prev, c],
    );
  };

  const toggleCategory = (catId: FieldCategoryId) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((item) => item !== catId) : [...prev, catId],
    );
  };

  const barChartMinWidth =
    stats.byDate.length > 10 ? `${stats.byDate.length * 48}px` : '100%';

  const showMatrixFeedback = (
    status: 'image-copied' | 'image-downloaded' | 'excel-copied' | 'error',
  ) => {
    setMatrixCopyFeedback(status);
    window.setTimeout(() => {
      setMatrixCopyFeedback((current) => (current === status ? null : current));
    }, 2200);
  };

  const handleCopyMatrixImage = async () => {
    if (copyingMatrix) return;
    setCopyingMatrix(true);
    try {
      const outcome = await copyMatrixAsImage({
        contratas: stats.contratas,
        matrixRows: stats.matrixRows,
        matrixTotalsByContrata: stats.matrixTotalsByContrata,
        totalField: stats.totalField,
      });
      showMatrixFeedback(outcome === 'copied' ? 'image-copied' : 'image-downloaded');
    } catch {
      showMatrixFeedback('error');
    } finally {
      setCopyingMatrix(false);
    }
  };

  const handleCopyMatrixExcel = async () => {
    if (copyingMatrix) return;
    setCopyingMatrix(true);
    try {
      await copyMatrixForExcel({
        contratas: stats.contratas,
        matrixRows: stats.matrixRows,
        matrixTotalsByContrata: stats.matrixTotalsByContrata,
        totalField: stats.totalField,
      });
      showMatrixFeedback('excel-copied');
    } catch {
      showMatrixFeedback('error');
    } finally {
      setCopyingMatrix(false);
    }
  };

  const matrixCard = (
    <div
      className="rounded-xl border overflow-hidden shadow-2xs h-full"
      style={{
        backgroundColor: 'var(--pluz-surface)',
        borderColor: 'var(--pluz-border)',
      }}
    >
      <div
        className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2"
        style={{ backgroundColor: '#3C5A9F' }}
      >
        <h3 className="text-sm font-bold text-white">
          Matriz Especialidad vs. Contratista
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyMatrixImage}
            disabled={copyingMatrix}
            aria-label="Copiar matriz como imagen"
            title="Copiar matriz como imagen PNG al portapapeles"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-colors cursor-pointer disabled:opacity-50"
          >
            {matrixCopyFeedback === 'image-copied' ||
            matrixCopyFeedback === 'image-downloaded' ? (
              <Check className="w-3.5 h-3.5 text-emerald-200" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5" />
            )}
            <span>
              {matrixCopyFeedback === 'image-copied'
                ? 'Imagen copiada'
                : matrixCopyFeedback === 'image-downloaded'
                  ? 'PNG descargado'
                  : 'Copiar imagen'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleCopyMatrixExcel}
            disabled={copyingMatrix}
            aria-label="Copiar matriz para Excel"
            title="Copiar tabla con formato para pegar en Excel"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-colors cursor-pointer disabled:opacity-50"
          >
            {matrixCopyFeedback === 'excel-copied' ? (
              <Check className="w-3.5 h-3.5 text-emerald-200" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5" />
            )}
            <span>
              {matrixCopyFeedback === 'excel-copied' ? 'Copiado' : 'Copiar Excel'}
            </span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr style={{ backgroundColor: '#EEF2FF', color: '#1E3A8A' }}>
              <th className="py-2.5 px-3 font-bold border-b border-slate-200">
                Especialidad
              </th>
              {stats.contratas.map((c) => (
                <th
                  key={c}
                  className="py-2.5 px-2.5 font-bold text-right border-b border-slate-200 whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
              <th className="py-2.5 px-3 font-bold text-right border-b border-slate-200">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.matrixRows.map((mRow, idx) => (
              <tr
                key={mRow.category}
                className="transition-colors hover:bg-slate-50"
                style={{
                  backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                }}
              >
                <td
                  className="py-2 px-3 font-semibold border-b border-slate-100 whitespace-nowrap"
                  style={{ color: 'var(--pluz-ink)' }}
                >
                  {mRow.label}
                </td>
                {stats.contratas.map((c) => {
                  const val = mRow.countsByContrata[c] ?? 0;
                  return (
                    <td
                      key={c}
                      className="py-2 px-2.5 text-right tabular-nums border-b border-slate-100"
                      style={{
                        color: val > 0 ? 'var(--pluz-ink)' : '#94A3B8',
                      }}
                    >
                      {val}
                    </td>
                  );
                })}
                <td
                  className="py-2 px-3 text-right font-bold tabular-nums border-b border-slate-100"
                  style={{ color: '#3C5A9F' }}
                >
                  {mRow.total}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#F1F5F9' }}>
              <td
                className="py-2.5 px-3 font-bold border-t border-slate-300"
                style={{ color: 'var(--pluz-ink)' }}
              >
                Total
              </td>
              {stats.contratas.map((c) => (
                <td
                  key={c}
                  className="py-2.5 px-2.5 text-right font-bold tabular-nums border-t border-slate-300"
                  style={{ color: 'var(--pluz-ink)' }}
                >
                  {stats.matrixTotalsByContrata[c] ?? 0}
                </td>
              ))}
              <td
                className="py-2.5 px-3 text-right font-bold tabular-nums border-t border-slate-300"
                style={{ color: '#3C5A9F' }}
              >
                {stats.totalField}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  const companyShareCard = (
    <div
      className="rounded-xl border overflow-hidden shadow-2xs h-full"
      style={{
        backgroundColor: 'var(--pluz-surface)',
        borderColor: 'var(--pluz-border)',
      }}
    >
      <div className="px-4 py-3" style={{ backgroundColor: '#3C5A9F' }}>
        <h3 className="text-sm font-bold text-white">
          Participación de Recursos por Empresa
        </h3>
      </div>

      <div className="p-4">
        {stats.companyShare.length === 0 ? (
          <div
            className="h-56 flex items-center justify-center text-sm"
            style={{ color: 'var(--pluz-muted)' }}
          >
            Sin datos de participación para mostrar.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="h-56 w-full sm:w-3/5">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.companyShare}
                    dataKey="count"
                    nameKey="contratista"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={2}
                  >
                    {stats.companyShare.map((entry, idx) => (
                      <Cell
                        key={entry.contratista}
                        fill={COMPANY_COLORS[idx % COMPANY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      borderColor: '#E2E8F0',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => [
                      `${value} cuadrillas`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <ul className="w-full sm:w-2/5 space-y-2 text-xs">
              {stats.companyShare.map((entry, idx) => (
                <li
                  key={entry.contratista}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: COMPANY_COLORS[idx % COMPANY_COLORS.length],
                      }}
                    />
                    <span
                      className="font-semibold truncate"
                      style={{ color: 'var(--pluz-ink)' }}
                    >
                      {entry.contratista}
                    </span>
                  </span>
                  <span
                    className="font-bold tabular-nums shrink-0"
                    style={{ color: 'var(--pluz-muted)' }}
                  >
                    {entry.percentage}% ({entry.count})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );

  const specialtyByCompanyCard = (
    <div
      className="rounded-xl border overflow-hidden shadow-2xs"
      style={{
        backgroundColor: 'var(--pluz-surface)',
        borderColor: 'var(--pluz-border)',
      }}
    >
      <div className="px-4 py-3" style={{ backgroundColor: '#3C5A9F' }}>
        <h3 className="text-sm font-bold text-white">
          Total Cuadrillas por Especialidad y Empresa
        </h3>
        <p className="text-[11px] text-blue-100">
          Comparativa horizontal agrupada por contratista
        </p>
      </div>

      <div className="p-4">
        {stats.contratas.length === 0 || stats.totalField === 0 ? (
          <div
            className="h-72 flex items-center justify-center text-sm"
            style={{ color: 'var(--pluz-muted)' }}
          >
            Sin datos de especialidades por empresa para mostrar.
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.byCategoryCompany}
                layout="vertical"
                margin={{ top: 8, right: 28, left: 16, bottom: 8 }}
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
                  width={136}
                  tick={{ fontSize: 11, fill: '#0F172A', fontWeight: 600 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '10px',
                    borderColor: '#E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {stats.contratas.map((c, idx) => (
                  <Bar
                    key={c}
                    dataKey={c}
                    name={c}
                    fill={COMPANY_COLORS[idx % COMPANY_COLORS.length]}
                    radius={[0, 4, 4, 0]}
                    barSize={12}
                  >
                    <LabelList
                      dataKey={c}
                      position="right"
                      style={{ fontSize: '10px', fontWeight: 600, fill: '#334155' }}
                      formatter={(v: number) => (v > 0 ? v : '')}
                    />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );

  const refreshButton = onRefresh ? (
    <button
      type="button"
      onClick={onRefresh}
      disabled={loading}
      className="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer disabled:opacity-60 shrink-0"
      style={{
        borderColor: 'var(--pluz-border)',
        color: 'var(--pluz-primary)',
        backgroundColor: 'var(--pluz-surface)',
      }}
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      <span>{loading ? 'Actualizando...' : 'Actualizar'}</span>
    </button>
  ) : null;

  return (
    <div className="space-y-6">
      {/* Admin Filter Bar */}
      {user.rol === 'ADMIN' && (
        <div
          className="rounded-xl border p-4 shadow-2xs space-y-3.5"
          style={{
            backgroundColor: 'var(--pluz-surface)',
            borderColor: 'var(--pluz-border)',
          }}
        >
          {/* Row 1: Rango de Fechas & Actualizar (solo visible cuando está desbloqueado) */}
          {allowDateChange && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {fechaInicio && fechaFin && onFechaRangeChange && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--pluz-muted)' }}
                    >
                      <Calendar className="w-4 h-4" style={{ color: 'var(--pluz-primary)' }} />
                      Rango de Fechas:
                    </span>
                    <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--pluz-muted)' }}>
                      <span>Desde</span>
                      <input
                        type="date"
                        aria-label="Fecha inicio"
                        value={fechaInicio}
                        onChange={(e) => {
                          const nextInicio = e.target.value;
                          if (!nextInicio) return;
                          onFechaRangeChange(
                            nextInicio,
                            nextInicio > fechaFin ? nextInicio : fechaFin,
                          );
                        }}
                        className="px-2.5 py-1.5 text-sm rounded-lg border outline-none"
                        style={{
                          borderColor: 'var(--pluz-border)',
                          color: 'var(--pluz-ink)',
                          backgroundColor: 'var(--pluz-surface)',
                        }}
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--pluz-muted)' }}>
                      <span>Hasta</span>
                      <input
                        type="date"
                        aria-label="Fecha fin"
                        value={fechaFin}
                        onChange={(e) => {
                          const nextFin = e.target.value;
                          if (!nextFin) return;
                          onFechaRangeChange(
                            nextFin < fechaInicio ? nextFin : fechaInicio,
                            nextFin,
                          );
                        }}
                        className="px-2.5 py-1.5 text-sm rounded-lg border outline-none"
                        style={{
                          borderColor: 'var(--pluz-border)',
                          color: 'var(--pluz-ink)',
                          backgroundColor: 'var(--pluz-surface)',
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              {refreshButton}
            </div>
          )}

          {/* Row 2: Contratistas Chips */}
          {contrataOptions.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mr-1"
                  style={{ color: 'var(--pluz-muted)' }}
                >
                  <Building2 className="w-3.5 h-3.5" style={{ color: 'var(--pluz-primary)' }} />
                  Contratistas{activeGroup !== 'ALL' ? ` (${activeGroup})` : ''}:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedContratas([])}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer"
                  style={{
                    backgroundColor:
                      selectedContratas.length === 0 ? 'var(--pluz-primary)' : 'var(--pluz-bg)',
                    color: selectedContratas.length === 0 ? '#FFFFFF' : 'var(--pluz-ink)',
                    borderColor:
                      selectedContratas.length === 0 ? 'var(--pluz-primary)' : 'var(--pluz-border)',
                  }}
                >
                  Todas
                </button>
                {contrataOptions.map((c) => {
                  const active = selectedContratas.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleContrata(c)}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer"
                      style={{
                        backgroundColor: active ? 'var(--pluz-primary)' : 'var(--pluz-surface)',
                        color: active ? '#FFFFFF' : 'var(--pluz-ink)',
                        borderColor: active ? 'var(--pluz-primary)' : 'var(--pluz-border)',
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              {!allowDateChange && refreshButton}
            </div>
          ) : (
            !allowDateChange && refreshButton && (
              <div className="flex justify-end">{refreshButton}</div>
            )
          )}

          {/* Row 3: Especialidades de Campo Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mr-1"
              style={{ color: 'var(--pluz-muted)' }}
            >
              <Filter className="w-3.5 h-3.5" style={{ color: 'var(--pluz-primary)' }} />
              Especialidad:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategories([])}
              className="px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer"
              style={{
                backgroundColor:
                  selectedCategories.length === 0 ? '#1E293B' : 'var(--pluz-bg)',
                color: selectedCategories.length === 0 ? '#FFFFFF' : 'var(--pluz-ink)',
                borderColor:
                  selectedCategories.length === 0 ? '#1E293B' : 'var(--pluz-border)',
              }}
            >
              Todas
            </button>
            {FIELD_CATEGORIES.map((cat) => {
              const active = selectedCategories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer"
                  style={{
                    backgroundColor: active ? cat.color : 'var(--pluz-surface)',
                    color: active ? '#FFFFFF' : 'var(--pluz-ink)',
                    borderColor: active ? cat.color : 'var(--pluz-border)',
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 5 KPI Cards (Solo Campo) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {FIELD_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id];
          const count = stats.countsByCategory[cat.id];
          return (
            <div
              key={cat.id}
              className="rounded-xl border p-4 shadow-2xs"
              style={{
                backgroundColor: 'var(--pluz-surface)',
                borderColor: 'var(--pluz-border)',
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className="text-[11px] font-bold uppercase tracking-wider leading-tight"
                  style={{ color: 'var(--pluz-muted)' }}
                >
                  {cat.label}
                </span>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${cat.color}1F` }}
                >
                  <Icon className="w-4 h-4" style={{ color: cat.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums" style={{ color: cat.color }}>
                {count}
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--pluz-muted)' }}>
                Cuadrillas de campo
              </p>
            </div>
          );
        })}
      </div>

      {allowDateChange ? (
        <>
          {/* Main 3 Blocks Grid (Cuadros Rojos) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Bloque 1: Total Cuadrillas por Fecha (Izquierda, 7 cols) */}
            <div
              className="lg:col-span-7 rounded-xl border overflow-hidden shadow-2xs"
              style={{
                backgroundColor: 'var(--pluz-surface)',
                borderColor: 'var(--pluz-border)',
              }}
            >
              <div
                className="px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                style={{ backgroundColor: '#3C5A9F' }}
              >
                <div>
                  <h3 className="text-sm font-bold text-white">Total Cuadrillas por Fecha</h3>
                  <p className="text-[11px] text-blue-100">
                    Solo personal de campo • Línea punteada roja: Promedio diario ({stats.dailyAverage})
                  </p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/15 text-white tabular-nums">
                  Total: {stats.totalField}
                </span>
              </div>

              <div className="p-4">
                {stats.byDate.length === 0 ? (
                  <div
                    className="h-80 flex items-center justify-center text-sm"
                    style={{ color: 'var(--pluz-muted)' }}
                  >
                    No hay cuadrillas de campo registradas en el rango seleccionado.
                  </div>
                ) : (
                  <div className="overflow-x-auto pb-2">
                    <div style={{ width: barChartMinWidth, height: '340px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={stats.byDate}
                          margin={{ top: 24, right: 20, left: 0, bottom: 12 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: '#0F172A', fontWeight: 600 }}
                            interval={0}
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
                            formatter={(value: number) => [`${value} cuadrillas`, 'Total Campo']}
                            labelFormatter={(label) => `Fecha: ${label}`}
                          />
                          {stats.dailyAverage > 0 && (
                            <ReferenceLine
                              y={stats.dailyAverage}
                              stroke="#E63946"
                              strokeDasharray="5 5"
                              strokeWidth={2}
                              label={{
                                value: `Prom: ${stats.dailyAverage}`,
                                position: 'insideTopLeft',
                                fill: '#E63946',
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            />
                          )}
                          <Bar
                            dataKey="total"
                            name="Total Cuadrillas"
                            fill="#0088FF"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={48}
                          >
                            <LabelList
                              dataKey="total"
                              position="top"
                              style={{ fontSize: '11px', fontWeight: 700, fill: '#0F172A' }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Derecha (5 cols): Matriz + Donut */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {matrixCard}
              {companyShareCard}
            </div>
          </div>

          {/* Secondary Analytics Row: Especialidad x Empresa + Promedio por Día de la Semana */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7">{specialtyByCompanyCard}</div>

            {/* Bloque 5: Capacidad Promedio por Día de la Semana (Lun - Dom) */}
            <div
              className="lg:col-span-5 rounded-xl border overflow-hidden shadow-2xs"
              style={{
                backgroundColor: 'var(--pluz-surface)',
                borderColor: 'var(--pluz-border)',
              }}
            >
              <div className="px-4 py-3" style={{ backgroundColor: '#3C5A9F' }}>
                <h3 className="text-sm font-bold text-white">
                  Capacidad Promedio por Día de la Semana
                </h3>
                <p className="text-[11px] text-blue-100">
                  Azul: Lunes–Viernes • Ámbar: Sábado y Domingo
                </p>
              </div>

              <div className="p-4">
                {stats.totalField === 0 ? (
                  <div
                    className="h-72 flex items-center justify-center text-sm"
                    style={{ color: 'var(--pluz-muted)' }}
                  >
                    Sin datos para calcular promedios semanales.
                  </div>
                ) : (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={stats.byWeekday}
                        margin={{ top: 24, right: 12, left: 0, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: '#0F172A', fontWeight: 600 }}
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
                          formatter={(value: number, _name, item) => {
                            const days = (item?.payload as { daysCount?: number })?.daysCount ?? 0;
                            return [`${value} cuadrillas/día (${days} día${days === 1 ? '' : 's'})`, 'Promedio'];
                          }}
                        />
                        <Bar
                          dataKey="average"
                          name="Promedio Diario"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={36}
                        >
                          {stats.byWeekday.map((entry) => (
                            <Cell
                              key={entry.label}
                              fill={entry.weekdayIndex >= 5 ? '#F59E0B' : '#0088FF'}
                            />
                          ))}
                          <LabelList
                            dataKey="average"
                            position="top"
                            style={{ fontSize: '11px', fontWeight: 700, fill: '#0F172A' }}
                            formatter={(v: number) => (v > 0 ? v : '')}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Vista Compacta Solo Hoy (sin gráficos históricos ni espacios vacíos) */
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7">{matrixCard}</div>
            <div className="lg:col-span-5">{companyShareCard}</div>
          </div>
          {specialtyByCompanyCard}
        </>
      )}
    </div>
  );
}
