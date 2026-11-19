import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Info,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { refreshAllCatalogs, saveCatalog } from '../services/gasClient';
import {
  FRONT_CONFIGS,
  getGroupLabel,
  normalizeGroup,
  parseUserGroups,
  type CatalogItem,
  type OperalogGroup,
  type UserGroupScope,
  type UserSession,
} from '../types/operalog';

type CatalogTipo = CatalogItem['tipo'];

interface EditableCatalogItem extends CatalogItem {
  _uid: string;
}

export interface AdminCatalogsTabProps {
  catalog: CatalogItem[];
  onCatalogSaved: (updatedCatalog: CatalogItem[]) => void;
  user?: UserSession;
  activeGroup?: UserGroupScope;
  availableGroups?: OperalogGroup[];
}

interface TipoConfig {
  id: CatalogTipo;
  label: string;
  singular: string;
  icon: typeof Clock;
  description: string;
  placeholder: string;
  defaultFrente: string;
  frenteOptions: { value: string; label: string }[];
}

const SKILL_FRENTES = FRONT_CONFIGS.filter((f) => f.hasSkill).map((f) => ({
  value: f.id,
  label: f.label,
}));

const ACTIVITY_FRENTES = FRONT_CONFIGS.filter((f) => f.hasActivityDropdown).map((f) => ({
  value: f.id,
  label: f.label,
}));

const TIPO_CONFIGS: Record<CatalogTipo, TipoConfig> = {
  HORARIO: {
    id: 'HORARIO',
    label: 'Horarios',
    singular: 'horario',
    icon: Clock,
    description:
      'Opciones de turno horario disponibles en todos los frentes y en los gráficos de cobertura.',
    placeholder: 'ej. 19:00 - 07:00',
    defaultFrente: 'ALL',
    frenteOptions: [{ value: 'ALL', label: 'Todos los frentes (ALL)' }],
  },
  SKILL: {
    id: 'SKILL',
    label: 'Skills',
    singular: 'skill',
    icon: Wrench,
    description:
      'Especialidades técnicas mostradas únicamente en los frentes de campo: Reclamos, Teko y Reparaciones.',
    placeholder: 'ej. MT / BT',
    defaultFrente: 'RECLAMOS',
    frenteOptions: [
      ...SKILL_FRENTES,
      { value: 'ALL', label: 'Todos los frentes de campo (ALL)' },
    ],
  },
  ACTIVIDAD: {
    id: 'ACTIVIDAD',
    label: 'Actividades',
    singular: 'actividad',
    icon: Briefcase,
    description:
      'Roles de actividad seleccionables en Despachadores (Reclamos, Teko y Reparaciones usan actividad fija).',
    placeholder: 'ej. DESPACHO BT',
    defaultFrente: 'DESPACHADORES',
    frenteOptions: [
      ...ACTIVITY_FRENTES,
      { value: 'ALL', label: 'Todos (ALL)' },
    ],
  },
  FRENTE: {
    id: 'FRENTE',
    label: 'Frentes / Bloques',
    singular: 'frente',
    icon: Layers,
    description:
      'Activa, desactiva u ordena los bloques de registro que ven las contratas de este grupo.',
    placeholder: 'ej. RECLAMOS',
    defaultFrente: 'ALL',
    frenteOptions: FRONT_CONFIGS.map((f) => ({ value: f.id, label: f.label })),
  },
};

const TIPO_TABS: CatalogTipo[] = ['HORARIO', 'SKILL', 'ACTIVIDAD', 'FRENTE'];

function itemMatchesGroup(it: CatalogItem, targetGroup: OperalogGroup): boolean {
  const itemGroup = normalizeGroup(it.grupo, it.tipo === 'HORARIO' ? 'ALL' : 'BT');
  return itemGroup === 'ALL' || itemGroup === targetGroup;
}

let uidCounter = 0;
function nextUid(): string {
  uidCounter += 1;
  return `cat-${Date.now()}-${uidCounter}`;
}

function toEditableItems(items: CatalogItem[]): EditableCatalogItem[] {
  return items.map((it) => ({
    ...it,
    _uid: nextUid(),
  }));
}

