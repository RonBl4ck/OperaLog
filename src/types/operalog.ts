export type OperalogGroup = string;
export type UserGroupScope = string;

export const DEFAULT_GROUP_IDS = ['BT', 'AP', 'MT'] as const;

export const OPERALOG_GROUPS: { id: OperalogGroup; label: string; shortLabel: string }[] = [
  { id: 'BT', label: 'Baja Tensión (BT)', shortLabel: 'BT' },
  { id: 'AP', label: 'Alumbrado Público (AP)', shortLabel: 'AP' },
  { id: 'MT', label: 'Media Tensión (MT)', shortLabel: 'MT' },
];

export function getGroupLabel(id: string): string {
  const upper = id.trim().toUpperCase();
  const known = OPERALOG_GROUPS.find((g) => g.id === upper);
  return known ? known.label : upper;
}

export interface ContrataMeta {
  nombre: string;
  grupo: OperalogGroup;
}

export type FrontType =
  | 'COORDINADORES'
  | 'SUPERVISORES CAPA'
  | 'LOCALIZADORES'
  | 'DESPACHADORES'
  | 'RECLAMOS'
  | 'TEKO'
  | 'REPARACIONES';

export interface FrontConfig {
  id: FrontType;
  label: string;
  hasSsam: boolean;
  hasActivityDropdown: boolean;
  fixedActivity: string | null;
  hasSkill: boolean;
  isFieldFront: boolean;
  supportsExcelTemplate: boolean;
}

export const FRONT_CONFIGS: FrontConfig[] = [
  {
    id: 'COORDINADORES',
    label: 'Coordinadores',
    hasSsam: false,
    hasActivityDropdown: false,
    fixedActivity: null,
    hasSkill: false,
    isFieldFront: false,
    supportsExcelTemplate: false,
  },
  {
    id: 'SUPERVISORES CAPA',
    label: 'Supervisores CAPA',
    hasSsam: false,
    hasActivityDropdown: false,
    fixedActivity: null,
    hasSkill: false,
    isFieldFront: false,
    supportsExcelTemplate: false,
  },
  {
    id: 'LOCALIZADORES',
    label: 'Localizadores',
    hasSsam: false,
    hasActivityDropdown: false,
    fixedActivity: null,
    hasSkill: false,
    isFieldFront: false,
    supportsExcelTemplate: false,
  },
  {
    id: 'DESPACHADORES',
    label: 'Despachadores',
    hasSsam: false,
    hasActivityDropdown: true,
    fixedActivity: null,
    hasSkill: false,
    isFieldFront: false,
    supportsExcelTemplate: true,
  },
  {
    id: 'RECLAMOS',
    label: 'Reclamos',
    hasSsam: true,
    hasActivityDropdown: false,
    fixedActivity: 'RECLAMISTA',
    hasSkill: true,
    isFieldFront: true,
    supportsExcelTemplate: true,
  },
  {
    id: 'TEKO',
    label: 'Teko',
    hasSsam: true,
    hasActivityDropdown: false,
    fixedActivity: 'TEKO',
    hasSkill: true,
    isFieldFront: true,
    supportsExcelTemplate: true,
  },
  {
    id: 'REPARACIONES',
    label: 'Reparaciones',
    hasSsam: true,
    hasActivityDropdown: false,
    fixedActivity: 'REPARACIONES',
    hasSkill: true,
    isFieldFront: true,
    supportsExcelTemplate: true,
  },
];

export const EDITABLE_TURN_FIELDS = [
  'frente',
  'nombres',
  'usuario_ssam',
  'celular',
  'actividad',
  'skill',
  'horario',
] as const;

export type EditableTurnField = (typeof EDITABLE_TURN_FIELDS)[number];

const EDITABLE_TURN_FIELD_SET = new Set<string>(EDITABLE_TURN_FIELDS);

export function parseAdminEditedFields(
  raw?: string | string[] | null,
): EditableTurnField[] {
  const tokens = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[,;|]+/)
      : [];
  const seen = new Set<EditableTurnField>();
  const result: EditableTurnField[] = [];
  for (const token of tokens) {
    const normalized = String(token ?? '').trim().toLowerCase();
    if (EDITABLE_TURN_FIELD_SET.has(normalized)) {
      const field = normalized as EditableTurnField;
      if (!seen.has(field)) {
        seen.add(field);
        result.push(field);
      }
    }
  }
  return result;
}

