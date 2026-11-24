import {
  CatalogItem,
  ContrataMeta,
  EDITABLE_TURN_FIELDS,
  EditableTurnField,
  FrontType,
  OperalogGroup,
  TurnRow,
  UserGroupScope,
  UserSession,
  matchesGroupCatalog,
  normalizeGroup,
  parseAdminEditedFields,
  parseUserGroups,
} from '../types/operalog';

const GAS_URL =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_GAS_URL ?? '').trim();

const STORAGE_KEYS = {
  CATALOGS: 'operalog_demo_catalogs_v2',
  TURNS: 'operalog_demo_turns_v2',
  SESSION_CATALOGS: 'operalog_cache_catalogs_v2',
  SESSION_CONTRATAS: 'operalog_cache_contratas_v2',
  SESSION_CONTRATAS_META: 'operalog_cache_contratas_meta_v2',
} as const;

interface DemoUserRecord extends UserSession {
  pin: string;
  grupo: UserGroupScope;
}

const DEMO_USERS: DemoUserRecord[] = [
  {
    usuario: 'admin.pluz',
    pin: '1234',
    rol: 'ADMIN',
    contratista: 'ALL',
    nombre_mostrar: 'Administrador PLUZ',
    grupo: 'ALL',
    ver_historico: true,
  },
  {
    usuario: 'admin.bt',
    pin: '1234',
    rol: 'ADMIN',
    contratista: 'ALL',
    nombre_mostrar: 'Administrador BT',
    grupo: 'BT',
    ver_historico: false,
  },
  {
    usuario: 'admin.ap',
    pin: '1234',
    rol: 'ADMIN',
    contratista: 'ALL',
    nombre_mostrar: 'Administrador AP',
    grupo: 'AP',
    ver_historico: false,
  },
  {
    usuario: 'admin.mt',
    pin: '1234',
    rol: 'ADMIN',
    contratista: 'ALL',
    nombre_mostrar: 'Administrador MT',
    grupo: 'MT',
    ver_historico: false,
  },
  {
    usuario: 'contrata.alfa',
    pin: '5678',
    rol: 'CONTRATA',
    contratista: 'ALFA',
    nombre_mostrar: 'Contrata ALFA',
    grupo: 'BT',
  },
  {
    usuario: 'contrata.beta',
    pin: '5678',
    rol: 'CONTRATA',
    contratista: 'BETA',
    nombre_mostrar: 'Contrata BETA',
    grupo: 'BT',
  },
  {
    usuario: 'contrata.lumina',
    pin: '5678',
    rol: 'CONTRATA',
    contratista: 'LUMINA',
    nombre_mostrar: 'Contrata LUMINA',
    grupo: 'AP',
  },
  {
    usuario: 'contrata.redesmt',
    pin: '5678',
    rol: 'CONTRATA',
    contratista: 'REDES MT',
    nombre_mostrar: 'Contrata REDES MT',
    grupo: 'MT',
  },
];

const DEMO_CONTRATAS_META: ContrataMeta[] = [
  { nombre: 'ALFA', grupo: 'BT' },
  { nombre: 'BETA', grupo: 'BT' },
  { nombre: 'LUMINA', grupo: 'AP' },
  { nombre: 'REDES MT', grupo: 'MT' },
];

const DEMO_CONTRATA_GROUP_MAP = new Map<string, OperalogGroup>(
  DEMO_CONTRATAS_META.map((c) => [c.nombre, c.grupo]),
);

