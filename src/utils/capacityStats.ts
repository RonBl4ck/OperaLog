import { FRONT_CONFIGS, type FrontType, type TurnRow } from '../types/operalog';

export interface FrontStat {
  frente: string;
  count: number;
  isField: boolean;
}

export interface SkillStat {
  name: string;
  count: number;
}

export type HorarioStat = {
  horario: string;
  total: number;
} & Record<string, number | string>;

export interface ContrataStat {
  contratista: string;
  campo: number;
  soporte: number;
  total: number;
}

export interface CapacityStats {
  total: number;
  campoCount: number;
  soporteCount: number;
  missingHorarioCount: number;
  missingSsamCount: number;
  byFront: FrontStat[];
  bySkill: SkillStat[];
  byHorario: HorarioStat[];
  byContrata: ContrataStat[];
  uncoveredHorarios: string[];
}

const FRONT_CONFIG_MAP = new Map(FRONT_CONFIGS.map((cfg) => [cfg.id, cfg]));

export function computeCapacityStats(
  rows: TurnRow[],
  horariosCatalog: string[]
): CapacityStats {
  const activeRows = rows.filter((row) => row.nombres.trim().length > 0);

  let campoCount = 0;
  let soporteCount = 0;
  let missingHorarioCount = 0;
  let missingSsamCount = 0;

  const frontCounts = new Map<FrontType, number>();
  for (const cfg of FRONT_CONFIGS) {
    frontCounts.set(cfg.id, 0);
  }

  const skillCounts = new Map<string, number>();
  const contrataMap = new Map<string, ContrataStat>();

  const horarioOrder: string[] = [];
  const horarioSet = new Set<string>();
  for (const h of horariosCatalog) {
    const trimmed = h.trim();
    if (trimmed && !horarioSet.has(trimmed)) {
      horarioSet.add(trimmed);
      horarioOrder.push(trimmed);
    }
  }

  const horarioCounts = new Map<
    string,
    { total: number; byFront: Record<FrontType, number> }
  >();

  const ensureHorarioBucket = (horario: string) => {
    let bucket = horarioCounts.get(horario);
    if (!bucket) {
      const byFront = {} as Record<FrontType, number>;
      for (const cfg of FRONT_CONFIGS) {
        byFront[cfg.id] = 0;
      }
      bucket = { total: 0, byFront };
      horarioCounts.set(horario, bucket);
    }
    return bucket;
  };

  for (const h of horarioOrder) {
    ensureHorarioBucket(h);
  }

  for (const row of activeRows) {
    const cfg = FRONT_CONFIG_MAP.get(row.frente);
    const isField = cfg?.isFieldFront ?? false;

    if (isField) {
      campoCount += 1;
    } else {
      soporteCount += 1;
    }

    frontCounts.set(row.frente, (frontCounts.get(row.frente) ?? 0) + 1);

    const horario = row.horario.trim();
    if (!horario) {
      missingHorarioCount += 1;
    } else {
      if (!horarioSet.has(horario)) {
        horarioSet.add(horario);
        horarioOrder.push(horario);
      }
      const bucket = ensureHorarioBucket(horario);
      bucket.total += 1;
      bucket.byFront[row.frente] = (bucket.byFront[row.frente] ?? 0) + 1;
    }

    if (cfg?.hasSsam && !row.usuario_ssam.trim()) {
      missingSsamCount += 1;
    }

    const skill = row.skill.trim();
    if (skill) {
      skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
    }

    const contratista = row.contratista.trim() || 'SIN CONTRATA';
    let contrataEntry = contrataMap.get(contratista);
    if (!contrataEntry) {
      contrataEntry = { contratista, campo: 0, soporte: 0, total: 0 };
      contrataMap.set(contratista, contrataEntry);
    }
    if (isField) {
      contrataEntry.campo += 1;
    } else {
      contrataEntry.soporte += 1;
    }
    contrataEntry.total += 1;
  }

  const byFront: FrontStat[] = FRONT_CONFIGS.map((cfg) => ({
    frente: cfg.id,
    count: frontCounts.get(cfg.id) ?? 0,
    isField: cfg.isFieldFront,
  }));

  const bySkill: SkillStat[] = Array.from(skillCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const byHorario: HorarioStat[] = horarioOrder.map((horario) => {
    const bucket = ensureHorarioBucket(horario);
    return {
      horario,
      total: bucket.total,
      ...bucket.byFront,
    };
  });

  const byContrata: ContrataStat[] = Array.from(contrataMap.values()).sort(
    (a, b) => b.total - a.total || a.contratista.localeCompare(b.contratista)
  );

  const uncoveredHorarios = horariosCatalog
    .map((h) => h.trim())
    .filter((h) => h.length > 0 && (horarioCounts.get(h)?.total ?? 0) === 0);

  return {
    total: activeRows.length,
    campoCount,
    soporteCount,
    missingHorarioCount,
    missingSsamCount,
    byFront,
    bySkill,
    byHorario,
    byContrata,
    uncoveredHorarios,
  };
}

export type FieldCategoryId =
  | 'RECLAMISTA'
  | 'RECLAMISTA_APOYO'
  | 'REPARACIONES'
  | 'REPARACIONES_APOYO'
  | 'TEKO';

export interface FieldCategoryMeta {
  id: FieldCategoryId;
  label: string;
  shortLabel: string;
  color: string;
}

export const FIELD_CATEGORIES: FieldCategoryMeta[] = [
  { id: 'RECLAMISTA', label: 'Reclamistas', shortLabel: 'Reclamistas', color: '#3C5A9F' },
  { id: 'RECLAMISTA_APOYO', label: 'Reclamistas de Apoyo', shortLabel: 'Apoyo Recl.', color: '#60A5FA' },
  { id: 'REPARACIONES', label: 'Reparaciones', shortLabel: 'Reparaciones', color: '#6CAB5E' },
  { id: 'REPARACIONES_APOYO', label: 'Reparaciones de Apoyo', shortLabel: 'Apoyo Repar.', color: '#34D399' },
  { id: 'TEKO', label: 'Tekos (Brazos Hidráulicos)', shortLabel: 'Tekos', color: '#F59E0B' },
];

export interface DateTotalStat {
  fecha: string;
  label: string;
  total: number;
  RECLAMISTA: number;
  RECLAMISTA_APOYO: number;
  REPARACIONES: number;
  REPARACIONES_APOYO: number;
  TEKO: number;
}

export interface MatrixRowStat {
  category: FieldCategoryId;
  label: string;
  countsByContrata: Record<string, number>;
  total: number;
}

export interface CompanyShareStat {
  contratista: string;
  count: number;
  percentage: number;
}

export type CategoryCompanyStat = {
  category: FieldCategoryId;
  label: string;
} & Record<string, number | string>;

export interface WeekdayAverageStat {
  weekdayIndex: number; // 0=Lun .. 6=Dom
  label: string;
  average: number;
  daysCount: number;
  total: number;
}

export interface FieldDashboardStats {
  totalField: number;
  countsByCategory: Record<FieldCategoryId, number>;
  dailyAverage: number;
  byDate: DateTotalStat[];
  contratas: string[];
  matrixRows: MatrixRowStat[];
  matrixTotalsByContrata: Record<string, number>;
  companyShare: CompanyShareStat[];
  byCategoryCompany: CategoryCompanyStat[];
  byWeekday: WeekdayAverageStat[];
}

export function classifyFieldRow(row: TurnRow): FieldCategoryId | null {
  if (!row.nombres.trim()) return null;

  const isApoyo = row.skill.toUpperCase().includes('APOYO');
  if (row.frente === 'RECLAMOS') {
    return isApoyo ? 'RECLAMISTA_APOYO' : 'RECLAMISTA';
  }
  if (row.frente === 'REPARACIONES') {
    return isApoyo ? 'REPARACIONES_APOYO' : 'REPARACIONES';
  }
  if (row.frente === 'TEKO') {
    return 'TEKO';
  }
  return null;
}

function formatShortDateLabel(fecha: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!match) return fecha;
  return `${match[3]}/${match[2]}`;
}

