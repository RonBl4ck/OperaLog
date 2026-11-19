import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileSpreadsheet,
  Filter,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import {
  FRONT_CONFIGS,
  getActiveFrontConfigs,
  matchesGroupCatalog,
  type CatalogItem,
  type EditableTurnField,
  type FrontType,
  type OperalogGroup,
  type ToastMessage,
  type TurnRow,
  type UserGroupScope,
} from '../types/operalog';
import { downloadAdminTurnsExcel } from '../utils/excelTemplate';

interface AdminTurnsViewProps {
  fecha: string;
  onFechaChange: (fecha: string) => void;
  contratas: string[];
  rows: TurnRow[];
  loading: boolean;
  onRefresh: () => void;
  selectedContrata: string;
  onSelectedContrataChange: (contratista: string) => void;
  onToast: (toast: Omit<ToastMessage, 'id'>) => void;
  allowDateChange?: boolean;
  contrataGroupMap?: Map<string, OperalogGroup>;
  activeGroup?: UserGroupScope;
  canEditToday?: boolean;
  catalogs?: CatalogItem[];
  onUpdateCell?: (
    row: TurnRow,
    changes: Partial<Record<EditableTurnField, string>>,
  ) => Promise<void>;
}

type SortColumn =
  | 'contratista'
  | 'grupo'
  | 'frente'
  | 'nombres'
  | 'usuario_ssam'
  | 'celular'
  | 'actividad'
  | 'skill'
  | 'horario';

type SortDirection = 'asc' | 'desc';

const TABLE_COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'contratista', label: 'Contratista' },
  { key: 'grupo', label: 'Grupo' },
  { key: 'frente', label: 'Frente' },
  { key: 'nombres', label: 'Nombres' },
  { key: 'usuario_ssam', label: 'Usuario SSAM' },
  { key: 'celular', label: 'Celular' },
  { key: 'actividad', label: 'Actividad' },
  { key: 'skill', label: 'Skill' },
  { key: 'horario', label: 'Horario' },
];

