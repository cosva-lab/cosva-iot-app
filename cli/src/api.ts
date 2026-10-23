import { plaqueCounts, sortAnimals } from './animals.js';
import type {
  DashboardSnapshot,
  EdgeAnimal,
  Herd,
  SimContext,
} from './types.js';

async function getJson<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not reach the dashboard (${url}). ${message}`);
  }
  const text = await response.text();
  let body: { success?: boolean; error?: string; data?: T } = {};
  if (text) {
    try {
      body = JSON.parse(text) as { success?: boolean; error?: string; data?: T };
    } catch {
      throw new Error(`The dashboard did not return JSON (${url}).`);
    }
  }
  if (!response.ok || body.success === false) {
    throw new Error(body.error || `HTTP ${response.status} ${url}`);
  }
  return body.data as T;
}

export function fetchAnimals(ctx: SimContext): Promise<EdgeAnimal[]> {
  return getJson<EdgeAnimal[]>(`${ctx.apiBase}/animals`);
}

export function fetchDashboard(ctx: SimContext): Promise<DashboardSnapshot> {
  return getJson<DashboardSnapshot>(`${ctx.apiBase}/dashboard`);
}

export function milkedIdsFromDashboard(dashboard: DashboardSnapshot): Set<string> {
  const ids = new Set<string>();
  for (const row of dashboard.roster?.completed ?? []) {
    const id = row.animal?.id;
    if (id) ids.add(String(id));
  }
  return ids;
}

export async function loadHerd(ctx: SimContext): Promise<Herd> {
  const animals = await fetchAnimals(ctx);
  let milkedIds = new Set<string>();
  try {
    milkedIds = milkedIdsFromDashboard(await fetchDashboard(ctx));
  } catch {
    milkedIds = new Set();
  }
  const list = Array.isArray(animals) ? animals : [];
  return {
    animals: sortAnimals(list, milkedIds),
    counts: plaqueCounts(list),
    milkedIds,
    byId: new Map(list.map(animal => [String(animal.id), animal])),
  };
}
