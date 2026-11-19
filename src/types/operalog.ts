export type OperalogGroup = 'BT' | 'AP' | 'MT';
export type UserGroupScope = OperalogGroup | 'ALL';

export const OPERALOG_GROUPS: { id: OperalogGroup; label: string; shortLabel: string }[] = [
  { id: 'BT', label: 'Baja Tensión (BT)', shortLabel: 'BT' },
  { id: 'AP', label: 'Alumbrado Público (AP)', shortLabel: 'AP' },
  { id: 'MT', label: 'Media Tensión (MT)', shortLabel: 'MT' },
];

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
  grupo?: UserGroupScope;
  ver_historico?: boolean;
}

export function normalizeGroup(
  raw?: string | null,
  fallback: UserGroupScope = 'BT',
): UserGroupScope {
  const upper = String(raw ?? '').trim().toUpperCase();
  if (upper === 'BT' || upper === 'AP' || upper === 'MT' || upper === 'ALL') {
    return upper;
  }
  return fallback;
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