const DEFAULT_CATALOGS: CatalogItem[] = [
  // HORARIO (ALL)
  { tipo: 'HORARIO', frente: 'ALL', valor: '06:00 - 22:00', orden: 1, activo: true, grupo: 'ALL' },
  { tipo: 'HORARIO', frente: 'ALL', valor: '07:00 - 23:00', orden: 2, activo: true, grupo: 'ALL' },
  { tipo: 'HORARIO', frente: 'ALL', valor: '07:00 - 16:00', orden: 3, activo: true, grupo: 'ALL' },
  { tipo: 'HORARIO', frente: 'ALL', valor: '15:00 - 07:00', orden: 4, activo: true, grupo: 'ALL' },
  { tipo: 'HORARIO', frente: 'ALL', valor: '23:00 - 07:00', orden: 5, activo: true, grupo: 'ALL' },

  // ACTIVIDAD (DESPACHADORES - BT)
  { tipo: 'ACTIVIDAD', frente: 'DESPACHADORES', valor: 'RECLAMO', orden: 1, activo: true, grupo: 'BT' },
  { tipo: 'ACTIVIDAD', frente: 'DESPACHADORES', valor: 'REPARACIONES', orden: 2, activo: true, grupo: 'BT' },
  { tipo: 'ACTIVIDAD', frente: 'DESPACHADORES', valor: 'APOYO RECLAMOS', orden: 3, activo: true, grupo: 'BT' },
  { tipo: 'ACTIVIDAD', frente: 'DESPACHADORES', valor: 'APOYO REPARACIONES', orden: 4, activo: true, grupo: 'BT' },

  // SKILL (RECLAMOS - BT)
  { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'TOMA', orden: 1, activo: true, grupo: 'BT' },
  { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'TOMA + CNX AEREA', orden: 2, activo: true, grupo: 'BT' },
  { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'APOYO RECLAMOS', orden: 3, activo: true, grupo: 'BT' },

  // SKILL (TEKO - BT)
  { tipo: 'SKILL', frente: 'TEKO', valor: 'CNX AEREA + RED AEREA', orden: 1, activo: true, grupo: 'BT' },

  // SKILL (REPARACIONES - BT)
  { tipo: 'SKILL', frente: 'REPARACIONES', valor: 'CNX SUBTERRANEA', orden: 1, activo: true, grupo: 'BT' },
  { tipo: 'SKILL', frente: 'REPARACIONES', valor: 'RED + CNX SUBTERRANEA', orden: 2, activo: true, grupo: 'BT' },
  { tipo: 'SKILL', frente: 'REPARACIONES', valor: 'APOYO REPARACIONES', orden: 3, activo: true, grupo: 'BT' },

  // SAMPLE AP
  { tipo: 'ACTIVIDAD', frente: 'DESPACHADORES', valor: 'DESPACHO AP', orden: 1, activo: true, grupo: 'AP' },
  { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'LUMINARIA LED', orden: 1, activo: true, grupo: 'AP' },
  { tipo: 'SKILL', frente: 'REPARACIONES', valor: 'POSTE Y PASTORAL AP', orden: 1, activo: true, grupo: 'AP' },

  // SAMPLE MT
  { tipo: 'ACTIVIDAD', frente: 'DESPACHADORES', valor: 'DESPACHO MT', orden: 1, activo: true, grupo: 'MT' },
  { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'SUBESTACION MT', orden: 1, activo: true, grupo: 'MT' },
  { tipo: 'SKILL', frente: 'REPARACIONES', valor: 'RED AEREA MT', orden: 1, activo: true, grupo: 'MT' },
];

export function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isPastIsoDate(fecha: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha < getTodayIsoDate();
}

function getYesterdayIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildSeededTurns(): TurnRow[] {
  const yesterday = getYesterdayIsoDate();
  return [
    // ALFA
    {
      id: 'seed-alfa-1',
      fecha: yesterday,
      contratista: 'ALFA',
      frente: 'COORDINADORES',
      nombres: 'Carlos Mendoza Ríos',
      usuario_ssam: '',
      celular: '987654321',
      actividad: '',
      skill: '',
      horario: '07:00 - 16:00',
    },
    {
      id: 'seed-alfa-2',
      fecha: yesterday,
      contratista: 'ALFA',
      frente: 'SUPERVISORES CAPA',
      nombres: 'Lucía Paredes Vega',
      usuario_ssam: '',
      celular: '987654322',
      actividad: '',
      skill: '',
      horario: '06:00 - 22:00',
    },
    {
      id: 'seed-alfa-3',
      fecha: yesterday,
      contratista: 'ALFA',
      frente: 'LOCALIZADORES',
      nombres: 'Jorge Quispe Huamán',
      usuario_ssam: '',
      celular: '987654323',
      actividad: '',
      skill: '',
      horario: '07:00 - 23:00',
    },
    {
      id: 'seed-alfa-4',
      fecha: yesterday,
      contratista: 'ALFA',
      frente: 'DESPACHADORES',
      nombres: 'María Torres Salazar',
      usuario_ssam: '',
      celular: '987654324',
      actividad: 'RECLAMO',
      skill: '',
      horario: '06:00 - 22:00',
    },
    {
      id: 'seed-alfa-5',
      fecha: yesterday,
      contratista: 'ALFA',
      frente: 'RECLAMOS',
      nombres: 'Pedro Castillo León',
      usuario_ssam: 'PCASTILLO',
      celular: '987654325',
      actividad: 'RECLAMISTA',
      skill: 'TOMA + CNX AEREA',
      horario: '06:00 - 22:00',
    },
    {
      id: 'seed-alfa-6',
      fecha: yesterday,
      contratista: 'ALFA',
      frente: 'RECLAMOS',
      nombres: 'Raúl Chávez Díaz',
      usuario_ssam: 'RCHAVEZ',
      celular: '987654326',
      actividad: 'RECLAMISTA',
      skill: 'TOMA',
      horario: '15:00 - 07:00',
    },
    {
      id: 'seed-alfa-7',
      fecha: yesterday,
      contratista: 'ALFA',
      frente: 'TEKO',
      nombres: 'Andrés Rojas Flores',
      usuario_ssam: 'AROJAS',
      celular: '987654327',
      actividad: 'TEKO',
      skill: 'CNX AEREA + RED AEREA',
      horario: '07:00 - 23:00',
    },
    {
      id: 'seed-alfa-8',
      fecha: yesterday,
      contratista: 'ALFA',
      frente: 'REPARACIONES',
      nombres: 'Luis Navarro Gómez',
      usuario_ssam: 'LNAVARRO',
      celular: '987654328',
      actividad: 'REPARACIONES',
      skill: 'RED + CNX SUBTERRANEA',
      horario: '23:00 - 07:00',
    },

    // BETA
    {
      id: 'seed-beta-1',
      fecha: yesterday,
      contratista: 'BETA',
      frente: 'COORDINADORES',
      nombres: 'Elena Vargas Soto',
      usuario_ssam: '',
      celular: '976543210',
      actividad: '',
      skill: '',
      horario: '07:00 - 16:00',
    },
    {
      id: 'seed-beta-2',
      fecha: yesterday,
      contratista: 'BETA',
      frente: 'DESPACHADORES',
      nombres: 'Diego Morales Cruz',
      usuario_ssam: '',
      celular: '976543211',
      actividad: 'REPARACIONES',
      skill: '',
      horario: '07:00 - 23:00',
    },
    {
      id: 'seed-beta-3',
      fecha: yesterday,
      contratista: 'BETA',
      frente: 'RECLAMOS',
      nombres: 'Fernando Silva Ruiz',
      usuario_ssam: 'FSILVA',
      celular: '976543212',
      actividad: 'RECLAMISTA',
      skill: 'TOMA',
      horario: '06:00 - 22:00',
    },
    {
      id: 'seed-beta-4',
      fecha: yesterday,
      contratista: 'BETA',
      frente: 'REPARACIONES',
      nombres: 'Hugo Ramírez Campos',
      usuario_ssam: 'HRAMIREZ',
      celular: '976543213',
      actividad: 'REPARACIONES',
      skill: 'CNX SUBTERRANEA',
      horario: '15:00 - 07:00',
    },
  ];
}

export function isDemoMode(): boolean {
  return GAS_URL.length === 0;
}

function readLocalCatalogs(): CatalogItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATALOGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CATALOGS, JSON.stringify(DEFAULT_CATALOGS));
      return [...DEFAULT_CATALOGS];
    }
    const parsed = JSON.parse(raw) as CatalogItem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_CATALOGS];
  } catch {
    return [...DEFAULT_CATALOGS];
  }
}

function writeLocalCatalogs(items: CatalogItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CATALOGS, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors in demo mode
  }
}

function readLocalTurns(): TurnRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TURNS);
    if (!raw) {
      const seeded = buildSeededTurns();
      localStorage.setItem(STORAGE_KEYS.TURNS, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as TurnRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return buildSeededTurns();
  }
}

