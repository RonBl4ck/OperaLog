import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Calendar,
  ClipboardPaste,
  Copy,
  Download,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Upload,
} from 'lucide-react';
import {
  CatalogItem,
  ContrataMeta,
  FRONT_CONFIGS,
  FrontType,
  getActiveFrontConfigs,
  matchesGroupCatalog,
  normalizeGroup,
  ToastMessage,
  TurnRow,
  UserGroupScope,
  UserSession,
} from '../types/operalog';
import {
  getLastTurn,
  getTodayIsoDate,
  getTurn,
  isPastIsoDate,
  saveTurn,
} from '../services/gasClient';
import {
  downloadGeneralExcelTemplate,
  parseGeneralExcelWorkbook,
} from '../utils/excelTemplate';
import { FrontGridSection } from './FrontGridSection';

interface OperationsTabProps {
  user: UserSession;
  catalogs: CatalogItem[];
  contratas?: string[];
  contratasMeta?: ContrataMeta[];
  initialFecha?: string;
  onToast: (toast: Omit<ToastMessage, 'id'>) => void;
  onRowsChange?: (rows: TurnRow[], fecha: string) => void;
}

const contrataSessionCache = new Map<string, TurnRow[]>();

export function clearOperationsCache(): void {
  contrataSessionCache.clear();
}

