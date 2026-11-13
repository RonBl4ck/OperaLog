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