export interface TurnRow {
  id: string;
  fecha: string;
  contratista: string;
  grupo?: OperalogGroup;
  frente: FrontType;
  nombres: string;
  usuario_ssam: string;
  celular: string;
  actividad: string;
  skill: string;
  horario: string;
  updated_at?: string;
  updated_by?: string;
  admin_edited_fields?: EditableTurnField[];
}

export interface CatalogItem {
  tipo: 'HORARIO' | 'ACTIVIDAD' | 'SKILL' | 'FRENTE';
  frente: string;
  valor: string;
  orden: number;
  activo: boolean;
  grupo?: UserGroupScope;
}

export interface UserSession {
  usuario: string;
  rol: 'ADMIN' | 'CONTRATA';
  contratista: string;
  nombre_mostrar: string;
  grupo?: string;
  ver_historico?: boolean;
}

export function parseUserGroups(
  raw?: string | null,
  fallback: UserGroupScope = 'BT',
  knownGroups?: string[],
): OperalogGroup[] {
  const defaultAll =
    knownGroups && knownGroups.length > 0 ? knownGroups : [...DEFAULT_GROUP_IDS];
  const upper = String(raw ?? '').trim().toUpperCase();
  if (!upper) {
    return fallback === 'ALL' ? defaultAll : [fallback];
  }
  const tokens = upper
    .split(/[,;|]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.includes('ALL')) {
    return defaultAll;
  }
  const valid = Array.from(new Set(tokens));
  if (valid.length > 0) return valid;
  return fallback === 'ALL' ? defaultAll : [fallback];
}

export function collectAvailableGroups(
  contratasMeta: ContrataMeta[],
  catalogs: CatalogItem[] = [],
  userGrupo?: string | null,
): OperalogGroup[] {
  const set = new Set<string>();
  for (const c of contratasMeta) {
    const g = normalizeGroup(c.grupo, 'BT');
    if (g && g !== 'ALL') set.add(g);
  }
  for (const cat of catalogs) {
    const g = normalizeGroup(cat.grupo, cat.tipo === 'HORARIO' ? 'ALL' : 'BT');
    if (g && g !== 'ALL') set.add(g);
  }
  if (userGrupo) {
    const tokens = String(userGrupo)
      .trim()
      .toUpperCase()
      .split(/[,;|]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t !== 'ALL');
    for (const t of tokens) {
      set.add(t);
    }
  }
  if (set.size === 0) {
    return [...DEFAULT_GROUP_IDS];
  }
  return Array.from(set);
}

export function normalizeGroup(
  raw?: string | null,
  fallback: UserGroupScope = 'BT',
): UserGroupScope {
  const upper = String(raw ?? '').trim().toUpperCase();
  return upper.length > 0 ? upper : fallback;
}

export function matchesGroupCatalog(
  itemGrupo: string | undefined,
  targetGroup?: UserGroupScope,
): boolean {
  if (!targetGroup || targetGroup === 'ALL') return true;
  const normalizedItem = normalizeGroup(itemGrupo, 'BT');
  return normalizedItem === 'ALL' || normalizedItem === targetGroup;
}

export function getActiveFrontConfigs(
  catalogs: CatalogItem[],
  grupo?: UserGroupScope,
): FrontConfig[] {
  const frenteItems = catalogs.filter(
    (c) => c.tipo === 'FRENTE' && matchesGroupCatalog(c.grupo, grupo),
  );
  if (frenteItems.length === 0) {
    return FRONT_CONFIGS;
  }

  const activeSorted = frenteItems
    .filter((c) => c.activo)
    .sort((a, b) => a.orden - b.orden);

  const seen = new Set<FrontType>();
  const result: FrontConfig[] = [];
  for (const item of activeSorted) {
    const token = String(item.valor || item.frente || '').trim().toUpperCase();
    const config = FRONT_CONFIGS.find((f) => f.id === token);
    if (config && !seen.has(config.id)) {
      seen.add(config.id);
      result.push(config);
    }
  }
  return result;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}
