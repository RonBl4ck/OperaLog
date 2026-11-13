import { CatalogItem, FrontType, TurnRow, UserSession } from '../types/operalog';

const GAS_URL =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_GAS_URL ?? '').trim();

const STORAGE_KEYS = {
  CATALOGS: 'operalog_demo_catalogs_v1',
  TURNS: 'operalog_demo_turns_v1',
  SESSION_CATALOGS: 'operalog_cache_catalogs_v1',
  SESSION_CONTRATAS: 'operalog_cache_contratas_v1',
} as const;

interface DemoUserRecord extends UserSession {
  pin: string;
}

const DEMO_USERS: DemoUserRecord[] = [
  {
    usuario: 'admin.pluz',
    pin: '1234',
    rol: 'ADMIN',
    contratista: 'ALL',
    nombre_mostrar: 'Administrador PLUZ',
  },
  {
    usuario: 'contrata.alfa',
    pin: '5678',
    rol: 'CONTRATA',
    contratista: 'ALFA',
    nombre_mostrar: 'Contrata ALFA',
  },
  {
    usuario: 'contrata.beta',
    pin: '5678',
    rol: 'CONTRATA',
    contratista: 'BETA',
    nombre_mostrar: 'Contrata BETA',
  },
];

const DEMO_CONTRATAS = ['ALFA', 'BETA'];

const DEFAULT_CATALOGS: CatalogItem[] = [
  // HORARIO (ALL)
  { tipo: 'HORARIO', frente: 'ALL', valor: '06:00 - 22:00', orden: 1, activo: true },
  { tipo: 'HORARIO', frente: 'ALL', valor: '07:00 - 23:00', orden: 2, activo: true },
  { tipo: 'HORARIO', frente: 'ALL', valor: '07:00 - 16:00', orden: 3, activo: true },
  { tipo: 'HORARIO', frente: 'ALL', valor: '15:00 - 07:00', orden: 4, activo: true },
  { tipo: 'HORARIO', frente: 'ALL', valor: '23:00 - 07:00', orden: 5, activo: true },

  // ACTIVIDAD (DESPACHADORES)
  { tipo: 'ACTIVIDAD', frente: 'DESPACHADORES', valor: 'RECLAMO', orden: 1, activo: true },
  { tipo: 'ACTIVIDAD', frente: 'DESPACHADORES', valor: 'REPARACIONES', orden: 2, activo: true },
  { tipo: 'ACTIVIDAD', frente: 'DESPACHADORES', valor: 'APOYO RECLAMOS', orden: 3, activo: true },
  { tipo: 'ACTIVIDAD', frente: 'DESPACHADORES', valor: 'APOYO REPARACIONES', orden: 4, activo: true },

  // SKILL (RECLAMOS)
  { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'TOMA', orden: 1, activo: true },
  { tipo: 'SKILL', frente: 'RECLAMOS', valor: 'TOMA + CNX AEREA', orden: 2, activo: true },

  // SKILL (TEKO)
  { tipo: 'SKILL', frente: 'TEKO', valor: 'CNX AEREA + RED AEREA', orden: 1, activo: true },

  // SKILL (REPARACIONES)
  { tipo: 'SKILL', frente: 'REPARACIONES', valor: 'CNX SUBTERRANEA', orden: 1, activo: true },
  { tipo: 'SKILL', frente: 'REPARACIONES', valor: 'RED + CNX SUBTERRANEA', orden: 2, activo: true },
];

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

async function gasGet<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(GAS_URL);
  url.searchParams.set('action', action);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), { method: 'GET' });
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
}

export async function getPublicUsers(): Promise<PublicUserOption[]> {
  if (isDemoMode()) {
    return DEMO_USERS.map(({ pin: _omit, ...u }) => {
      void _omit;
      return u;
    });
  }
  const CACHE_KEY = 'operalog_public_users_v1';
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as PublicUserOption[];
    }
  } catch {
    // Ignore sessionStorage read error
  }
  try {
    const res = await gasGet<PublicUserOption[] | { users?: PublicUserOption[] }>('listUsers');
    const users = Array.isArray(res) ? res : (res.users ?? []);
    if (users.length > 0) {
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(users));
      } catch {
        // Ignore sessionStorage write error
      }
    }
    return users;
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
    UserSession | { user?: UserSession; catalogs?: CatalogItem[]; contratas?: string[] }
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
    } catch {
      // Ignore sessionStorage write error
    }
    return res.user;
  }

  return res as UserSession;
}

