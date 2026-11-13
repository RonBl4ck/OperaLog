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
  },
  {
    id: 'SUPERVISORES CAPA',
    label: 'Supervisores CAPA',
    hasSsam: false,
    hasActivityDropdown: false,
    fixedActivity: null,
    hasSkill: false,
    isFieldFront: false,
  },
  {
    id: 'LOCALIZADORES',
    label: 'Localizadores',
    hasSsam: false,
    hasActivityDropdown: false,
    fixedActivity: null,
    hasSkill: false,
    isFieldFront: false,
  },
  {
    id: 'DESPACHADORES',
    label: 'Despachadores',
    hasSsam: false,
    hasActivityDropdown: true,
    fixedActivity: null,
    hasSkill: false,
    isFieldFront: false,
  },
  {
    id: 'RECLAMOS',
    label: 'Reclamos',
    hasSsam: true,
    hasActivityDropdown: false,
    fixedActivity: 'RECLAMISTA',
    hasSkill: true,
    isFieldFront: true,
  },
  {
    id: 'TEKO',
    label: 'Teko',
    hasSsam: true,
    hasActivityDropdown: false,
    fixedActivity: 'TEKO',
    hasSkill: true,
    isFieldFront: true,
  },
  {
    id: 'REPARACIONES',
    label: 'Reparaciones',
    hasSsam: true,
    hasActivityDropdown: false,
    fixedActivity: 'REPARACIONES',
    hasSkill: true,
    isFieldFront: true,
  },
];

export interface TurnRow {
  id: string;
  fecha: string;
  contratista: string;
  frente: FrontType;
  nombres: string;
  usuario_ssam: string;
  celular: string;
  actividad: string;
  skill: string;
  horario: string;
}

export interface CatalogItem {
  tipo: 'HORARIO' | 'ACTIVIDAD' | 'SKILL';
  frente: string;
  valor: string;
  orden: number;
  activo: boolean;
}

export interface UserSession {
  usuario: string;
  rol: 'ADMIN' | 'CONTRATA';
  contratista: string;
  nombre_mostrar: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}