function writeLocalTurns(rows: TurnRow[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TURNS, JSON.stringify(rows));
  } catch {
    // Ignore storage quota errors in demo mode
  }
}

export interface GasReadOptions {
  forceRefresh?: boolean;
}

export function clearSessionDataCache(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_CATALOGS);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_CONTRATAS);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_CONTRATAS_META);
  } catch {
    // Ignore sessionStorage errors
  }
}

export function readCachedCatalogs(
  includeInactive = false,
  grupo?: UserGroupScope,
): CatalogItem[] | null {
  if (isDemoMode()) return null;
  try {
    const cached = sessionStorage.getItem(STORAGE_KEYS.SESSION_CATALOGS);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as CatalogItem[];
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (c) => (includeInactive || c.activo) && matchesGroupCatalog(c.grupo, grupo),
    );
  } catch {
    return null;
  }
}

export function readCachedContratasMeta(): ContrataMeta[] | null {
  if (isDemoMode()) return null;
  try {
    const cached = sessionStorage.getItem(STORAGE_KEYS.SESSION_CONTRATAS_META);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as ContrataMeta[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function gasGet<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(GAS_URL);
  url.searchParams.set('action', action);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('_t', String(Date.now()));

  const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Error HTTP ${res.status} al consultar GAS (${action})`);
  }
  const data = (await res.json()) as { ok?: boolean; error?: string; data?: T } & T;
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(data.error);
  }
  if (data && typeof data === 'object' && 'ok' in data && data.ok === false) {
    throw new Error('La operación en Google Apps Script no fue exitosa');
  }
  return ('data' in data && data.data !== undefined ? data.data : data) as T;
}

async function gasPost<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) {
    throw new Error(`Error HTTP ${res.status} al enviar datos a GAS (${action})`);
  }
  const data = (await res.json()) as { ok?: boolean; error?: string; data?: T } & T;
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(data.error);
  }
  if (data && typeof data === 'object' && 'ok' in data && data.ok === false) {
    throw new Error('La operación en Google Apps Script falló');
  }
  return ('data' in data && data.data !== undefined ? data.data : data) as T;
}

export interface PublicUserOption {
  usuario: string;
  rol: 'ADMIN' | 'CONTRATA';
  contratista: string;
  nombre_mostrar: string;
  grupo?: UserGroupScope;
  ver_historico?: boolean;
}

export async function getPublicUsers(): Promise<PublicUserOption[]> {
  if (isDemoMode()) {
    return DEMO_USERS.map(({ pin: _omit, ...u }) => {
      void _omit;
      return u;
    });
  }
  try {
    const res = await gasGet<PublicUserOption[] | { users?: PublicUserOption[] }>('listUsers');
    return Array.isArray(res) ? res : (res.users ?? []);
  } catch {
    return [];
  }
}

export async function login(usuario: string, pin: string): Promise<UserSession> {
  const normalizedUser = usuario.trim().toLowerCase();
  const normalizedPin = pin.trim();

  if (isDemoMode()) {
    const match = DEMO_USERS.find(
      (u) => u.usuario.toLowerCase() === normalizedUser && u.pin === normalizedPin,
    );
    if (!match) {
      throw new Error('Usuario o contraseña incorrecta');
    }
    const { pin: _omit, ...session } = match;
    void _omit;
    return session;
  }

  const res = await gasGet<
    | UserSession
    | {
        user?: UserSession;
        catalogs?: CatalogItem[];
        contratas?: string[];
        contratasMeta?: ContrataMeta[];
      }
  >('login', {
    usuario: normalizedUser,
    pin: normalizedPin,
  });

  if (res && typeof res === 'object' && 'user' in res && res.user) {
    try {
      if (Array.isArray(res.catalogs)) {
        sessionStorage.setItem(STORAGE_KEYS.SESSION_CATALOGS, JSON.stringify(res.catalogs));
      }
      if (Array.isArray(res.contratas)) {
        sessionStorage.setItem(STORAGE_KEYS.SESSION_CONTRATAS, JSON.stringify(res.contratas));
      }
      if (Array.isArray(res.contratasMeta)) {
        sessionStorage.setItem(
          STORAGE_KEYS.SESSION_CONTRATAS_META,
          JSON.stringify(res.contratasMeta),
        );
      }
    } catch {
      // Ignore sessionStorage write error
    }
    return res.user;
  }

  return res as UserSession;
}

export async function getCatalogs(
  includeInactive = false,
  grupo?: UserGroupScope,
  options?: GasReadOptions,
): Promise<CatalogItem[]> {
  if (isDemoMode()) {
    const all = readLocalCatalogs();
    return all.filter(
      (c) => (includeInactive || c.activo) && matchesGroupCatalog(c.grupo, grupo),
    );
  }

  if (!options?.forceRefresh) {
    const cached = readCachedCatalogs(includeInactive, grupo);
    if (cached !== null) {
      return cached;
    }
  }

  const action = includeInactive ? 'getAllCatalogs' : 'getCatalogs';
  const params: Record<string, string> = {};
  if (grupo) params.grupo = grupo;
  const res = await gasGet<CatalogItem[] | { catalogs?: CatalogItem[] }>(action, params);
  const catalogs = Array.isArray(res) ? res : (res.catalogs ?? []);
  try {
    if (!grupo || grupo === 'ALL') {
      sessionStorage.setItem(STORAGE_KEYS.SESSION_CATALOGS, JSON.stringify(catalogs));
    }
  } catch {
    // Ignore sessionStorage write error
  }
  return catalogs;
}

export async function refreshAllCatalogs(): Promise<CatalogItem[]> {
  if (isDemoMode()) {
    return readLocalCatalogs();
  }

  const res = await gasGet<CatalogItem[] | { catalogs?: CatalogItem[] }>('getAllCatalogs');
  const catalogs = Array.isArray(res) ? res : (res.catalogs ?? []);
  try {
    sessionStorage.setItem(STORAGE_KEYS.SESSION_CATALOGS, JSON.stringify(catalogs));
  } catch {
    // Ignore sessionStorage write error
  }
  return catalogs;
}

export async function getContratasMeta(options?: GasReadOptions): Promise<ContrataMeta[]> {
  if (isDemoMode()) {
    return [...DEMO_CONTRATAS_META];
  }

  if (!options?.forceRefresh) {
    const cached = readCachedContratasMeta();
    if (cached !== null) {
      return cached;
    }
  }

  const res = await gasGet<{ contratas?: string[]; contratasMeta?: ContrataMeta[] }>(
    'getContratas',
  );
  const meta: ContrataMeta[] = Array.isArray(res.contratasMeta)
    ? res.contratasMeta
    : (res.contratas ?? []).map((nombre) => ({ nombre, grupo: 'BT' }));
  try {
    sessionStorage.setItem(STORAGE_KEYS.SESSION_CONTRATAS_META, JSON.stringify(meta));
    sessionStorage.setItem(
      STORAGE_KEYS.SESSION_CONTRATAS,
      JSON.stringify(meta.map((m) => m.nombre)),
    );
  } catch {
    // Ignore sessionStorage write error
  }
  return meta;
}

export async function getContratas(
  grupo?: UserGroupScope,
  options?: GasReadOptions,
): Promise<string[]> {
  if (isDemoMode()) {
    const filtered =
      grupo && grupo !== 'ALL'
        ? DEMO_CONTRATAS_META.filter((c) => c.grupo === grupo)
        : DEMO_CONTRATAS_META;
    return filtered.map((c) => c.nombre);
  }

  if (!options?.forceRefresh && (!grupo || grupo === 'ALL')) {
    try {
      const cached = sessionStorage.getItem(STORAGE_KEYS.SESSION_CONTRATAS);
      if (cached) {
        return JSON.parse(cached) as string[];
      }
    } catch {
      // Ignore sessionStorage read error
    }
  }

  const params: Record<string, string> = {};
  if (grupo) params.grupo = grupo;
  const res = await gasGet<
    string[] | { contratas?: string[]; contratasMeta?: ContrataMeta[] }
  >('getContratas', params);
  const contratas = Array.isArray(res) ? res : (res.contratas ?? []);
  try {
    if (!grupo || grupo === 'ALL') {
      sessionStorage.setItem(STORAGE_KEYS.SESSION_CONTRATAS, JSON.stringify(contratas));
      if (!Array.isArray(res) && Array.isArray(res.contratasMeta)) {
        sessionStorage.setItem(
          STORAGE_KEYS.SESSION_CONTRATAS_META,
          JSON.stringify(res.contratasMeta),
        );
      }
    }
  } catch {
    // Ignore sessionStorage write error
  }
  return contratas;
}

function normalizeTurnRow(row: TurnRow): TurnRow {
  const rawEdited = (row as unknown as { admin_edited_fields?: string | string[] | null })
    .admin_edited_fields;
  const parsedEdited = parseAdminEditedFields(rawEdited);
  return {
    ...row,
    ...(parsedEdited.length > 0 ? { admin_edited_fields: parsedEdited } : { admin_edited_fields: [] }),
  };
}

export async function getTurn(
  fecha: string,
  contratista: string,
  rol: string,
  grupo?: UserGroupScope,
): Promise<TurnRow[]> {
  if (isDemoMode()) {
    const all = readLocalTurns();
    return all
      .map((row) =>
        normalizeTurnRow({
          ...row,
          grupo: (row.grupo ?? DEMO_CONTRATA_GROUP_MAP.get(row.contratista) ?? 'BT') as OperalogGroup,
        }),
      )
      .filter((row) => {
        if (row.fecha !== fecha) return false;
        if (grupo && grupo !== 'ALL' && row.grupo !== grupo) return false;
        if (rol === 'ADMIN' && contratista === 'ALL') return true;
        return row.contratista === contratista;
      });
  }

  const params: Record<string, string> = { fecha, contratista, rol };
  if (grupo) params.grupo = grupo;
  const res = await gasGet<TurnRow[] | { rows?: TurnRow[] }>('getTurn', params);
  const rows = Array.isArray(res) ? res : (res.rows ?? []);
  return rows.map(normalizeTurnRow);
}

export async function getTurnsRange(
  fechaInicio: string,
  fechaFin: string,
  contratista: string,
  rol: string,
  grupo?: UserGroupScope,
): Promise<TurnRow[]> {
  if (isDemoMode()) {
    const all = readLocalTurns();
    return all
      .map((row) =>
        normalizeTurnRow({
          ...row,
          grupo: (row.grupo ?? DEMO_CONTRATA_GROUP_MAP.get(row.contratista) ?? 'BT') as OperalogGroup,
        }),
      )
      .filter((row) => {
        if (!row.fecha) return false;
        if (fechaInicio && row.fecha < fechaInicio) return false;
        if (fechaFin && row.fecha > fechaFin) return false;
        if (grupo && grupo !== 'ALL' && row.grupo !== grupo) return false;
        if (rol === 'ADMIN' && (contratista === 'ALL' || !contratista)) return true;
        return row.contratista === contratista;
      });
  }

  const params: Record<string, string> = {
    fechaInicio,
    fechaFin,
    contratista,
    rol,
  };
  if (grupo) params.grupo = grupo;
  const res = await gasGet<TurnRow[] | { rows?: TurnRow[] }>('getTurnsRange', params);
  const rows = Array.isArray(res) ? res : (res.rows ?? []);
  return rows.map(normalizeTurnRow);
}

export async function getLastTurn(fecha: string, contratista: string): Promise<TurnRow[]> {
  if (isDemoMode()) {
    const all = readLocalTurns();
    const candidates = all.filter(
      (row) => row.contratista === contratista && row.fecha < fecha,
    );
    if (candidates.length === 0) return [];

    const latestFecha = candidates.reduce(
      (max, row) => (row.fecha > max ? row.fecha : max),
      candidates[0].fecha,
    );

    return candidates
      .filter((row) => row.fecha === latestFecha)
      .map((row, idx) => ({
        ...row,
        id: `cloned-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        fecha,
      }));
  }

  const res = await gasGet<TurnRow[] | { rows?: TurnRow[] }>('getLastTurn', { fecha, contratista });
  return Array.isArray(res) ? res : (res.rows ?? []);
}