function toPlainCatalogItems(items: EditableCatalogItem[]): CatalogItem[] {
  return items.map(({ _uid: _omit, ...rest }) => {
    void _omit;
    return rest;
  });
}

export function AdminCatalogsTab({
  catalog,
  onCatalogSaved,
  user,
  activeGroup,
  availableGroups,
}: AdminCatalogsTabProps) {
  const allowedGroups = useMemo(
    () => parseUserGroups(user?.grupo, 'ALL', availableGroups),
    [user?.grupo, availableGroups],
  );
  const isGeneralAdmin =
    !user || normalizeGroup(user.grupo, 'ALL') === 'ALL' || allowedGroups.length > 1;
  const visibleCatalogGroups = useMemo(
    () =>
      allowedGroups.map((id) => ({
        id,
        shortLabel: id,
        label: getGroupLabel(id),
      })),
    [allowedGroups],
  );

  const [selectedGroup, setSelectedGroup] = useState<OperalogGroup>(() => {
    if (activeGroup && activeGroup !== 'ALL' && allowedGroups.includes(activeGroup)) {
      return activeGroup;
    }
    return allowedGroups[0] ?? 'BT';
  });

  useEffect(() => {
    if (
      isGeneralAdmin &&
      activeGroup &&
      activeGroup !== 'ALL' &&
      allowedGroups.includes(activeGroup)
    ) {
      setSelectedGroup(activeGroup);
    }
  }, [isGeneralAdmin, activeGroup, allowedGroups]);

  const effectiveGroup: OperalogGroup = isGeneralAdmin
    ? selectedGroup
    : (allowedGroups[0] ?? 'BT');

  const [items, setItems] = useState<EditableCatalogItem[]>(() => toEditableItems(catalog));
  const [activeTipo, setActiveTipo] = useState<CatalogTipo>('HORARIO');
  const [frenteFilter, setFrenteFilter] = useState<string>('ALL_FILTER');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Contextual add form state
  const [newFrente, setNewFrente] = useState<string>('ALL');
  const [newValor, setNewValor] = useState<string>('');

  // Inline edit state
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editingValor, setEditingValor] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    setItems(toEditableItems(catalog));
    setIsDirty(false);
    setEditingUid(null);
  }, [catalog]);

  const activeConfig = TIPO_CONFIGS[activeTipo];

  const groupScopedItems = useMemo(
    () => items.filter((it) => itemMatchesGroup(it, effectiveGroup)),
    [items, effectiveGroup],
  );

  const availableFrentePills = useMemo(() => {
    if (activeTipo === 'HORARIO' || activeTipo === 'FRENTE') return [];
    const configured = activeConfig.frenteOptions.map((o) => o.value);
    const inItems = groupScopedItems
      .filter((it) => it.tipo === activeTipo)
      .map((it) => it.frente);
    return Array.from(new Set([...configured, ...inItems]));
  }, [activeTipo, activeConfig.frenteOptions, groupScopedItems]);

  // Group items of activeTipo by frente (or 'ALL' for FRENTE), sorted by orden
  const groupedOrderMap = useMemo(() => {
    const map = new Map<string, EditableCatalogItem[]>();
    for (const it of groupScopedItems) {
      if (it.tipo !== activeTipo) continue;
      const key = activeTipo === 'FRENTE' ? 'ALL' : it.frente;
      const list = map.get(key) ?? [];
      list.push(it);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.orden - b.orden);
    }
    return map;
  }, [groupScopedItems, activeTipo]);

  const visibleItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return groupScopedItems
      .filter((it) => {
        if (it.tipo !== activeTipo) return false;
        if (
          activeTipo !== 'HORARIO' &&
          activeTipo !== 'FRENTE' &&
          frenteFilter !== 'ALL_FILTER' &&
          it.frente !== frenteFilter
        ) {
          return false;
        }
        if (q && !it.valor.toLowerCase().includes(q) && !it.frente.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .slice()
      .sort((a, b) => {
        if (activeTipo !== 'FRENTE' && a.frente !== b.frente) {
          return a.frente.localeCompare(b.frente);
        }
        return a.orden - b.orden;
      });
  }, [groupScopedItems, activeTipo, frenteFilter, searchTerm]);

  const activeStats = useMemo(() => {
    const ofTipo = groupScopedItems.filter((it) => it.tipo === activeTipo);
    const activeCount = ofTipo.filter((it) => it.activo).length;
    const inactiveCount = ofTipo.length - activeCount;
    return { total: ofTipo.length, activeCount, inactiveCount };
  }, [groupScopedItems, activeTipo]);

  if (user && user.rol !== 'ADMIN') {
    return (
      <div
        className="rounded-xl border p-8 text-center"
        style={{
          backgroundColor: 'var(--pluz-surface)',
          borderColor: 'var(--pluz-border)',
        }}
      >
        <ShieldAlert className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--pluz-danger)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--pluz-ink)' }}>
          Acceso restringido a administradores
        </p>
      </div>
    );
  }

  const handleSelectGroup = (group: OperalogGroup) => {
    if (!isGeneralAdmin || group === effectiveGroup) return;
    setSelectedGroup(group);
    setFrenteFilter('ALL_FILTER');
    setSearchTerm('');
    setEditingUid(null);
    setFeedback(null);
  };

  const handleInitGroupFrentes = () => {
    const existingTokens = new Set(
      groupScopedItems
        .filter((it) => it.tipo === 'FRENTE')
        .map((it) => String(it.valor || it.frente).trim().toUpperCase()),
    );
    const missing = FRONT_CONFIGS.filter((f) => !existingTokens.has(f.id));
    if (missing.length === 0) return;

    const currentCount = existingTokens.size;
    const seeded: EditableCatalogItem[] = missing.map((f, idx) => ({
      _uid: nextUid(),
      tipo: 'FRENTE',
      frente: 'ALL',
      valor: f.id,
      orden: currentCount + idx + 1,
      activo: true,
      grupo: effectiveGroup,
    }));
    setItems((prev) => [...prev, ...seeded]);
    setIsDirty(true);
    setFeedback(null);
  };

  const handleSelectTipoTab = (tipo: CatalogTipo) => {
    setActiveTipo(tipo);
    setFrenteFilter('ALL_FILTER');
    setSearchTerm('');
    setNewFrente(TIPO_CONFIGS[tipo].defaultFrente);
    setNewValor(tipo === 'FRENTE' ? FRONT_CONFIGS[0].id : '');
    setEditingUid(null);
    setFeedback(null);
  };

  const handleSelectFrenteFilter = (frente: string) => {
    setFrenteFilter(frente);
    if (frente !== 'ALL_FILTER') {
      setNewFrente(frente);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newValor.trim();
    const targetFrente =
      activeTipo === 'HORARIO' || activeTipo === 'FRENTE' ? 'ALL' : newFrente;

    if (!trimmed) {
      setFeedback({
        type: 'error',
        message: `Ingresa un valor para el nuevo ${activeConfig.singular}.`,
      });
      return;
    }

    const exists = groupScopedItems.some(
      (it) =>
        it.tipo === activeTipo &&
        (activeTipo === 'FRENTE' || it.frente === targetFrente) &&
        it.valor.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      setFeedback({
        type: 'error',
        message: `Ya existe "${trimmed}" en ${activeConfig.label} (${targetFrente}).`,
      });
      return;
    }

    const sameGroup = groupScopedItems.filter(
      (it) =>
        it.tipo === activeTipo &&
        (activeTipo === 'FRENTE' || it.frente === targetFrente),
    );
    const maxOrden = sameGroup.reduce((max, it) => Math.max(max, it.orden), 0);

    const newItem: EditableCatalogItem = {
      _uid: nextUid(),
      tipo: activeTipo,
      frente: targetFrente,
      valor: activeTipo === 'FRENTE' ? trimmed.toUpperCase() : trimmed,
      orden: maxOrden + 1,
      activo: true,
      grupo: activeTipo === 'HORARIO' && isGeneralAdmin ? 'ALL' : effectiveGroup,
    };

    setItems((prev) => [...prev, newItem]);
    if (activeTipo !== 'FRENTE') {
      setNewValor('');
    }
    setIsDirty(true);
    setFeedback(null);
  };

  const handleToggleActivo = (uid: string) => {
    setItems((prev) =>
      prev.map((it) => (it._uid === uid ? { ...it, activo: !it.activo } : it)),
    );
    setIsDirty(true);
    setFeedback(null);
  };

  const handleDelete = (uid: string) => {
    const target = items.find((it) => it._uid === uid);
    if (!target) return;

    setItems((prev) => {
      const remaining = prev.filter((it) => it._uid !== uid);
      // Renumber orden within the affected (tipo, frente) group
      const groupUids = remaining
        .filter((it) => it.tipo === target.tipo && it.frente === target.frente)
        .sort((a, b) => a.orden - b.orden)
        .map((it) => it._uid);
      const orderByUid = new Map(groupUids.map((id, idx) => [id, idx + 1]));
      return remaining.map((it) => {
        const newOrden = orderByUid.get(it._uid);
        return newOrden !== undefined ? { ...it, orden: newOrden } : it;
      });
    });

    if (editingUid === uid) setEditingUid(null);
    setIsDirty(true);
    setFeedback(null);
  };

  const handleStartEdit = (item: EditableCatalogItem) => {
    setEditingUid(item._uid);
    setEditingValor(item.valor);
    setFeedback(null);
  };

  const handleCancelEdit = () => {
    setEditingUid(null);
    setEditingValor('');
  };

  const handleConfirmEdit = (item: EditableCatalogItem) => {
    const trimmed = editingValor.trim();
    if (!trimmed) {
      setFeedback({ type: 'error', message: 'El valor no puede quedar vacío.' });
      return;
    }

    const duplicate = items.some(
      (it) =>
        it._uid !== item._uid &&
        it.tipo === item.tipo &&
        it.frente === item.frente &&
        it.valor.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setFeedback({
        type: 'error',
        message: `Ya existe "${trimmed}" en ${item.tipo} (${item.frente}).`,
      });
      return;
    }

    if (trimmed !== item.valor) {
      setItems((prev) =>
        prev.map((it) => (it._uid === item._uid ? { ...it, valor: trimmed } : it)),
      );
      setIsDirty(true);
    }
    setEditingUid(null);
    setEditingValor('');
    setFeedback(null);
  };

  const handleMoveWithinGroup = (item: EditableCatalogItem, direction: -1 | 1) => {
    const groupKey = item.tipo === 'FRENTE' ? 'ALL' : item.frente;
    const group = groupedOrderMap.get(groupKey) ?? [];
    const idxInGroup = group.findIndex((g) => g._uid === item._uid);
    const swapIdx = idxInGroup + direction;
    if (idxInGroup < 0 || swapIdx < 0 || swapIdx >= group.length) return;

    const reordered = [...group];
    const [moved] = reordered.splice(idxInGroup, 1);
    reordered.splice(swapIdx, 0, moved);

    const updatedOrders = new Map<string, number>();
    reordered.forEach((it, idx) => {
      updatedOrders.set(it._uid, idx + 1);
    });

    setItems((prev) =>
      prev.map((it) => {
        const newOrden = updatedOrders.get(it._uid);
        return newOrden !== undefined ? { ...it, orden: newOrden } : it;
      }),
    );
    setIsDirty(true);
    setFeedback(null);
  };

  const handleDiscard = () => {
    setItems(toEditableItems(catalog));
    setIsDirty(false);
    setEditingUid(null);
    setFeedback(null);
  };

  const handleRefresh = async () => {
    if (
      isDirty &&
      !window.confirm('Tienes cambios sin guardar. ¿Deseas descartarlos y recargar desde Google Sheets?')
    ) {
      return;
    }
    setIsRefreshing(true);
    setFeedback(null);
    try {
      const fresh = await refreshAllCatalogs();
      onCatalogSaved(fresh);
      setItems(toEditableItems(fresh));
      setIsDirty(false);
      setFeedback({
        type: 'success',
        message: `Catálogos sincronizados desde Google Sheets (${fresh.length} ítems).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'No se pudieron recargar los catálogos.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const plainGroupItems = toPlainCatalogItems(
        items.filter((it) => itemMatchesGroup(it, effectiveGroup)),
      );
      const result = await saveCatalog({
        items: plainGroupItems,
        rol: user?.rol ?? 'ADMIN',
        usuario: user?.usuario ?? '',
        grupo: effectiveGroup,
      });
      onCatalogSaved(result.items);
      setItems(toEditableItems(result.items));
      setIsDirty(false);
      setEditingUid(null);
      setFeedback({
        type: 'success',
        message: `Catálogos (${effectiveGroup}) guardados en Google Sheets (${result.items.length} ítems).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'No se pudieron guardar los catálogos.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const canReorder = searchTerm.trim().length === 0;

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--pluz-ink)' }}>
            Administración de Catálogos
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--pluz-muted)' }}>
            Gestiona las listas desplegables que usan las contratas al registrar turnos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isGeneralAdmin ? (
            <div
              role="group"
              aria-label="Seleccionar grupo de catálogo"
              className="inline-flex items-center rounded-lg border p-0.5"
              style={{
                backgroundColor: 'var(--pluz-bg)',
                borderColor: 'var(--pluz-border)',
              }}
            >
              {visibleCatalogGroups.map((g) => {
                const active = effectiveGroup === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleSelectGroup(g.id)}
                    className="tactile-btn px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--pluz-primary)' : 'transparent',
                      color: active ? '#FFFFFF' : 'var(--pluz-muted)',
                    }}
                    title={g.label}
                  >
                    {g.shortLabel}
                  </button>
                );
              })}
            </div>
          ) : (
            <span
              className="inline-flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--pluz-bg)',
                borderColor: 'var(--pluz-border)',
                color: 'var(--pluz-ink)',
              }}
            >
              Grupo: {getGroupLabel(effectiveGroup)}
            </span>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isSaving}
            className="tactile-btn inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: 'var(--pluz-surface)',
              borderColor: 'var(--pluz-border)',
              color: 'var(--pluz-ink)',
            }}
            title="Recargar catálogos desde Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Recargar</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || (!isDirty && items.length > 0)}
            className="tactile-btn inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white shadow-xs disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: 'var(--pluz-primary)' }}
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Guardando...' : 'Guardar en Sheets'}</span>
          </button>
        </div>
      </div>

      {/* Unsaved changes bar */}
      {isDirty && (
        <div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 rounded-xl border"
          style={{
            backgroundColor: 'rgba(251, 193, 64, 0.14)',
            borderColor: 'rgba(251, 193, 64, 0.55)',
          }}
        >
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#854D0E' }}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Tienes cambios pendientes en memoria. Presiona <strong>Guardar en Sheets</strong> para aplicarlos a todos los usuarios.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isSaving}
              className="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer bg-white"
              style={{
                borderColor: 'var(--pluz-border)',
                color: 'var(--pluz-ink)',
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Descartar</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer"
              style={{ backgroundColor: 'var(--pluz-primary)' }}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Guardando...' : 'Guardar ahora'}</span>
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-semibold"
          style={{
            backgroundColor:
              feedback.type === 'success'
                ? 'rgba(108, 171, 94, 0.1)'
                : 'rgba(230, 57, 70, 0.08)',
            borderColor:
              feedback.type === 'success'
                ? 'rgba(108, 171, 94, 0.35)'
                : 'rgba(230, 57, 70, 0.3)',
            color:
              feedback.type === 'success' ? 'var(--pluz-success)' : 'var(--pluz-danger)',
          }}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Card: Tabs + Contextual Add Form + Filters + Table */}
      <div
        className="rounded-xl border overflow-hidden shadow-2xs"
        style={{
          backgroundColor: 'var(--pluz-surface)',
          borderColor: 'var(--pluz-border)',
        }}
      >
        {/* Tipo Tabs */}
        <div
          className="flex items-center justify-between gap-2 px-4 pt-3 border-b overflow-x-auto"
          style={{
            borderColor: 'var(--pluz-border)',
            backgroundColor: 'var(--pluz-bg)',
          }}
        >
          <div className="flex items-center gap-1">
            {TIPO_TABS.map((tipoId) => {
              const cfg = TIPO_CONFIGS[tipoId];
              const Icon = cfg.icon;
              const isActive = activeTipo === tipoId;
              const count = groupScopedItems.filter((it) => it.tipo === tipoId).length;
              return (
                <button
                  key={tipoId}
                  type="button"
                  onClick={() => handleSelectTipoTab(tipoId)}
                  className="tactile-btn inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 cursor-pointer whitespace-nowrap"
                  style={{
                    borderColor: isActive ? 'var(--pluz-primary)' : 'transparent',
                    backgroundColor: isActive ? 'var(--pluz-surface)' : 'transparent',
                    color: isActive ? 'var(--pluz-primary)' : 'var(--pluz-muted)',
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cfg.label}</span>
                  <span
                    className="text-[11px] px-1.5 py-0.2 rounded-full font-bold"
                    style={{
                      backgroundColor: isActive
                        ? 'rgba(60, 90, 159, 0.12)'
                        : 'rgba(100, 116, 139, 0.12)',
                      color: isActive ? 'var(--pluz-primary)' : 'var(--pluz-muted)',
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className="hidden md:flex items-center gap-2 pb-2 text-[11px] font-medium whitespace-nowrap"
            style={{ color: 'var(--pluz-muted)' }}
          >
            <span>
              <strong style={{ color: 'var(--pluz-success)' }}>{activeStats.activeCount}</strong> activos
            </span>
            <span>·</span>
            <span>
              <strong>{activeStats.inactiveCount}</strong> inactivos
            </span>
          </div>
        </div>

        {/* Contextual Description + Add Form */}
        <div
          className="p-4 sm:p-5 border-b space-y-4"
          style={{ borderColor: 'var(--pluz-border)' }}
        >
          <div
            className="flex items-start gap-2 text-xs rounded-lg px-3 py-2"
            style={{
              backgroundColor: 'rgba(60, 90, 159, 0.06)',
              color: 'var(--pluz-ink)',
            }}
          >
            <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--pluz-primary)' }} />
            <span>{activeConfig.description}</span>
          </div>

          {activeTipo === 'FRENTE' ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <form onSubmit={handleAddItem} className="flex flex-wrap items-end gap-3 flex-1">
                <div className="min-w-[220px] flex-1 max-w-xs">
                  <label
                    htmlFor="cat-valor"
                    className="block text-xs font-semibold mb-1"
                    style={{ color: 'var(--pluz-ink)' }}
                  >
                    Agregar frente individual
                  </label>
                  <select
                    id="cat-valor"
                    value={newValor}
                    onChange={(e) => setNewValor(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                    style={{
                      borderColor: 'var(--pluz-border)',
                      backgroundColor: 'var(--pluz-surface)',
                      color: 'var(--pluz-ink)',
                    }}
                  >
                    {activeConfig.frenteOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="tactile-btn inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer"
                  style={{ backgroundColor: 'var(--pluz-success)' }}
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar</span>
                </button>
              </form>

              {activeStats.total < FRONT_CONFIGS.length && (
                <button
                  type="button"
                  onClick={handleInitGroupFrentes}
                  className="tactile-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer"
                  style={{
                    borderColor: 'var(--pluz-primary)',
                    color: 'var(--pluz-primary)',
                    backgroundColor: 'rgba(60, 90, 159, 0.06)',
                  }}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Inicializar frentes del grupo ({effectiveGroup})</span>
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleAddItem} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              {activeTipo !== 'HORARIO' ? (
                <div className="sm:col-span-4">
                  <label
                    htmlFor="cat-frente"
                    className="block text-xs font-semibold mb-1"
                    style={{ color: 'var(--pluz-ink)' }}
                  >
                    Frente destino
                  </label>
                  <select
                    id="cat-frente"
                    value={newFrente}
                    onChange={(e) => setNewFrente(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                    style={{
                      borderColor: 'var(--pluz-border)',
                      backgroundColor: 'var(--pluz-surface)',
                      color: 'var(--pluz-ink)',
                    }}
                  >
                    {activeConfig.frenteOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="sm:col-span-3">
                  <span
                    className="block text-xs font-semibold mb-1"
                    style={{ color: 'var(--pluz-muted)' }}
                  >
                    Alcance
                  </span>
                  <div
                    className="px-3 py-2 text-xs font-semibold rounded-lg border"
                    style={{
                      borderColor: 'var(--pluz-border)',
                      backgroundColor: 'var(--pluz-bg)',
                      color: 'var(--pluz-muted)',
                    }}
                  >
                    Todos los frentes (ALL)
                  </div>
                </div>
              )}

              <div className={activeTipo !== 'HORARIO' ? 'sm:col-span-6' : 'sm:col-span-7'}>
                <label
                  htmlFor="cat-valor"
                  className="block text-xs font-semibold mb-1"
                  style={{ color: 'var(--pluz-ink)' }}
                >
                  Nuevo {activeConfig.singular}
                </label>
                <input
                  id="cat-valor"
                  type="text"
                  value={newValor}
                  onChange={(e) => setNewValor(e.target.value)}
                  placeholder={activeConfig.placeholder}
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                  style={{
                    borderColor: 'var(--pluz-border)',
                    backgroundColor: 'var(--pluz-surface)',
                    color: 'var(--pluz-ink)',
                  }}
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="tactile-btn w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer"
                  style={{ backgroundColor: 'var(--pluz-success)' }}
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Toolbar: Frente Filter Pills + Search */}
        <div
          className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{
            borderColor: 'var(--pluz-border)',
            backgroundColor: 'rgba(248, 249, 250, 0.5)',
          }}
        >
          {availableFrentePills.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleSelectFrenteFilter('ALL_FILTER')}
                className="tactile-btn text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer"
                style={{
                  borderColor:
                    frenteFilter === 'ALL_FILTER' ? 'var(--pluz-primary)' : 'var(--pluz-border)',
                  backgroundColor:
                    frenteFilter === 'ALL_FILTER' ? 'var(--pluz-primary)' : 'var(--pluz-surface)',
                  color: frenteFilter === 'ALL_FILTER' ? '#FFFFFF' : 'var(--pluz-muted)',
                }}
              >
                Todos
              </button>
              {availableFrentePills.map((fr) => {
                const active = frenteFilter === fr;
                return (
                  <button
                    key={fr}
                    type="button"
                    onClick={() => handleSelectFrenteFilter(fr)}
                    className="tactile-btn text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer"
                    style={{
                      borderColor: active ? 'var(--pluz-primary)' : 'var(--pluz-border)',
                      backgroundColor: active ? 'var(--pluz-primary)' : 'var(--pluz-surface)',
                      color: active ? '#FFFFFF' : 'var(--pluz-ink)',
                    }}
                  >
                    {fr}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="text-xs font-medium" style={{ color: 'var(--pluz-muted)' }}>
              Orden de aparición en desplegables y gráficos
            </span>
          )}

          <div className="relative w-full sm:w-60">
            <Search
              className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--pluz-muted)' }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Buscar ${activeConfig.singular}...`}
              aria-label={`Buscar ${activeConfig.singular}`}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none"
              style={{
                borderColor: 'var(--pluz-border)',
                backgroundColor: 'var(--pluz-surface)',
                color: 'var(--pluz-ink)',
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className="border-b text-[11px] font-bold uppercase tracking-wider"
                style={{
                  borderColor: 'var(--pluz-border)',
                  color: 'var(--pluz-muted)',
                  backgroundColor: 'rgba(248, 249, 250, 0.6)',
                }}
              >
                <th className="py-2.5 px-4 w-16">Orden</th>
                <th className="py-2.5 px-4 w-40">Frente</th>
                <th className="py-2.5 px-4">Valor</th>
                <th className="py-2.5 px-4 w-28">Estado</th>
                <th className="py-2.5 px-4 w-40 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--pluz-border)' }}>
              {visibleItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-sm"
                    style={{ color: 'var(--pluz-muted)' }}
                  >
                    {searchTerm.trim()
                      ? `No hay resultados para "${searchTerm.trim()}".`
                      : `No hay ítems registrados en ${activeConfig.label}.`}
                  </td>
                </tr>
              ) : (
                visibleItems.map((item) => {
                  const groupKey = item.tipo === 'FRENTE' ? 'ALL' : item.frente;
                  const group = groupedOrderMap.get(groupKey) ?? [];
                  const idxInGroup = group.findIndex((g) => g._uid === item._uid);
                  const isFirstInGroup = idxInGroup <= 0;
                  const isLastInGroup = idxInGroup === -1 || idxInGroup >= group.length - 1;
                  const isEditing = editingUid === item._uid;

                  return (
                    <tr
                      key={item._uid}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td
                        className="py-2.5 px-4 text-xs font-mono font-semibold"
                        style={{ color: 'var(--pluz-muted)' }}
                      >
                        #{item.orden}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded border"
                          style={{
                            backgroundColor: 'var(--pluz-bg)',
                            borderColor: 'var(--pluz-border)',
                            color: 'var(--pluz-ink)',
                          }}
                        >
                          {item.frente}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingValor}
                              onChange={(e) => setEditingValor(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleConfirmEdit(item);
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                              autoFocus
                              aria-label={`Editar ${item.valor}`}
                              className="w-full max-w-xs px-2.5 py-1 text-sm rounded-lg border outline-none"
                              style={{
                                borderColor: 'var(--pluz-primary)',
                                backgroundColor: 'var(--pluz-surface)',
                                color: 'var(--pluz-ink)',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleConfirmEdit(item)}
                              className="tactile-btn p-1.5 rounded-lg text-white cursor-pointer"
                              style={{ backgroundColor: 'var(--pluz-success)' }}
                              title="Confirmar"
                              aria-label="Confirmar edición"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="tactile-btn p-1.5 rounded-lg border cursor-pointer"
                              style={{
                                borderColor: 'var(--pluz-border)',
                                color: 'var(--pluz-muted)',
                              }}
                              title="Cancelar"
                              aria-label="Cancelar edición"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className="text-sm font-medium"
                            style={{
                              color: item.activo ? 'var(--pluz-ink)' : 'var(--pluz-muted)',
                              textDecoration: item.activo ? 'none' : 'line-through',
                            }}
                          >
                            {item.valor}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleActivo(item._uid)}
                          className="tactile-btn text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer"
                          style={{
                            backgroundColor: item.activo
                              ? 'rgba(108, 171, 94, 0.14)'
                              : 'rgba(100, 116, 139, 0.14)',
                            color: item.activo ? 'var(--pluz-success)' : 'var(--pluz-muted)',
                          }}
                          title={
                            item.activo
                              ? 'Clic para desactivar (oculta de desplegables sin borrar)'
                              : 'Clic para reactivar'
                          }
                        >
                          {item.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item)}
                            disabled={isEditing}
                            className="tactile-btn p-1.5 rounded-lg border disabled:opacity-30 hover:bg-slate-100 cursor-pointer"
                            style={{
                              borderColor: 'var(--pluz-border)',
                              color: 'var(--pluz-ink)',
                            }}
                            title="Editar valor"
                            aria-label={`Editar ${item.valor}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveWithinGroup(item, -1)}
                            disabled={!canReorder || isFirstInGroup}
                            className="tactile-btn p-1.5 rounded-lg border disabled:opacity-30 hover:bg-slate-100 cursor-pointer"
                            style={{
                              borderColor: 'var(--pluz-border)',
                              color: 'var(--pluz-muted)',
                            }}
                            title={
                              canReorder
                                ? `Subir dentro de ${item.frente}`
                                : 'Limpia la búsqueda para reordenar'
                            }
                            aria-label={`Subir ${item.valor}`}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveWithinGroup(item, 1)}
                            disabled={!canReorder || isLastInGroup}
                            className="tactile-btn p-1.5 rounded-lg border disabled:opacity-30 hover:bg-slate-100 cursor-pointer"
                            style={{
                              borderColor: 'var(--pluz-border)',
                              color: 'var(--pluz-muted)',
                            }}
                            title={
                              canReorder
                                ? `Bajar dentro de ${item.frente}`
                                : 'Limpia la búsqueda para reordenar'
                            }
                            aria-label={`Bajar ${item.valor}`}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item._uid)}
                            className="tactile-btn p-1.5 rounded-lg border hover:bg-red-50 cursor-pointer"
                            style={{
                              borderColor: 'var(--pluz-border)',
                              color: 'var(--pluz-danger)',
                            }}
                            title="Eliminar ítem"
                            aria-label={`Eliminar ${item.valor}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminCatalogsTab;