const GROUP_BADGE_STYLES: Record<OperalogGroup, { bg: string; color: string }> = {
  BT: { bg: 'rgba(60, 90, 159, 0.1)', color: '#3C5A9F' },
  AP: { bg: 'rgba(245, 158, 11, 0.15)', color: '#B45309' },
  MT: { bg: 'rgba(124, 58, 237, 0.12)', color: '#6D28D9' },
};

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  label: string;
  allLabel: string;
  icon: React.ReactNode;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (nextValues: string[]) => void;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  allLabel,
  icon,
  options,
  selectedValues,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const toggleValue = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const summaryText = useMemo(() => {
    if (selectedValues.length === 0) return allLabel;
    if (selectedValues.length === 1) {
      return options.find((o) => o.value === selectedValues[0])?.label ?? selectedValues[0];
    }
    return `${selectedValues.length} seleccionadas`;
  }, [selectedValues, options, allLabel]);

  return (
    <div ref={containerRef} className="relative flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--pluz-muted)' }}>
      {icon}
      <span>{label}:</span>
      <button
        type="button"
        aria-label={`Filtrar por ${label}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center justify-between gap-2 min-w-[175px] max-w-[230px] px-2.5 py-1.5 text-sm rounded-lg border outline-none cursor-pointer"
        style={{
          borderColor: selectedValues.length > 0 ? 'var(--pluz-primary)' : 'var(--pluz-border)',
          color: 'var(--pluz-ink)',
          backgroundColor: 'var(--pluz-surface)',
        }}
      >
        <span className="truncate font-normal">{summaryText}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={`Opciones de ${label}`}
          className="absolute left-0 top-full mt-1.5 z-30 w-64 rounded-xl border bg-white shadow-lg py-1.5"
          style={{ borderColor: 'var(--pluz-border)' }}
        >
          <div
            className="flex items-center justify-between px-3 py-1.5 border-b text-[11px] font-semibold"
            style={{ borderColor: 'var(--pluz-border)' }}
          >
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[#3C5A9F] hover:underline cursor-pointer"
            >
              {allLabel}
            </button>
            {selectedValues.length > 0 && (
              <span className="text-slate-400">{selectedValues.length} act.</span>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map((opt) => {
              const checked = selectedValues.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => toggleValue(opt.value)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs hover:bg-slate-50 cursor-pointer"
                  style={{ color: 'var(--pluz-ink)' }}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      checked
                        ? 'bg-[#3C5A9F] border-[#3C5A9F] text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {checked && <Check className="w-3 h-3" />}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminTurnsView: React.FC<AdminTurnsViewProps> = ({
  fecha,
  onFechaChange,
  contratas,
  rows,
  loading,
  onRefresh,
  selectedContrata,
  onSelectedContrataChange,
  onToast,
  allowDateChange = true,
  contrataGroupMap,
  activeGroup = 'ALL',
  canEditToday = false,
  catalogs = [],
  onUpdateCell,
}) => {
  const [selectedContratas, setSelectedContratas] = useState<string[]>(() =>
    selectedContrata && selectedContrata !== 'ALL' ? [selectedContrata] : [],
  );
  const lastEmittedContrataRef = useRef<string>(selectedContrata);
  const [selectedFronts, setSelectedFronts] = useState<string[]>([]);
  const [search, setSearch] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{
    column: SortColumn;
    direction: SortDirection;
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    field: EditableTurnField;
  } | null>(null);
  const [draftValue, setDraftValue] = useState<string>('');
  const [savingCell, setSavingCell] = useState<boolean>(false);

  const isEditable = Boolean(canEditToday && onUpdateCell);

  useEffect(() => {
    setEditingCell(null);
  }, [fecha, canEditToday]);

  // Sync external selectedContrata changes (e.g. drill-down from ChartsTab)
  useEffect(() => {
    if (selectedContrata !== lastEmittedContrataRef.current) {
      lastEmittedContrataRef.current = selectedContrata;
      setSelectedContratas(selectedContrata && selectedContrata !== 'ALL' ? [selectedContrata] : []);
    }
  }, [selectedContrata]);

  const handleContratasChange = (next: string[]) => {
    setSelectedContratas(next);
    const parentValue = next.length === 1 ? next[0] : 'ALL';
    lastEmittedContrataRef.current = parentValue;
    onSelectedContrataChange(parentValue);
  };

  const frontLabelMap = useMemo(() => {
    const map = new Map<FrontType, string>();
    for (const cfg of FRONT_CONFIGS) map.set(cfg.id, cfg.label);
    return map;
  }, []);

  const complianceByContrata = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of contratas) counts.set(c, 0);
    for (const r of rows) {
      if (r.nombres.trim()) {
        counts.set(r.contratista, (counts.get(r.contratista) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).map(([name, count]) => ({
      name,
      count,
      reported: count > 0,
    }));
  }, [contratas, rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (selectedContratas.length > 0 && !selectedContratas.includes(r.contratista)) return false;
      if (selectedFronts.length > 0 && !selectedFronts.includes(r.frente)) return false;
      if (!q) return true;
      return (
        r.nombres.toLowerCase().includes(q) ||
        r.usuario_ssam.toLowerCase().includes(q) ||
        r.celular.toLowerCase().includes(q) ||
        r.skill.toLowerCase().includes(q) ||
        r.horario.toLowerCase().includes(q) ||
        r.contratista.toLowerCase().includes(q)
      );
    });
  }, [rows, selectedContratas, selectedFronts, search]);

  const resolveRowGroup = (row: TurnRow): OperalogGroup =>
    row.grupo || contrataGroupMap?.get(row.contratista) || 'BT';

  const sortedRows = useMemo(() => {
    if (!sortConfig) return filteredRows;
    const { column, direction } = sortConfig;
    const multiplier = direction === 'asc' ? 1 : -1;

    return [...filteredRows].sort((a, b) => {
      const valA =
        column === 'frente'
          ? (frontLabelMap.get(a.frente) ?? a.frente)
          : column === 'grupo'
            ? (a.grupo || contrataGroupMap?.get(a.contratista) || 'BT')
            : (a[column] ?? '');
      const valB =
        column === 'frente'
          ? (frontLabelMap.get(b.frente) ?? b.frente)
          : column === 'grupo'
            ? (b.grupo || contrataGroupMap?.get(b.contratista) || 'BT')
            : (b[column] ?? '');
      return valA.localeCompare(valB, 'es', { sensitivity: 'base', numeric: true }) * multiplier;
    });
  }, [filteredRows, sortConfig, frontLabelMap, contrataGroupMap]);

  const handleSort = (column: SortColumn) => {
    setSortConfig((prev) => {
      if (!prev || prev.column !== column) {
        return { column, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { column, direction: 'desc' };
      }
      return null;
    });
  };

  const handleExportExcel = async () => {
    if (sortedRows.length === 0) {
      onToast({
        type: 'info',
        title: 'Sin datos para exportar',
        description: 'No hay registros que coincidan con los filtros actuales.',
      });
      return;
    }

    const groupSuffix = activeGroup && activeGroup !== 'ALL' ? activeGroup : 'ALL';
    const contrataSuffix =
      selectedContratas.length === 0
        ? 'ALL'
        : selectedContratas.length === 1
          ? selectedContratas[0]
          : 'MULTIPLE';
    const filename = `OperaLog_${fecha}_${groupSuffix}_${contrataSuffix}.xlsx`;

    try {
      await downloadAdminTurnsExcel(sortedRows, filename, frontLabelMap, contrataGroupMap);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Error al exportar Excel',
        description: err instanceof Error ? err.message : 'Intente nuevamente.',
      });
    }
  };

  const hasAdminEditedToday = useMemo(
    () =>
      Boolean(
        canEditToday &&
          sortedRows.some((r) => (r.admin_edited_fields?.length ?? 0) > 0),
      ),
    [canEditToday, sortedRows],
  );

  const fieldLabelMap: Record<EditableTurnField, string> = {
    frente: 'Frente',
    nombres: 'Nombres',
    usuario_ssam: 'Usuario SSAM',
    celular: 'Celular',
    actividad: 'Actividad',
    skill: 'Skill',
    horario: 'Horario',
  };

  const startEditing = (row: TurnRow, field: EditableTurnField) => {
    if (!isEditable || savingCell) return;
    setEditingCell({ rowId: row.id, field });
    setDraftValue(String(row[field] ?? ''));
  };

  const cancelEditing = () => {
    if (savingCell) return;
    setEditingCell(null);
  };

  const commitEditing = async (row: TurnRow, field: EditableTurnField) => {
    if (!onUpdateCell || savingCell) return;
    const nextVal = draftValue.trim();
    const prevVal = String(row[field] ?? '').trim();

    if (nextVal === prevVal) {
      setEditingCell(null);
      return;
    }

    const changes: Partial<Record<EditableTurnField, string>> = {
      [field]: nextVal,
    };

    if (field === 'frente') {
      const nextCfg = FRONT_CONFIGS.find((f) => f.id === nextVal);
      const prevCfg = FRONT_CONFIGS.find((f) => f.id === row.frente);
      if (nextCfg?.fixedActivity) {
        changes.actividad = nextCfg.fixedActivity;
      } else if (prevCfg?.fixedActivity && row.actividad === prevCfg.fixedActivity) {
        changes.actividad = '';
      }
      if (nextCfg && !nextCfg.hasSkill) {
        changes.skill = '';
      }
    }

    setSavingCell(true);
    try {
      await onUpdateCell(row, changes);
      setEditingCell(null);
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Error al actualizar registro',
        description: err instanceof Error ? err.message : 'Intente nuevamente.',
      });
    } finally {
      setSavingCell(false);
    }
  };

  const getSelectOptions = (
    row: TurnRow,
    field: EditableTurnField,
    rowGroup: OperalogGroup,
  ): { value: string; label: string }[] | null => {
    if (field === 'frente') {
      const activeFronts =
        catalogs.length > 0 ? getActiveFrontConfigs(catalogs, rowGroup) : FRONT_CONFIGS;
      const list = activeFronts.map((f) => ({ value: f.id, label: f.label }));
      if (row.frente && !list.some((o) => o.value === row.frente)) {
        list.unshift({
          value: row.frente,
          label: frontLabelMap.get(row.frente) ?? row.frente,
        });
      }
      return list;
    }

    if (field === 'horario') {
      const items = catalogs
        .filter((c) => c.tipo === 'HORARIO' && c.activo && matchesGroupCatalog(c.grupo, rowGroup))
        .sort((a, b) => a.orden - b.orden)
        .map((c) => ({ value: c.valor, label: c.valor }));
      if (items.length === 0) return null;
      if (row.horario && !items.some((o) => o.value === row.horario)) {
        items.unshift({ value: row.horario, label: row.horario });
      }
      return items;
    }

    if (field === 'skill') {
      const items = catalogs
        .filter(
          (c) =>
            c.tipo === 'SKILL' &&
            c.activo &&
            c.frente === row.frente &&
            matchesGroupCatalog(c.grupo, rowGroup),
        )
        .sort((a, b) => a.orden - b.orden)
        .map((c) => ({ value: c.valor, label: c.valor }));
      if (items.length === 0) return null;
      const withEmpty = [{ value: '', label: '—' }, ...items];
      if (row.skill && !withEmpty.some((o) => o.value === row.skill)) {
        withEmpty.push({ value: row.skill, label: row.skill });
      }
      return withEmpty;
    }

    if (field === 'actividad') {
      const frontCfg = FRONT_CONFIGS.find((f) => f.id === row.frente);
      if (!frontCfg?.hasActivityDropdown) return null;
      const items = catalogs
        .filter(
          (c) =>
            c.tipo === 'ACTIVIDAD' &&
            c.activo &&
            c.frente === row.frente &&
            matchesGroupCatalog(c.grupo, rowGroup),
        )
        .sort((a, b) => a.orden - b.orden)
        .map((c) => ({ value: c.valor, label: c.valor }));
      if (items.length === 0) return null;
      const withEmpty = [{ value: '', label: '—' }, ...items];
      if (row.actividad && !withEmpty.some((o) => o.value === row.actividad)) {
        withEmpty.push({ value: row.actividad, label: row.actividad });
      }
      return withEmpty;
    }

    return null;
  };

  const renderEditableCell = (
    row: TurnRow,
    field: EditableTurnField,
    rowGroup: OperalogGroup,
    tdClassName: string,
    displayContent: React.ReactNode,
  ) => {
    const isCurrentlyEditing =
      editingCell?.rowId === row.id && editingCell?.field === field;
    const isCellEditedToday = Boolean(
      canEditToday && row.admin_edited_fields?.includes(field),
    );
    const label = fieldLabelMap[field];
    const selectOptions = isCurrentlyEditing
      ? getSelectOptions(row, field, rowGroup)
      : null;

    return (
      <td
        data-admin-edited={isCellEditedToday ? 'true' : undefined}
        title={
          isCellEditedToday
            ? `Editado por ${row.updated_by || 'ADMIN'}${isEditable ? ' (clic para editar)' : ''}`
            : isEditable
              ? `Clic para editar ${label}`
              : undefined
        }
        onClick={
          isEditable && !isCurrentlyEditing
            ? () => startEditing(row, field)
            : undefined
        }
        className={`${tdClassName} ${
          isEditable && !isCurrentlyEditing
            ? 'group/cell cursor-pointer hover:bg-amber-50/70 transition-colors'
            : ''
        }`}
        style={
          isCellEditedToday
            ? { backgroundColor: 'rgba(254, 240, 138, 0.72)' }
            : undefined
        }
      >
        {isCurrentlyEditing ? (
          <div
            className="flex items-center gap-1 min-w-[120px]"
            onClick={(e) => e.stopPropagation()}
          >
            {selectOptions ? (
              <select
                aria-label={`Editar ${label}`}
                autoFocus
                disabled={savingCell}
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void commitEditing(row, field);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelEditing();
                  }
                }}
                className="w-full px-1.5 py-1 text-xs rounded border bg-white outline-none focus:ring-2 focus:ring-[#3C5A9F]/30"
                style={{ borderColor: 'var(--pluz-primary)', color: 'var(--pluz-ink)' }}
              >
                {selectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                aria-label={`Editar ${label}`}
                autoFocus
                disabled={savingCell}
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void commitEditing(row, field);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelEditing();
                  }
                }}
                className="w-full px-1.5 py-1 text-xs rounded border bg-white outline-none focus:ring-2 focus:ring-[#3C5A9F]/30"
                style={{ borderColor: 'var(--pluz-primary)', color: 'var(--pluz-ink)' }}
              />
            )}
            <button
              type="button"
              aria-label={`Guardar ${label}`}
              disabled={savingCell}
              onClick={() => void commitEditing(row, field)}
              className="p-1 rounded text-white cursor-pointer shrink-0 disabled:opacity-50"
              style={{ backgroundColor: 'var(--pluz-primary)' }}
            >
              {savingCell ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
            </button>
            <button
              type="button"
              aria-label={`Cancelar ${label}`}
              disabled={savingCell}
              onClick={cancelEditing}
              className="p-1 rounded border bg-white text-slate-500 hover:text-slate-800 cursor-pointer shrink-0 disabled:opacity-50"
              style={{ borderColor: 'var(--pluz-border)' }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 w-full justify-between">
            <span>{displayContent}</span>
            {isEditable && (
              <Pencil
                aria-hidden="true"
                className="w-3 h-3 shrink-0 opacity-0 group-hover/cell:opacity-65 transition-opacity"
                style={{ color: 'var(--pluz-primary)' }}
              />
            )}
          </div>
        )}
      </td>
    );
  };

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div
        className="rounded-xl border p-4 shadow-xs"
        style={{
          backgroundColor: 'var(--pluz-surface)',
          borderColor: 'var(--pluz-border)',
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Fecha (solo visible cuando está desbloqueado) */}
            {allowDateChange && (
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

            {/* Contratista (Selección múltiple) */}
            <MultiSelectDropdown
              label="Contratista"
              allLabel="Todas las contratistas"
              icon={<Building2 className="w-4 h-4" style={{ color: 'var(--pluz-primary)' }} />}
              options={contratas.map((c) => ({ value: c, label: c }))}
              selectedValues={selectedContratas}
              onChange={handleContratasChange}
            />

            {/* Frente (Selección múltiple) */}
            <MultiSelectDropdown
              label="Frente"
              allLabel="Todos los frentes"
              icon={<Filter className="w-4 h-4" style={{ color: 'var(--pluz-primary)' }} />}
              options={FRONT_CONFIGS.map((f) => ({ value: f.id, label: f.label }))}
              selectedValues={selectedFronts}
              onChange={setSelectedFronts}
            />
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 sm:w-56">
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--pluz-muted)' }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nombre, SSAM, skill..."
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border outline-none"
                style={{
                  borderColor: 'var(--pluz-border)',
                  color: 'var(--pluz-ink)',
                  backgroundColor: 'var(--pluz-surface)',
                }}
              />
            </div>

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer shrink-0 disabled:opacity-60"
              style={{
                borderColor: 'var(--pluz-border)',
                color: 'var(--pluz-primary)',
                backgroundColor: 'var(--pluz-surface)',
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>

            <button
              type="button"
              onClick={() => void handleExportExcel()}
              className="tactile-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer shrink-0"
              style={{ backgroundColor: 'var(--pluz-primary)' }}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Compliance Summary Pills */}
        <div
          className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2"
          style={{ borderColor: 'var(--pluz-border)' }}
        >
          <span className="inline-flex items-center gap-1 text-xs font-semibold mr-1" style={{ color: 'var(--pluz-muted)' }}>
            {isEditable ? <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--pluz-primary)' }} /> : <Eye className="w-3.5 h-3.5" />}
            {isEditable
              ? 'Cumplimiento del día (clic en una celda para corregir):'
              : 'Cumplimiento del día (Solo lectura):'}
          </span>
          {hasAdminEditedToday && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border"
              style={{
                backgroundColor: 'rgba(254, 240, 138, 0.72)',
                borderColor: 'rgba(217, 119, 6, 0.35)',
                color: '#92400E',
              }}
            >
              Editado por Admin hoy
            </span>
          )}
          {complianceByContrata.map((item) => {
            const isSelected = selectedContratas.includes(item.name);
            return (
              <button
                key={item.name}
                type="button"
                onClick={() =>
                  handleContratasChange(
                    isSelected
                      ? selectedContratas.filter((c) => c !== item.name)
                      : [...selectedContratas, item.name],
                  )
                }
                className={`tactile-btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer ${
                  isSelected ? 'ring-2 ring-[#3C5A9F]/50' : ''
                }`}
                style={{
                  backgroundColor: item.reported
                    ? 'rgba(108, 171, 94, 0.12)'
                    : 'rgba(230, 57, 70, 0.08)',
                  borderColor: item.reported
                    ? 'rgba(108, 171, 94, 0.35)'
                    : 'rgba(230, 57, 70, 0.3)',
                  color: item.reported ? 'var(--pluz-success)' : 'var(--pluz-danger)',
                }}
              >
                {item.reported ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                <span>
                  {item.name}: {item.reported ? `${item.count} reg.` : 'Pendiente'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Read-only Consolidated Table */}
      <div
        className="rounded-xl border shadow-xs overflow-hidden"
        style={{
          backgroundColor: 'var(--pluz-surface)',
          borderColor: 'var(--pluz-border)',
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2.5 text-sm" style={{ color: 'var(--pluz-muted)' }}>
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--pluz-primary)' }} />
            <span>Consultando turnos del {fecha}...</span>
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="text-center py-14 px-4">
            <p className="text-sm font-semibold" style={{ color: 'var(--pluz-ink)' }}>
              No hay registros para mostrar
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--pluz-muted)' }}>
              Ninguna contratista ha cargado turnos para el {fecha} con los filtros seleccionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr
                  className="border-b text-[11px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: 'var(--pluz-bg)',
                    borderColor: 'var(--pluz-border)',
                    color: 'var(--pluz-muted)',
                  }}
                >
                  {TABLE_COLUMNS.map((col) => {
                    const isActive = sortConfig?.column === col.key;
                    const ariaSort = isActive
                      ? sortConfig.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none';
                    return (
                      <th key={col.key} aria-sort={ariaSort} className="py-2.5 px-3 select-none">
                        <button
                          type="button"
                          onClick={() => handleSort(col.key)}
                          className="group inline-flex items-center gap-1 uppercase tracking-wider font-semibold cursor-pointer hover:text-slate-900 focus:outline-none"
                          style={{ color: isActive ? 'var(--pluz-primary)' : 'inherit' }}
                        >
                          <span>{col.label}</span>
                          {isActive ? (
                            sortConfig.direction === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 shrink-0 opacity-35 group-hover:opacity-80" />
                          )}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--pluz-border)' }}>
                {sortedRows.map((row) => {
                  const rowGroup = resolveRowGroup(row);
                  const groupStyle = GROUP_BADGE_STYLES[rowGroup] ?? {
                    bg: 'rgba(60, 90, 159, 0.1)',
                    color: '#3C5A9F',
                  };
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-semibold text-xs" style={{ color: 'var(--pluz-primary)' }}>
                        {row.contratista}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
                          style={{
                            backgroundColor: groupStyle.bg,
                            color: groupStyle.color,
                          }}
                        >
                          {rowGroup}
                        </span>
                      </td>
                      {renderEditableCell(
                        row,
                        'frente',
                        rowGroup,
                        'py-2 px-3 text-xs font-medium',
                        <span style={{ color: 'var(--pluz-ink)' }}>
                          {frontLabelMap.get(row.frente) ?? row.frente}
                        </span>,
                      )}
                      {renderEditableCell(
                        row,
                        'nombres',
                        rowGroup,
                        'py-2 px-3 font-medium',
                        <span style={{ color: 'var(--pluz-ink)' }}>{row.nombres}</span>,
                      )}
                      {renderEditableCell(
                        row,
                        'usuario_ssam',
                        rowGroup,
                        'py-2 px-3 font-mono text-xs',
                        <span style={{ color: 'var(--pluz-muted)' }}>
                          {row.usuario_ssam || '—'}
                        </span>,
                      )}
                      {renderEditableCell(
                        row,
                        'celular',
                        rowGroup,
                        'py-2 px-3 font-mono text-xs',
                        <span style={{ color: 'var(--pluz-muted)' }}>
                          {row.celular || '—'}
                        </span>,
                      )}
                      {renderEditableCell(
                        row,
                        'actividad',
                        rowGroup,
                        'py-2 px-3 text-xs',
                        <span style={{ color: 'var(--pluz-ink)' }}>
                          {row.actividad || '—'}
                        </span>,
                      )}
                      {renderEditableCell(
                        row,
                        'skill',
                        rowGroup,
                        'py-2 px-3 text-xs',
                        <span style={{ color: 'var(--pluz-ink)' }}>
                          {row.skill || '—'}
                        </span>,
                      )}
                      {renderEditableCell(
                        row,
                        'horario',
                        rowGroup,
                        'py-2 px-3',
                        row.horario ? (
                          <span
                            className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              backgroundColor: 'rgba(60, 90, 159, 0.08)',
                              color: 'var(--pluz-primary)',
                            }}
                          >
                            {row.horario}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold" style={{ color: 'var(--pluz-danger)' }}>
                            Sin horario
                          </span>
                        ),
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