export interface SaveTurnPayload {
  fecha: string;
  contratista: string;
  rows: TurnRow[];
  usuario?: string;
  grupo?: OperalogGroup;
}

export async function saveTurn(
  payload: SaveTurnPayload,
): Promise<{ ok: boolean; savedCount: number }> {
  if (isPastIsoDate(payload.fecha)) {
    throw new Error('No se pueden modificar ni guardar registros de días anteriores.');
  }

  const resolvedGrupo =
    payload.grupo ?? DEMO_CONTRATA_GROUP_MAP.get(payload.contratista) ?? 'BT';

  if (isDemoMode()) {
    const all = readLocalTurns();
    const filtered = all.filter(
      (row) => !(row.fecha === payload.fecha && row.contratista === payload.contratista),
    );
    const normalizedRows: TurnRow[] = payload.rows.map((row) => ({
      ...row,
      fecha: payload.fecha,
      contratista: payload.contratista,
      grupo: row.grupo ?? resolvedGrupo,
    }));
    writeLocalTurns([...filtered, ...normalizedRows]);
    return { ok: true, savedCount: normalizedRows.length };
  }

  return gasPost<{ ok: boolean; savedCount: number }>('saveTurn', {
    fecha: payload.fecha,
    contratista: payload.contratista,
    rows: payload.rows,
    usuario: payload.usuario ?? '',
    grupo: payload.grupo,
  });
}

