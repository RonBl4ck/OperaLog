import React, { useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  AlertCircle,
} from 'lucide-react';
import {
  FRONT_CONFIGS,
  type FrontType,
  type ToastMessage,
  type TurnRow,
} from '../types/operalog';

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
}

function escapeCsvCell(value: string): string {
  const s = value ?? '';
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

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
}) => {
  const [selectedFront, setSelectedFront] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

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
      if (selectedContrata !== 'ALL' && r.contratista !== selectedContrata) return false;
      if (selectedFront !== 'ALL' && r.frente !== selectedFront) return false;
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
  }, [rows, selectedContrata, selectedFront, search]);

  const handleExportCsv = () => {
    if (filteredRows.length === 0) {
      onToast({
        type: 'info',
        title: 'Sin datos para exportar',
        description: 'No hay registros que coincidan con los filtros actuales.',
      });
      return;
    }

    const headers = [
      'Fecha',
      'Contratista',
      'Frente',
      'Nombres',
      'Usuario SSAM',
      'Celular',
      'Actividad',
      'Skill',
      'Horario',
    ];

    const lines = [
      headers.join(','),
      ...filteredRows.map((r) =>
        [
          r.fecha,
          r.contratista,
          r.frente,
          r.nombres,
          r.usuario_ssam,
          r.celular,
          r.actividad,
          r.skill,
          r.horario,
        ]
          .map(escapeCsvCell)
          .join(','),
      ),
    ];

    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `OperaLog_${fecha}_${selectedContrata}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const frontLabelMap = useMemo(() => {
    const map = new Map<FrontType, string>();
    for (const cfg of FRONT_CONFIGS) map.set(cfg.id, cfg.label);
    return map;
  }, []);

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
            {/* Fecha */}
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

            {/* Contratista */}
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
                {contratas.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            {/* Frente */}
            <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--pluz-muted)' }}>
              <Filter className="w-4 h-4" style={{ color: 'var(--pluz-primary)' }} />
              <span>Frente:</span>
              <select
                value={selectedFront}
                onChange={(e) => setSelectedFront(e.target.value)}
                className="px-2.5 py-1.5 text-sm rounded-lg border outline-none"
                style={{
                  borderColor: 'var(--pluz-border)',
                  color: 'var(--pluz-ink)',
                  backgroundColor: 'var(--pluz-surface)',
                }}
              >
                <option value="ALL">Todos los frentes</option>
                {FRONT_CONFIGS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
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
              onClick={handleExportCsv}
              className="tactile-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer shrink-0"
              style={{ backgroundColor: 'var(--pluz-primary)' }}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* Compliance Summary Pills */}
        <div
          className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2"
          style={{ borderColor: 'var(--pluz-border)' }}
        >
          <span className="inline-flex items-center gap-1 text-xs font-semibold mr-1" style={{ color: 'var(--pluz-muted)' }}>
            <Eye className="w-3.5 h-3.5" />
            Cumplimiento del día (Solo lectura):
          </span>
          {complianceByContrata.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() =>
                onSelectedContrataChange(selectedContrata === item.name ? 'ALL' : item.name)
              }
              className="tactile-btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer"
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
          ))}
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
        ) : filteredRows.length === 0 ? (
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
                  <th className="py-2.5 px-3">Contratista</th>
                  <th className="py-2.5 px-3">Frente</th>
                  <th className="py-2.5 px-3">Nombres</th>
                  <th className="py-2.5 px-3">Usuario SSAM</th>
                  <th className="py-2.5 px-3">Celular</th>
                  <th className="py-2.5 px-3">Actividad</th>
                  <th className="py-2.5 px-3">Skill</th>
                  <th className="py-2.5 px-3">Horario</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--pluz-border)' }}>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-semibold text-xs" style={{ color: 'var(--pluz-primary)' }}>
                      {row.contratista}
                    </td>
                    <td className="py-2 px-3 text-xs font-medium" style={{ color: 'var(--pluz-ink)' }}>
                      {frontLabelMap.get(row.frente) ?? row.frente}
                    </td>
                    <td className="py-2 px-3 font-medium" style={{ color: 'var(--pluz-ink)' }}>
                      {row.nombres}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs" style={{ color: 'var(--pluz-muted)' }}>
                      {row.usuario_ssam || '—'}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs" style={{ color: 'var(--pluz-muted)' }}>
                      {row.celular || '—'}
                    </td>
                    <td className="py-2 px-3 text-xs" style={{ color: 'var(--pluz-ink)' }}>
                      {row.actividad || '—'}
                    </td>
                    <td className="py-2 px-3 text-xs" style={{ color: 'var(--pluz-ink)' }}>
                      {row.skill || '—'}
                    </td>
                    <td className="py-2 px-3">
                      {row.horario ? (
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
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
