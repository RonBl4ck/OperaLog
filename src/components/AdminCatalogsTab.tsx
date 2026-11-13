import React, { useState, useEffect } from 'react';
import {
  Plus,
  Save,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wrench,
  Briefcase,
  ShieldAlert,
} from 'lucide-react';
import { saveCatalog } from '../services/gasClient';
import { FRONT_CONFIGS, type CatalogItem, type UserSession } from '../types/operalog';

type CatalogTipo = CatalogItem['tipo'];

export interface AdminCatalogsTabProps {
  catalog: CatalogItem[];
  onCatalogSaved: (updatedCatalog: CatalogItem[]) => void;
  user?: UserSession;
}

const TIPO_TABS: { id: CatalogTipo; label: string; icon: typeof Clock }[] = [
  { id: 'HORARIO', label: 'Horarios', icon: Clock },
  { id: 'SKILL', label: 'Skills', icon: Wrench },
  { id: 'ACTIVIDAD', label: 'Actividades', icon: Briefcase },
];

const FRENTE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'ALL (Todos los frentes)' },
  ...FRONT_CONFIGS.map((f) => ({ value: f.id, label: f.id })),
];

export function AdminCatalogsTab({
  catalog,
  onCatalogSaved,
  user,
}: AdminCatalogsTabProps) {
  const [items, setItems] = useState<CatalogItem[]>(catalog);
  const [activeTipo, setActiveTipo] = useState<CatalogTipo>('HORARIO');

  // Add item form state
  const [newTipo, setNewTipo] = useState<CatalogTipo>('HORARIO');
  const [newFrente, setNewFrente] = useState<string>('ALL');
  const [newValor, setNewValor] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    setItems(catalog);
    setIsDirty(false);
  }, [catalog]);

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

  const handleSelectTipoTab = (tipo: CatalogTipo) => {
    setActiveTipo(tipo);
    setNewTipo(tipo);
    if (tipo === 'HORARIO') {
      setNewFrente('ALL');
    } else if (newFrente === 'ALL') {
      setNewFrente('RECLAMOS');
    }
  };

  const handleFormTipoChange = (tipo: CatalogTipo) => {
    setNewTipo(tipo);
    if (tipo === 'HORARIO') {
      setNewFrente('ALL');
    } else if (newFrente === 'ALL') {
      setNewFrente('RECLAMOS');
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newValor.trim();
    if (!trimmed) {
      setFeedback({ type: 'error', message: 'Ingresa un valor para el nuevo ítem.' });
      return;
    }

    const exists = items.some(
      (it) =>
        it.tipo === newTipo &&
        it.frente === newFrente &&
        it.valor.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setFeedback({
        type: 'error',
        message: `Ya existe "${trimmed}" en ${newTipo} (${newFrente}).`,
      });
      return;
    }

    const sameTipoItems = items.filter((it) => it.tipo === newTipo);
    const maxOrden = sameTipoItems.reduce((max, it) => Math.max(max, it.orden), 0);

    const newItem: CatalogItem = {
      tipo: newTipo,
      frente: newTipo === 'HORARIO' ? 'ALL' : newFrente,
      valor: trimmed,
      orden: maxOrden + 1,
      activo: true,
    };

    setItems((prev) => [...prev, newItem]);
    setNewValor('');
    setActiveTipo(newTipo);
    setIsDirty(true);
    setFeedback(null);
  };

  const handleToggleActivo = (target: CatalogItem) => {
    setItems((prev) =>
      prev.map((it) =>
        it.tipo === target.tipo && it.frente === target.frente && it.valor === target.valor
          ? { ...it, activo: !it.activo }
          : it
      )
    );
    setIsDirty(true);
    setFeedback(null);
  };

  const handleDelete = (target: CatalogItem) => {
    setItems((prev) =>
      prev.filter(
        (it) =>
          !(it.tipo === target.tipo && it.frente === target.frente && it.valor === target.valor)
      )
    );
    setIsDirty(true);
    setFeedback(null);
  };

  const filteredItems = items
    .filter((it) => it.tipo === activeTipo)
    .slice()
    .sort((a, b) => a.orden - b.orden);

  const handleMove = (index: number, direction: -1 | 1) => {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= filteredItems.length) return;

    const reordered = [...filteredItems];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(swapIndex, 0, moved);

    const updatedOrders = new Map<string, number>();
    reordered.forEach((it, idx) => {
      updatedOrders.set(`${it.tipo}|${it.frente}|${it.valor}`, idx + 1);
    });

    setItems((prev) =>
      prev.map((it) => {
        const key = `${it.tipo}|${it.frente}|${it.valor}`;
        const newOrden = updatedOrders.get(key);
        return newOrden !== undefined ? { ...it, orden: newOrden } : it;
      })
    );
    setIsDirty(true);
    setFeedback(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const result = await saveCatalog(items);
      onCatalogSaved(result.items);
      setIsDirty(false);
      setFeedback({
        type: 'success',
        message: 'Catálogos guardados correctamente.',
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

  return (
    <div className="space-y-6">
      {/* Header & Save Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--pluz-ink)' }}>
            Administración de Catálogos
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--pluz-muted)' }}>
            Configura horarios, skills y actividades disponibles para el registro de turnos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isDirty && (
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: 'rgba(251, 193, 64, 0.2)',
                color: '#92610A',
              }}
            >
              Cambios sin guardar
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="tactile-btn inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white shadow-xs disabled:opacity-60 cursor-pointer"
            style={{ backgroundColor: 'var(--pluz-primary)' }}
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Guardando...' : 'Guardar Catálogos'}</span>
          </button>
        </div>
      </div>

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

      {/* Add New Item Form */}
      <form
        onSubmit={handleAddItem}
        className="rounded-xl border p-4 sm:p-5 shadow-2xs"
        style={{
          backgroundColor: 'var(--pluz-surface)',
          borderColor: 'var(--pluz-border)',
        }}
      >
        <h3
          className="text-xs font-bold uppercase tracking-wider mb-3"
          style={{ color: 'var(--pluz-muted)' }}
        >
          Agregar Nuevo Ítem
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-3">
            <label
              htmlFor="cat-tipo"
              className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--pluz-ink)' }}
            >
              Tipo
            </label>
            <select
              id="cat-tipo"
              value={newTipo}
              onChange={(e) => handleFormTipoChange(e.target.value as CatalogTipo)}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style={{
                borderColor: 'var(--pluz-border)',
                backgroundColor: 'var(--pluz-surface)',
                color: 'var(--pluz-ink)',
              }}
            >
              <option value="HORARIO">HORARIO</option>
              <option value="SKILL">SKILL</option>
              <option value="ACTIVIDAD">ACTIVIDAD</option>
            </select>
          </div>

          <div className="sm:col-span-4">
            <label
              htmlFor="cat-frente"
              className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--pluz-ink)' }}
            >
              Frente
            </label>
            <select
              id="cat-frente"
              value={newTipo === 'HORARIO' ? 'ALL' : newFrente}
              disabled={newTipo === 'HORARIO'}
              onChange={(e) => setNewFrente(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none disabled:opacity-60"
              style={{
                borderColor: 'var(--pluz-border)',
                backgroundColor: 'var(--pluz-surface)',
                color: 'var(--pluz-ink)',
              }}
            >
              {FRENTE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <label
              htmlFor="cat-valor"
              className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--pluz-ink)' }}
            >
              Valor
            </label>
            <input
              id="cat-valor"
              type="text"
              value={newValor}
              onChange={(e) => setNewValor(e.target.value)}
              placeholder={
                newTipo === 'HORARIO'
                  ? 'ej. 19:00 - 07:00'
                  : newTipo === 'SKILL'
                  ? 'ej. MT / BT'
                  : 'ej. DESPACHO BT'
              }
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
              <span>+ Agregar</span>
            </button>
          </div>
        </div>
      </form>

      {/* Filter Tabs + Table */}
      <div
        className="rounded-xl border overflow-hidden shadow-2xs"
        style={{
          backgroundColor: 'var(--pluz-surface)',
          borderColor: 'var(--pluz-border)',
        }}
      >
        {/* Tipo Tabs */}
        <div
          className="flex items-center gap-1 px-4 pt-3 border-b overflow-x-auto"
          style={{
            borderColor: 'var(--pluz-border)',
            backgroundColor: 'var(--pluz-bg)',
          }}
        >
          {TIPO_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTipo === tab.id;
            const count = items.filter((it) => it.tipo === tab.id).length;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTipoTab(tab.id)}
                className="tactile-btn inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 cursor-pointer whitespace-nowrap"
                style={{
                  borderColor: isActive ? 'var(--pluz-primary)' : 'transparent',
                  backgroundColor: isActive ? 'var(--pluz-surface)' : 'transparent',
                  color: isActive ? 'var(--pluz-primary)' : 'var(--pluz-muted)',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
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
                <th className="py-2.5 px-4">Frente</th>
                <th className="py-2.5 px-4">Valor</th>
                <th className="py-2.5 px-4 w-28">Estado</th>
                <th className="py-2.5 px-4 w-32 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--pluz-border)' }}>
              {filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-sm"
                    style={{ color: 'var(--pluz-muted)' }}
                  >
                    No hay ítems registrados en {activeTipo}.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr
                    key={`${item.tipo}-${item.frente}-${item.valor}`}
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
                    <td
                      className="py-2.5 px-4 text-sm font-medium"
                      style={{
                        color: item.activo ? 'var(--pluz-ink)' : 'var(--pluz-muted)',
                        textDecoration: item.activo ? 'none' : 'line-through',
                      }}
                    >
                      {item.valor}
                    </td>
                    <td className="py-2.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleActivo(item)}
                        className="tactile-btn text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer"
                        style={{
                          backgroundColor: item.activo
                            ? 'rgba(108, 171, 94, 0.14)'
                            : 'rgba(100, 116, 139, 0.14)',
                          color: item.activo ? 'var(--pluz-success)' : 'var(--pluz-muted)',
                        }}
                      >
                        {item.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleMove(idx, -1)}
                          disabled={idx === 0}
                          className="tactile-btn p-1.5 rounded-lg border disabled:opacity-30 hover:bg-slate-100 cursor-pointer"
                          style={{
                            borderColor: 'var(--pluz-border)',
                            color: 'var(--pluz-muted)',
                          }}
                          title="Subir"
                          aria-label={`Subir ${item.valor}`}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(idx, 1)}
                          disabled={idx === filteredItems.length - 1}
                          className="tactile-btn p-1.5 rounded-lg border disabled:opacity-30 hover:bg-slate-100 cursor-pointer"
                          style={{
                            borderColor: 'var(--pluz-border)',
                            color: 'var(--pluz-muted)',
                          }}
                          title="Bajar"
                          aria-label={`Bajar ${item.valor}`}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="tactile-btn p-1.5 rounded-lg border hover:bg-red-50 cursor-pointer"
                          style={{
                            borderColor: 'var(--pluz-border)',
                            color: 'var(--pluz-danger)',
                          }}
                          title="Eliminar"
                          aria-label={`Eliminar ${item.valor}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminCatalogsTab;
