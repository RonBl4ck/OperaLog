import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Download, Plus, Trash2, Upload } from 'lucide-react';
import { CatalogItem, FrontConfig, FrontType, TurnRow } from '../types/operalog';
import { createEmptyTurnRow } from '../services/gasClient';
import { parseExcelPaste } from '../utils/pasteParser';
import { downloadExcelTemplate, parseExcelWorkbook } from '../utils/excelTemplate';

interface FrontGridSectionProps {
  front: FrontConfig;
  rows: TurnRow[];
  fecha: string;
  contratista: string;
  catalogs: CatalogItem[];
  readOnly?: boolean;
  onChangeRows: (frontId: FrontType, updatedRows: TurnRow[]) => void;
  onPasteSuccess?: (count: number, frontLabel: string) => void;
  onExcelImportSuccess?: (count: number, frontLabel: string) => void;
  onExcelImportError?: (message: string, frontLabel: string) => void;
}

function isRowBlank(row: TurnRow, fixedActivity: string | null): boolean {
  const act = fixedActivity && row.actividad === fixedActivity ? '' : row.actividad;
  return (
    row.nombres.trim() === '' &&
    row.usuario_ssam.trim() === '' &&
    row.celular.trim() === '' &&
    act.trim() === '' &&
    row.skill.trim() === '' &&
    row.horario.trim() === ''
  );
}