export const OperationsTab: React.FC<OperationsTabProps> = ({
  user,
  catalogs,
  contratas = ['ALFA', 'BETA'],
  contratasMeta,
  initialFecha,
  onToast,
  onRowsChange,
}) => {
  const isAdmin = user.rol === 'ADMIN';
  const availableContratas = useMemo(
    () => (contratas.length > 0 ? contratas : ['ALFA', 'BETA']),
    [contratas],
  );

  const [fecha, setFecha] = useState<string>(() => initialFecha ?? getTodayIsoDate());
  const [contratista, setContratista] = useState<string>(() =>
    isAdmin ? availableContratas[0] : user.contratista,
  );
  const initialCacheKey = `${initialFecha ?? getTodayIsoDate()}__${
    isAdmin ? availableContratas[0] : user.contratista
  }`;
  const [rows, setRows] = useState<TurnRow[]>(
    () => contrataSessionCache.get(initialCacheKey) ?? [],
  );
  const hydratedKeyRef = useRef<string | null>(
    contrataSessionCache.has(initialCacheKey) ? initialCacheKey : null,
  );
  const [loadingTurn, setLoadingTurn] = useState<boolean>(false);
  const [cloning, setCloning] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const generalFileInputRef = useRef<HTMLInputElement | null>(null);
  const isPastDate = isPastIsoDate(fecha);

  const activeGroup: UserGroupScope = useMemo(() => {
    if (!isAdmin) {
      return normalizeGroup(user.grupo, 'BT');
    }
    return (
      contratasMeta?.find((c) => c.nombre === contratista)?.grupo ??
      normalizeGroup(user.grupo, 'BT')
    );
  }, [isAdmin, user.grupo, contratasMeta, contratista]);

  const groupCatalogs = useMemo(
    () => catalogs.filter((c) => matchesGroupCatalog(c.grupo, activeGroup)),
    [catalogs, activeGroup],
  );

  const activeFronts = useMemo(
    () => getActiveFrontConfigs(catalogs, activeGroup),
    [catalogs, activeGroup],
  );

  // Keep non-admin locked to their contratista
  useEffect(() => {
    if (!isAdmin) {
      setContratista(user.contratista);
    } else if (!availableContratas.includes(contratista)) {
      setContratista(availableContratas[0]);
    }
  }, [isAdmin, user.contratista, availableContratas, contratista]);

  const loadTurn = useCallback(
    async (force = false) => {
      const cacheKey = `${fecha}__${contratista}`;
      if (!force && contrataSessionCache.has(cacheKey)) {
        hydratedKeyRef.current = cacheKey;
        setRows(contrataSessionCache.get(cacheKey)!);
        return;
      }
      setLoadingTurn(true);
      try {
        const data = await getTurn(fecha, contratista, user.rol);
        contrataSessionCache.set(cacheKey, data);
        hydratedKeyRef.current = cacheKey;
        setRows(data);
      } catch (err) {
        onToast({
          type: 'error',
          title: 'Error al cargar turno',
          description: err instanceof Error ? err.message : 'Intente nuevamente.',
        });
      } finally {
        setLoadingTurn(false);
      }
    },
    [fecha, contratista, user.rol, onToast],
  );

  useEffect(() => {
    void loadTurn(false);
  }, [loadTurn]);

  useEffect(() => {
    const cacheKey = `${fecha}__${contratista}`;
    if (hydratedKeyRef.current !== cacheKey) return;
    contrataSessionCache.set(cacheKey, rows);
    onRowsChange?.(rows, fecha);
  }, [rows, fecha, contratista, onRowsChange]);

  const rowsByFront = useMemo(() => {
    const grouped = new Map<FrontType, TurnRow[]>();
    for (const cfg of FRONT_CONFIGS) {
      grouped.set(cfg.id, []);
    }
    for (const row of rows) {
      const bucket = grouped.get(row.frente);
      if (bucket) {
        bucket.push(row);
      }
    }
    return grouped;
  }, [rows]);

  const handleFrontRowsChange = useCallback(
    (frontId: FrontType, updatedFrontRows: TurnRow[]) => {
      if (isPastDate) return;
      setRows((prev) => {
        const others = prev.filter((r) => r.frente !== frontId);
        return [...others, ...updatedFrontRows];
      });
    },
    [isPastDate],
  );

  const handleGeneralExcelUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (isPastDate) {
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const parsedByFront = parseGeneralExcelWorkbook(
        buffer,
        { fecha, contratista },
        groupCatalogs,
        activeGroup,
      );
      const updatedFrontIds = Object.keys(parsedByFront) as FrontType[];

      if (updatedFrontIds.length === 0) {
        onToast({
          type: 'info',
          title: 'Sin tablas con datos',
          description:
            'Ninguna hoja del Excel contenía filas con datos. Las tablas actuales se mantuvieron sin cambios.',
        });
        return;
      }

      setRows((prev) => {
        const preserved = prev.filter((r) => !updatedFrontIds.includes(r.frente));
        const incoming = updatedFrontIds.flatMap(
          (frontId) => parsedByFront[frontId] ?? [],
        );
        return [...preserved, ...incoming];
      });

      const summary = updatedFrontIds
        .map((id) => {
          const label = FRONT_CONFIGS.find((f) => f.id === id)?.label ?? id;
          return `${label} (${parsedByFront[id]?.length ?? 0})`;
        })
        .join(', ');

      onToast({
        type: 'success',
        title: 'Plantilla general cargada',
        description: `Se reemplazaron: ${summary}. Las hojas vacías no modificaron sus tablas.`,
      });
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Error al cargar Excel general',
        description:
          err instanceof Error ? err.message : 'No se pudo leer el archivo.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleCloneLastTurn = async () => {
    if (isPastDate) {
      onToast({
        type: 'error',
        title: 'Registro bloqueado',
        description: 'No se pueden modificar registros de días anteriores.',
      });
      return;
    }
    setCloning(true);
    try {
      const cloned = await getLastTurn(fecha, contratista);
      if (cloned.length === 0) {
        onToast({
          type: 'info',
          title: 'Sin turno previo',
          description: `No se encontró un turno anterior para ${contratista} antes del ${fecha}.`,
        });
        return;
      }
      setRows(cloned);
      onToast({
        type: 'success',
        title: 'Turno clonado',
        description: `Se cargaron ${cloned.length} registros del último turno de ${contratista}.`,
      });
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Error al clonar turno',
        description: err instanceof Error ? err.message : 'Intente nuevamente.',
      });
    } finally {
      setCloning(false);
    }
  };

  const handleSaveTurn = async () => {
    if (isPastDate) {
      onToast({
        type: 'error',
        title: 'Registro bloqueado',
        description: 'No se pueden modificar ni guardar registros de días anteriores.',
      });
      return;
    }
    const nonEmptyRows = rows.filter((r) => {
      const cfg = FRONT_CONFIGS.find((c) => c.id === r.frente);
      const act = cfg?.fixedActivity && r.actividad === cfg.fixedActivity ? '' : r.actividad;
      return (
        r.nombres.trim() !== '' ||
        r.usuario_ssam.trim() !== '' ||
        r.celular.trim() !== '' ||
        act.trim() !== '' ||
        r.skill.trim() !== '' ||
        r.horario.trim() !== ''
      );
    });

    for (const row of nonEmptyRows) {
      const cfg = FRONT_CONFIGS.find((c) => c.id === row.frente);
      if (row.horario.trim() === '') {
        onToast({
          type: 'error',
          title: 'Campos requeridos incompletos',
          description: `Falta seleccionar Horario en ${cfg?.label ?? row.frente} (${row.nombres || 'fila sin nombre'}).`,
        });
        return;
      }
    }

    setSaving(true);
    try {
      const normalized = nonEmptyRows.map((row) => {
        const cfg = FRONT_CONFIGS.find((c) => c.id === row.frente);
        return {
          ...row,
          fecha,
          contratista,
          actividad: cfg?.fixedActivity ?? row.actividad,
        };
      });

      const res = await saveTurn({
        fecha,
        contratista,
        rows: normalized,
        usuario: user.usuario,
        grupo: activeGroup === 'ALL' ? undefined : activeGroup,
      });

      setRows(normalized);
      onToast({
        type: 'success',
        title: 'Turno guardado',
        description: `${res.savedCount} registros guardados para ${contratista} (${fecha}).`,
      });
    } catch (err) {
      onToast({
        type: 'error',
        title: 'Error al guardar turno',
        description: err instanceof Error ? err.message : 'Intente nuevamente.',
      });
    } finally {
      setSaving(false);
    }
  };

  const totalCount = rows.length;

  return (
    <div className="space-y-4">
      {/* Top Control Bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 shadow-xs"
        style={{
          backgroundColor: 'var(--pluz-surface)',
          borderColor: 'var(--pluz-border)',
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker */}
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Fecha:</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3C5A9F]/25 focus:border-[#3C5A9F]"
            />
          </label>

          {/* Contratista Selector */}
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span>Contrata:</span>
            {isAdmin ? (
              <select
                aria-label="Seleccionar contratista"
                value={contratista}
                onChange={(e) => setContratista(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3C5A9F]/25 focus:border-[#3C5A9F]"
              >
                {availableContratas.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
                {contratista}
              </span>
            )}
          </div>

          <span className="text-xs font-medium text-slate-500 tabular-nums">
            Total personal: <strong className="text-slate-800">{totalCount}</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={generalFileInputRef}
            type="file"
            accept=".xlsx,.xls"
            aria-label="Cargar plantilla Excel general"
            disabled={isPastDate}
            onChange={handleGeneralExcelUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => void downloadGeneralExcelTemplate(groupCatalogs, activeGroup)}
            disabled={loadingTurn || saving}
            className="tactile-btn inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            title="Descargar plantilla Excel general (Despachadores, Reclamos, Teko y Reparaciones con desplegables)"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Plantilla general</span>
          </button>

          <button
            type="button"
            onClick={() => generalFileInputRef.current?.click()}
            disabled={loadingTurn || saving || isPastDate}
            className="tactile-btn inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-50/70 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100/70 disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              isPastDate
                ? 'Bloqueado para días anteriores'
                : 'Cargar plantilla Excel general (solo reemplaza las hojas con datos)'
            }
          >
            <Upload className="w-4 h-4" />
            <span>Cargar Excel</span>
          </button>

          <button
            type="button"
            onClick={() => void loadTurn(true)}
            disabled={loadingTurn || saving}
            className="tactile-btn inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            title="Recargar datos desde Google Sheets"
          >
            <RefreshCw className={`w-4 h-4 ${loadingTurn ? 'animate-spin' : ''}`} />
            <span>Recargar</span>
          </button>

          <button
            type="button"
            onClick={handleCloneLastTurn}
            disabled={cloning || loadingTurn || saving || isPastDate}
            className="tactile-btn inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isPastDate ? 'Bloqueado para días anteriores' : undefined}
          >
            {cloning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Copy className="w-4 h-4 text-slate-500" />
            )}
            Clonar último turno
          </button>

          <button
            type="button"
            onClick={handleSaveTurn}
            disabled={saving || loadingTurn || cloning || isPastDate}
            style={{ backgroundColor: 'var(--pluz-primary)' }}
            className="tactile-btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            title={isPastDate ? 'Bloqueado para días anteriores' : undefined}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Guardando...' : 'Guardar Turno'}
          </button>
        </div>
      </div>

      {/* Read-only Past Date Banner or Excel Paste Tip Banner */}
      {isPastDate ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs sm:text-sm text-amber-900"
        >
          <Lock className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" />
          <p>
            <strong>Registro bloqueado (solo lectura):</strong> No se pueden modificar, importar ni guardar registros de días anteriores ({fecha}).
          </p>
        </div>
      ) : (
        <div
          className="flex items-start gap-3 rounded-xl border px-4 py-3 text-xs sm:text-sm"
          style={{
            backgroundColor: '#EEF2FF',
            borderColor: '#C7D2FE',
            color: '#1E3A8A',
          }}
        >
          <ClipboardPaste className="w-4 h-4 mt-0.5 shrink-0 text-[#3C5A9F]" />
          <p>
            <strong>Pegado rápido desde Excel:</strong> Copia tus filas en Excel y presiona{' '}
            <kbd className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs font-semibold border border-indigo-200">
              Ctrl+V
            </kbd>{' '}
            directamente sobre el campo <strong>Nombres</strong> de cualquier bloque para importar múltiples técnicos automáticamente.
          </p>
        </div>
      )}

      {/* 7 Front Grid Sections */}
      {loadingTurn ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border bg-white py-12 text-sm text-slate-500" style={{ borderColor: 'var(--pluz-border)' }}>
          <Loader2 className="w-4 h-4 animate-spin text-[#3C5A9F]" />
          Cargando turno de {contratista} ({fecha})...
        </div>
      ) : (
        <div className="space-y-4">
          {activeFronts.map((front) => (
            <FrontGridSection
              key={front.id}
              front={front}
              rows={rowsByFront.get(front.id) ?? []}
              fecha={fecha}
              contratista={contratista}
              catalogs={groupCatalogs}
              readOnly={isPastDate}
              onChangeRows={handleFrontRowsChange}
              onPasteSuccess={(count, frontLabel) =>
                onToast({
                  type: 'info',
                  title: 'Filas importadas desde Excel',
                  description: `Se agregaron ${count} registros en ${frontLabel}.`,
                })
              }
              onExcelImportSuccess={(count, frontLabel) =>
                onToast({
                  type: 'success',
                  title: 'Plantilla Excel cargada',
                  description: `Se cargaron ${count} registros en ${frontLabel}.`,
                })
              }
              onExcelImportError={(message, frontLabel) =>
                onToast({
                  type: 'error',
                  title: `Error al cargar Excel (${frontLabel})`,
                  description: message,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default OperationsTab;