export interface UpdateTurnRowPayload {
  id: string;
  fecha: string;
  contratista: string;
  changes: Partial<Record<EditableTurnField, string>>;
  usuario: string;
  rol: 'ADMIN' | 'CONTRATA';
  userGrupo?: UserGroupScope;
}

export async function updateTurnRow(
  payload: UpdateTurnRowPayload,
): Promise<{ ok: boolean; row: TurnRow; changedFields: EditableTurnField[] }> {
  if (payload.rol !== 'ADMIN') {
    throw new Error('Solo usuarios con rol ADMIN pueden editar registros.');
  }

  const today = getTodayIsoDate();
  if (payload.fecha !== today) {
    throw new Error('Solo se pueden editar registros del día de hoy.');
  }

  const sanitizedChanges: Partial<Record<EditableTurnField, string>> = {};
  for (const field of EDITABLE_TURN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload.changes, field)) {
      sanitizedChanges[field] = String(payload.changes[field] ?? '').trim();
    }
  }

  if (Object.keys(sanitizedChanges).length === 0) {
    throw new Error('No se indicaron campos válidos para actualizar.');
  }

  if (isDemoMode()) {
    const all = readLocalTurns();
    const targetIdx = all.findIndex(
      (r) =>
        r.id === payload.id &&
        r.fecha === payload.fecha &&
        r.contratista === payload.contratista,
    );
    if (targetIdx === -1) {
      throw new Error('No se encontró el registro a actualizar.');
    }

    const existing = all[targetIdx];
    const rowGroup = normalizeGroup(
      existing.grupo ?? DEMO_CONTRATA_GROUP_MAP.get(existing.contratista) ?? 'BT',
      'BT',
    );
    const allowedGroups = parseUserGroups(payload.userGrupo, 'ALL');
    if (
      payload.userGrupo &&
      normalizeGroup(payload.userGrupo, 'ALL') !== 'ALL' &&
      !allowedGroups.includes(rowGroup)
    ) {
      throw new Error(`No tienes permiso para editar registros del grupo ${rowGroup}.`);
    }

    const changedFields: EditableTurnField[] = [];
    const updatedRow: TurnRow = { ...existing, grupo: rowGroup };

    for (const [key, nextVal] of Object.entries(sanitizedChanges) as [
      EditableTurnField,
      string,
    ][]) {
      const prevVal = String(existing[key] ?? '').trim();
      if (prevVal !== nextVal) {
        if (key === 'frente') {
          updatedRow.frente = nextVal as FrontType;
        } else {
          updatedRow[key] = nextVal;
        }
        changedFields.push(key);
      }
    }

    if (changedFields.length === 0) {
      return { ok: true, row: normalizeTurnRow(updatedRow), changedFields: [] };
    }

    const mergedEdited = parseAdminEditedFields([
      ...parseAdminEditedFields(existing.admin_edited_fields),
      ...changedFields,
    ]);
    updatedRow.admin_edited_fields = mergedEdited;
    updatedRow.updated_at = new Date().toISOString();
    updatedRow.updated_by = payload.usuario;

    const nextAll = [...all];
    nextAll[targetIdx] = updatedRow;
    writeLocalTurns(nextAll);

    return { ok: true, row: normalizeTurnRow(updatedRow), changedFields };
  }

  const res = await gasPost<{
    ok: boolean;
    row: TurnRow;
    changedFields?: EditableTurnField[];
  }>('updateTurnRow', {
    id: payload.id,
    fecha: payload.fecha,
    contratista: payload.contratista,
    changes: sanitizedChanges,
    usuario: payload.usuario,
    rol: payload.rol,
  });

  return {
    ok: res.ok !== false,
    row: normalizeTurnRow(res.row),
    changedFields: parseAdminEditedFields(res.changedFields ?? []),
  };
}