export const FrontGridSection: React.FC<FrontGridSectionProps> = ({
  front,
  rows,
  fecha,
  contratista,
  catalogs,
  readOnly = false,
  onChangeRows,
  onPasteSuccess,
  onExcelImportSuccess,
  onExcelImportError,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const horarioOptions = useMemo(
    () =>
      catalogs
        .filter(
          (c) =>
            c.activo &&
            c.tipo === 'HORARIO' &&
            (c.frente === 'ALL' || c.frente === front.id),
        )
        .sort((a, b) => a.orden - b.orden)
        .map((c) => c.valor),
    [catalogs, front.id],
  );

  const activityOptions = useMemo(
    () =>
      catalogs
        .filter(
          (c) =>
            c.activo &&
            c.tipo === 'ACTIVIDAD' &&
            (c.frente === front.id || c.frente === 'ALL'),
        )
        .sort((a, b) => a.orden - b.orden)
        .map((c) => c.valor),
    [catalogs, front.id],
  );

  const skillOptions = useMemo(
    () =>
      catalogs
        .filter(
          (c) =>
            c.activo &&
            c.tipo === 'SKILL' &&
            (c.frente === front.id || c.frente === 'ALL'),
        )
        .sort((a, b) => a.orden - b.orden)
        .map((c) => c.valor),
    [catalogs, front.id],
  );

  const showActivityColumn = front.hasActivityDropdown || front.fixedActivity !== null;

  const handleAddRow = () => {
    if (readOnly) return;
    const newRow = createEmptyTurnRow(front.id, fecha, contratista, front.fixedActivity);
    onChangeRows(front.id, [...rows, newRow]);
    if (collapsed) {
      setCollapsed(false);
    }
  };

  const handleDeleteRow = (rowId: string) => {
    if (readOnly) return;
    onChangeRows(
      front.id,
      rows.filter((r) => r.id !== rowId),
    );
  };

  const handleFieldChange = (
    rowId: string,
    field: keyof Pick<
      TurnRow,
      'nombres' | 'usuario_ssam' | 'celular' | 'actividad' | 'skill' | 'horario'
    >,
    value: string,
  ) => {
    if (readOnly) return;
    onChangeRows(
      front.id,
      rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)),
    );
  };

  const handleApplyScheduleToBlock = (selectedHorario: string) => {
    if (readOnly || !selectedHorario || rows.length === 0) return;
    onChangeRows(
      front.id,
      rows.map((r) => ({ ...r, horario: selectedHorario })),
    );
  };

  const handleNombresPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    rowIndex: number,
  ) => {
    if (readOnly) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) {
      return;
    }

    e.preventDefault();
    const parsedRows = parseExcelPaste(text, front, { fecha, contratista });
    if (parsedRows.length === 0) return;

    const currentRow = rows[rowIndex];
    const shouldReplaceCurrent = currentRow && isRowBlank(currentRow, front.fixedActivity);

    const before = shouldReplaceCurrent
      ? rows.slice(0, rowIndex)
      : rows.slice(0, rowIndex + 1);
    const after = rows.slice(rowIndex + 1);

    onChangeRows(front.id, [...before, ...parsedRows, ...after]);
    onPasteSuccess?.(parsedRows.length, front.label);
  };

  const handleDownloadTemplate = () => {
    void downloadExcelTemplate(front, catalogs);
  };

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) {
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const parsedRows = parseExcelWorkbook(
        buffer,
        front,
        { fecha, contratista },
        catalogs,
      );

      if (parsedRows.length === 0) {
        onExcelImportError?.(
          'No se encontraron registros válidos en el archivo Excel. La tabla actual no fue modificada.',
          front.label,
        );
        return;
      }

      onChangeRows(front.id, parsedRows);
      if (collapsed) {
        setCollapsed(false);
      }
      onExcelImportSuccess?.(parsedRows.length, front.label);
    } catch (err) {
      onExcelImportError?.(
        err instanceof Error ? err.message : 'No se pudo leer el archivo Excel.',
        front.label,
      );
    } finally {
      e.target.value = '';
    }
  };

  const inputBaseClass =
    'w-full rounded border bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3C5A9F]/25 focus:border-[#3C5A9F] disabled:bg-slate-50 disabled:text-slate-600 disabled:cursor-not-allowed';

  return (
    <section
      className="rounded-xl border shadow-xs overflow-hidden"
      style={{
        backgroundColor: 'var(--pluz-surface)',
        borderColor: 'var(--pluz-border)',
      }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b bg-slate-50/70" style={{ borderColor: 'var(--pluz-border)' }}>
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          className="flex items-center gap-2.5 text-left focus:outline-none group"
        >
          <span className="text-slate-500 group-hover:text-slate-800">
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </span>
          <h3 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--pluz-ink)' }}>
            {front.label}
          </h3>
          <span
            className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--pluz-primary)' }}
          >
            {rows.length}
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            <select
              aria-label={`Aplicar horario a todo el bloque ${front.label}`}
              value=""
              disabled={readOnly || rows.length === 0 || horarioOptions.length === 0}
              onChange={(e) => {
                handleApplyScheduleToBlock(e.target.value);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-[#3C5A9F]"
            >
              <option value="" disabled>
                Aplicar horario a todo el bloque
              </option>
              {horarioOptions.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          {front.supportsExcelTemplate && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                aria-label={`Cargar archivo Excel para ${front.label}`}
                disabled={readOnly}
                onChange={handleExcelFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleDownloadTemplate}
                title={`Descargar plantilla Excel para ${front.label}`}
                className="tactile-btn inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Plantilla
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={readOnly}
                title={`Cargar Excel para llenar ${front.label}`}
                className="tactile-btn inline-flex items-center gap-1 rounded-lg border border-emerald-600/30 bg-emerald-50/70 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100/70 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-3.5 h-3.5" />
                Cargar Excel
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleAddRow}
            disabled={readOnly}
            className="tactile-btn inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-[#3C5A9F] border-[#3C5A9F]/30 bg-white hover:bg-[#3C5A9F]/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            Fila
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="overflow-x-auto">
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--pluz-muted)' }}>
              {readOnly ? (
                <>Sin personal asignado en {front.label}.</>
              ) : (
                <>
                  Sin personal asignado en {front.label}. Haz clic en <strong>+ Fila</strong> para agregar o pega directamente desde Excel.
                </>
              )}
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500" style={{ borderColor: 'var(--pluz-border)' }}>
                  <th className="py-2 pl-4 pr-2 w-10">#</th>
                  <th className="py-2 px-2 min-w-[200px]">Nombres</th>
                  {front.hasSsam && (
                    <th className="py-2 px-2 min-w-[140px]">
                      Usuario SSAM <span className="text-[#E63946]">*</span>
                    </th>
                  )}
                  <th className="py-2 px-2 min-w-[125px]">Celular</th>
                  {showActivityColumn && (
                    <th className="py-2 px-2 min-w-[160px]">Actividad</th>
                  )}
                  {front.hasSkill && (
                    <th className="py-2 px-2 min-w-[180px]">Skill</th>
                  )}
                  <th className="py-2 px-2 min-w-[155px]">
                    Horario <span className="text-[#E63946]">*</span>
                  </th>
                  <th className="py-2 pl-2 pr-4 w-12 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => {
                  const missingSsam = front.hasSsam && row.usuario_ssam.trim() === '';
                  const missingHorario = row.horario.trim() === '';

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/60">
                      <td className="py-2 pl-4 pr-2 text-xs font-medium text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>

                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={row.nombres}
                          disabled={readOnly}
                          placeholder={readOnly ? '' : 'Apellidos y Nombres (Ctrl+V Excel)'}
                          onChange={(e) =>
                            handleFieldChange(row.id, 'nombres', e.target.value)
                          }
                          onPaste={(e) => handleNombresPaste(e, idx)}
                          className={`${inputBaseClass} border-slate-200`}
                        />
                      </td>

                      {front.hasSsam && (
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={row.usuario_ssam}
                            disabled={readOnly}
                            placeholder={readOnly ? '' : 'Usuario SSAM'}
                            onChange={(e) =>
                              handleFieldChange(row.id, 'usuario_ssam', e.target.value)
                            }
                            aria-invalid={missingSsam}
                            className={`${inputBaseClass} ${
                              missingSsam
                                ? 'border-[#E63946]/70 bg-red-50/30'
                                : 'border-slate-200'
                            }`}
                          />
                        </td>
                      )}

                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={row.celular}
                          disabled={readOnly}
                          placeholder={readOnly ? '' : '999999999'}
                          onChange={(e) =>
                            handleFieldChange(row.id, 'celular', e.target.value)
                          }
                          className={`${inputBaseClass} border-slate-200 tabular-nums`}
                        />
                      </td>

                      {showActivityColumn && (
                        <td className="py-1.5 px-2">
                          {front.hasActivityDropdown ? (
                            <select
                              value={row.actividad}
                              disabled={readOnly}
                              onChange={(e) =>
                                handleFieldChange(row.id, 'actividad', e.target.value)
                              }
                              className={`${inputBaseClass} border-slate-200`}
                            >
                              <option value="">Seleccionar...</option>
                              {activityOptions.map((act) => (
                                <option key={act} value={act}>
                                  {act}
                                </option>
                              ))}
                              {row.actividad && !activityOptions.includes(row.actividad) && (
                                <option value={row.actividad}>{row.actividad}</option>
                              )}
                            </select>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {front.fixedActivity}
                            </span>
                          )}
                        </td>
                      )}

                      {front.hasSkill && (
                        <td className="py-1.5 px-2">
                          <select
                            value={row.skill}
                            disabled={readOnly}
                            onChange={(e) =>
                              handleFieldChange(row.id, 'skill', e.target.value)
                            }
                            className={`${inputBaseClass} border-slate-200`}
                          >
                            <option value="">Seleccionar...</option>
                            {skillOptions.map((sk) => (
                              <option key={sk} value={sk}>
                                {sk}
                              </option>
                            ))}
                            {row.skill && !skillOptions.includes(row.skill) && (
                              <option value={row.skill}>{row.skill}</option>
                            )}
                          </select>
                        </td>
                      )}

                      <td className="py-1.5 px-2">
                        <select
                          value={row.horario}
                          disabled={readOnly}
                          onChange={(e) =>
                            handleFieldChange(row.id, 'horario', e.target.value)
                          }
                          aria-invalid={missingHorario}
                          className={`${inputBaseClass} ${
                            missingHorario
                              ? 'border-[#E63946]/70 bg-red-50/30'
                              : 'border-slate-200'
                          }`}
                        >
                          <option value="">Seleccionar...</option>
                          {horarioOptions.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                          {row.horario && !horarioOptions.includes(row.horario) && (
                            <option value={row.horario}>{row.horario}</option>
                          )}
                        </select>
                      </td>

                      <td className="py-1.5 pl-2 pr-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          disabled={readOnly}
                          aria-label={`Eliminar fila ${idx + 1} de ${front.label}`}
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-[#E63946] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
};

export default FrontGridSection;