export function computeFieldDashboardStats(
  rows: TurnRow[],
  options?: {
    selectedContratas?: string[];
    selectedCategories?: FieldCategoryId[];
    allContratas?: string[];
  },
): FieldDashboardStats {
  const countsByCategory: Record<FieldCategoryId, number> = {
    RECLAMISTA: 0,
    RECLAMISTA_APOYO: 0,
    REPARACIONES: 0,
    REPARACIONES_APOYO: 0,
    TEKO: 0,
  };

  const selectedContratasSet =
    options?.selectedContratas && options.selectedContratas.length > 0
      ? new Set(options.selectedContratas)
      : null;
  const selectedCategoriesSet =
    options?.selectedCategories && options.selectedCategories.length > 0
      ? new Set(options.selectedCategories)
      : null;

  const contratasSet = new Set<string>();
  if (options?.allContratas) {
    for (const c of options.allContratas) {
      const trimmed = c.trim();
      if (trimmed) contratasSet.add(trimmed);
    }
  }

  const dateMap = new Map<string, DateTotalStat>();
  const companyMap = new Map<string, number>();
  const matrixMap = new Map<FieldCategoryId, Map<string, number>>();
  for (const cat of FIELD_CATEGORIES) {
    matrixMap.set(cat.id, new Map<string, number>());
  }

  let totalField = 0;

  for (const row of rows) {
    const category = classifyFieldRow(row);
    if (!category) continue;

    const contratista = row.contratista.trim() || 'SIN CONTRATA';
    if (selectedContratasSet && !selectedContratasSet.has(contratista)) continue;
    if (selectedCategoriesSet && !selectedCategoriesSet.has(category)) continue;

    contratasSet.add(contratista);
    totalField += 1;
    countsByCategory[category] += 1;

    const fecha = row.fecha.trim() || 'SIN FECHA';
    let dateBucket = dateMap.get(fecha);
    if (!dateBucket) {
      dateBucket = {
        fecha,
        label: formatShortDateLabel(fecha),
        total: 0,
        RECLAMISTA: 0,
        RECLAMISTA_APOYO: 0,
        REPARACIONES: 0,
        REPARACIONES_APOYO: 0,
        TEKO: 0,
      };
      dateMap.set(fecha, dateBucket);
    }
    dateBucket.total += 1;
    dateBucket[category] += 1;

    companyMap.set(contratista, (companyMap.get(contratista) ?? 0) + 1);

    const catMap = matrixMap.get(category)!;
    catMap.set(contratista, (catMap.get(contratista) ?? 0) + 1);
  }

  const byDate = Array.from(dateMap.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const dailyAverage = byDate.length > 0 ? Math.round(totalField / byDate.length) : 0;

  const contratas = Array.from(contratasSet).sort((a, b) => a.localeCompare(b));

  const matrixTotalsByContrata: Record<string, number> = {};
  for (const c of contratas) {
    matrixTotalsByContrata[c] = 0;
  }

  const matrixRows: MatrixRowStat[] = FIELD_CATEGORIES.map((cat) => {
    const catMap = matrixMap.get(cat.id)!;
    const countsByContrata: Record<string, number> = {};
    let rowTotal = 0;
    for (const c of contratas) {
      const val = catMap.get(c) ?? 0;
      countsByContrata[c] = val;
      rowTotal += val;
      matrixTotalsByContrata[c] += val;
    }
    return {
      category: cat.id,
      label: cat.label,
      countsByContrata,
      total: rowTotal,
    };
  });

  const companyShare: CompanyShareStat[] = Array.from(companyMap.entries())
    .map(([contratista, count]) => ({
      contratista,
      count,
      percentage: totalField > 0 ? Math.round((count / totalField) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.contratista.localeCompare(b.contratista));

  const byCategoryCompany: CategoryCompanyStat[] = matrixRows.map((mRow) => {
    const entry: CategoryCompanyStat = {
      category: mRow.category,
      label: mRow.label,
    };
    for (const c of contratas) {
      entry[c] = mRow.countsByContrata[c] ?? 0;
    }
    return entry;
  });

  const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const weekdayBuckets = WEEKDAY_LABELS.map((label, weekdayIndex) => ({
    weekdayIndex,
    label,
    total: 0,
    daysCount: 0,
  }));

  for (const day of byDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.fecha)) continue;
    const jsDay = new Date(`${day.fecha}T12:00:00`).getDay(); // 0=Dom, 1=Lun..6=Sáb
    const mondayFirstIndex = (jsDay + 6) % 7;
    weekdayBuckets[mondayFirstIndex].total += day.total;
    weekdayBuckets[mondayFirstIndex].daysCount += 1;
  }

  const byWeekday: WeekdayAverageStat[] = weekdayBuckets.map((b) => ({
    weekdayIndex: b.weekdayIndex,
    label: b.label,
    total: b.total,
    daysCount: b.daysCount,
    average: b.daysCount > 0 ? Math.round(b.total / b.daysCount) : 0,
  }));

  return {
    totalField,
    countsByCategory,
    dailyAverage,
    byDate,
    contratas,
    matrixRows,
    matrixTotalsByContrata,
    companyShare,
    byCategoryCompany,
    byWeekday,
  };
}