export interface SaveCatalogPayload {
  items: CatalogItem[];
  rol?: 'ADMIN' | 'CONTRATA';
  usuario?: string;
  grupo?: UserGroupScope;
}

export async function saveCatalog(
  payload: SaveCatalogPayload | CatalogItem[],
): Promise<{ ok: boolean; items: CatalogItem[] }> {
  const items = Array.isArray(payload) ? payload : payload.items;
  const rol = Array.isArray(payload) ? 'ADMIN' : (payload.rol ?? 'ADMIN');
  const usuario = Array.isArray(payload) ? '' : (payload.usuario ?? '');
  const grupo = Array.isArray(payload) ? undefined : payload.grupo;

  if (isDemoMode()) {
    const normalizedTarget = grupo ? normalizeGroup(grupo, 'ALL') : 'ALL';
    if (normalizedTarget && normalizedTarget !== 'ALL') {
      const existing = readLocalCatalogs();
      const otherGroups = existing.filter(
        (c) => normalizeGroup(c.grupo, c.tipo === 'HORARIO' ? 'ALL' : 'BT') !== normalizedTarget,
      );
      const scopedItems = items.map((c) => ({
        ...c,
        grupo: normalizeGroup(c.grupo, normalizedTarget),
      }));
      const merged = [...otherGroups, ...scopedItems];
      writeLocalCatalogs(merged);
      return { ok: true, items: merged };
    }
    writeLocalCatalogs(items);
    return { ok: true, items };
  }

  const result = await gasPost<{ ok: boolean; items?: CatalogItem[] }>('saveCatalog', {
    items,
    rol,
    usuario,
    ...(grupo ? { grupo } : {}),
  });
  const updated = result.items ?? items;
  try {
    const normalizedTarget = grupo ? normalizeGroup(grupo, 'ALL') : 'ALL';
    if (normalizedTarget && normalizedTarget !== 'ALL') {
      const rawExisting = sessionStorage.getItem(STORAGE_KEYS.SESSION_CATALOGS);
      if (rawExisting) {
        const existing = JSON.parse(rawExisting) as CatalogItem[];
        if (Array.isArray(existing)) {
          const otherGroups = existing.filter(
            (c) => normalizeGroup(c.grupo, c.tipo === 'HORARIO' ? 'ALL' : 'BT') !== normalizedTarget,
          );
          sessionStorage.setItem(
            STORAGE_KEYS.SESSION_CATALOGS,
            JSON.stringify([...otherGroups, ...updated]),
          );
        } else {
          sessionStorage.removeItem(STORAGE_KEYS.SESSION_CATALOGS);
        }
      }
    } else {
      sessionStorage.setItem(STORAGE_KEYS.SESSION_CATALOGS, JSON.stringify(updated));
    }
  } catch {
    // Ignore sessionStorage write error
  }
  return { ok: true, items: updated };
}

export function createEmptyTurnRow(
  frente: FrontType,
  fecha: string,
  contratista: string,
  fixedActivity: string | null = null,
): TurnRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fecha,
    contratista,
    frente,
    nombres: '',
    usuario_ssam: '',
    celular: '',
    actividad: fixedActivity ?? '',
    skill: '',
    horario: '',
  };
}