export async function getCatalogs(): Promise<CatalogItem[]> {
  if (isDemoMode()) {
    return readLocalCatalogs();
  }

  try {
    const cached = sessionStorage.getItem(STORAGE_KEYS.SESSION_CATALOGS);
    if (cached) {
      return JSON.parse(cached) as CatalogItem[];
    }
  } catch {
    // Ignore sessionStorage read error
  }

  const res = await gasGet<CatalogItem[] | { catalogs?: CatalogItem[] }>('getCatalogs');
  const catalogs = Array.isArray(res) ? res : (res.catalogs ?? []);
  try {
    sessionStorage.setItem(STORAGE_KEYS.SESSION_CATALOGS, JSON.stringify(catalogs));
  } catch {
    // Ignore sessionStorage write error
  }
  return catalogs;
}

export async function getContratas(): Promise<string[]> {
  if (isDemoMode()) {
    return [...DEMO_CONTRATAS];
  }

  try {
    const cached = sessionStorage.getItem(STORAGE_KEYS.SESSION_CONTRATAS);
    if (cached) {
      return JSON.parse(cached) as string[];
    }
  } catch {
    // Ignore sessionStorage read error
  }

  const res = await gasGet<string[] | { contratas?: string[] }>('getContratas');
  const contratas = Array.isArray(res) ? res : (res.contratas ?? []);
  try {
    sessionStorage.setItem(STORAGE_KEYS.SESSION_CONTRATAS, JSON.stringify(contratas));
  } catch {
    // Ignore sessionStorage write error
  }
  return contratas;
}

export async function getTurn(
  fecha: string,
  contratista: string,
  rol: string,
): Promise<TurnRow[]> {
  if (isDemoMode()) {
    const all = readLocalTurns();
    return all.filter((row) => {
      if (row.fecha !== fecha) return false;
      if (rol === 'ADMIN' && contratista === 'ALL') return true;
      return row.contratista === contratista;
    });
  }

  const res = await gasGet<TurnRow[] | { rows?: TurnRow[] }>('getTurn', { fecha, contratista, rol });
  return Array.isArray(res) ? res : (res.rows ?? []);
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
}

export async function saveTurn(
  payload: SaveTurnPayload,
): Promise<{ ok: boolean; savedCount: number }> {
  if (isDemoMode()) {
    const all = readLocalTurns();
    const filtered = all.filter(
      (row) => !(row.fecha === payload.fecha && row.contratista === payload.contratista),
    );
    const normalizedRows: TurnRow[] = payload.rows.map((row) => ({
      ...row,
      fecha: payload.fecha,
      contratista: payload.contratista,
    }));
    writeLocalTurns([...filtered, ...normalizedRows]);
    return { ok: true, savedCount: normalizedRows.length };
  }

  return gasPost<{ ok: boolean; savedCount: number }>('saveTurn', {
    fecha: payload.fecha,
    contratista: payload.contratista,
    rows: payload.rows,
    usuario: payload.usuario ?? '',
  });
}

export interface SaveCatalogPayload {
  items: CatalogItem[];
}

export async function saveCatalog(
  payload: SaveCatalogPayload | CatalogItem[],
): Promise<{ ok: boolean; items: CatalogItem[] }> {
  const items = Array.isArray(payload) ? payload : payload.items;

  if (isDemoMode()) {
    writeLocalCatalogs(items);
    return { ok: true, items };
  }

  const result = await gasPost<{ ok: boolean; items?: CatalogItem[] }>('saveCatalog', {
    items,
  });
  const updated = result.items ?? items;
  try {
    sessionStorage.setItem(STORAGE_KEYS.SESSION_CATALOGS, JSON.stringify(updated));
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
