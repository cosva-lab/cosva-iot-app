import { confirm, input, number, search, select } from '@inquirer/prompts';
import { animalLabel } from './animals.js';
import { defaultTare, stallLine } from './context.js';
import type {
  EdgeAnimal,
  Herd,
  QueueItem,
  SimContext,
  StallRef,
} from './types.js';

export async function pickStall(
  ctx: SimContext,
  options: { scaleOnly?: boolean; message?: string } = {}
): Promise<StallRef> {
  const stalls = options.scaleOnly
    ? ctx.stalls.filter(stall => stall.scaleId)
    : ctx.stalls;
  if (stalls.length === 0) {
    throw new Error('No stall with a scale in config.yml.');
  }
  const only = stalls[0];
  if (stalls.length === 1 && only) return only;
  const id = await select({
    message: options.message ?? 'Stall',
    choices: stalls.map(stall => ({
      name: stallLine(stall),
      value: stall.id,
    })),
  });
  const stall = stalls.find(item => item.id === id);
  if (!stall) throw new Error('Unknown stall.');
  return stall;
}

export async function pickAnimal(
  herd: Herd,
  excludeIds?: Set<string>
): Promise<EdgeAnimal> {
  const available = herd.animals.filter(
    animal => !excludeIds?.has(String(animal.id))
  );
  if (available.length === 0) {
    throw new Error(
      herd.animals.length === 0
        ? 'No animals on the edge. Sync the herd from the dashboard.'
        : 'Every animal is already in the queue or already milked.'
    );
  }
  const id = await search({
    message: 'Animal (plaque, name, or RFID)',
    pageSize: 12,
    source(term) {
      const query = String(term || '').trim().toLowerCase();
      const rows = available
        .filter(animal => {
          if (!query) return true;
          const hay =
            `${animal.plaque || ''} ${animal.name || ''} ${animal.rfid_uhf || ''} ${animal.rfid_lf || ''} ${animal.id}`.toLowerCase();
          return hay.includes(query);
        })
        .slice(0, 40);
      if (rows.length === 0) {
        return [{ name: 'No matches', value: '', disabled: true }];
      }
      return rows.map(animal => ({
        name: animalLabel(animal, herd.counts, herd.milkedIds),
        value: animal.id,
      }));
    },
  });
  const animal = herd.byId.get(String(id));
  if (!animal) throw new Error('Pick an animal from the list.');
  return animal;
}

export async function askLiters(ctx: SimContext): Promise<number> {
  const liters = await number({
    message: 'Liters (1.3 or 0.670)',
    default: 1.2,
    min: 0.05,
    max: 40,
    step: 'any',
    validate(value) {
      const milkKg = Number(value) * ctx.density;
      if (!Number.isFinite(milkKg) || milkKg < ctx.minMilkKg) {
        return `Those liters are under the minimum (${ctx.minMilkKg} kg).`;
      }
      return true;
    },
  });
  if (liters === undefined || !Number.isFinite(liters) || liters <= 0) {
    throw new Error('Invalid liters.');
  }
  return liters;
}

export async function askTare(ctx: SimContext): Promise<number> {
  const tareKg = await number({
    message: `Empty can weight (kg, ${ctx.tareMinKg}–${ctx.tareMaxKg})`,
    default: defaultTare(ctx),
    min: ctx.tareMinKg,
    max: ctx.tareMaxKg,
    step: 'any',
  });
  if (tareKg === undefined || !Number.isFinite(tareKg)) {
    throw new Error('Invalid can weight.');
  }
  return tareKg;
}

export async function askKg(): Promise<number> {
  const kg = await number({
    message: 'Scale weight (kg)',
    min: 0,
    max: 80,
    step: 'any',
  });
  if (kg === undefined || !Number.isFinite(kg) || kg < 0) {
    throw new Error('Invalid weight.');
  }
  return kg;
}

/** true = the CLI sends Start and Finish. */
export function askStartMode(): Promise<boolean> {
  return select({
    message: 'How each animal starts',
    choices: [
      {
        name: 'I press Start and Finish on the dashboard',
        value: false,
      },
      { name: 'Send Start and Finish from here', value: true },
    ],
  });
}

export function pauseForStart(item: QueueItem): Promise<string> {
  return input({
    message: `P${item.stall.number} · press Start on the dashboard, then Enter`,
  });
}

export function pauseForFinish(item: QueueItem): Promise<string> {
  return input({
    message: `P${item.stall.number} · press Finish on the dashboard, then Enter`,
  });
}

export async function resolveCans(
  ctx: SimContext,
  items: QueueItem[],
  remembered?: Map<string, number>
): Promise<{ kept: Map<string, number>; tareKg: number }> {
  const stalls: StallRef[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.stall.id)) continue;
    seen.add(item.stall.id);
    stalls.push(item.stall);
  }
  const kept = new Map<string, number>();
  let needsTare = false;
  for (const stall of stalls) {
    const current = remembered?.get(stall.id);
    if (current === undefined) {
      needsTare = true;
      continue;
    }
    const keep = await confirm({
      message: `P${stall.number}: the can is still at ${current.toFixed(3)} kg. Add milk on top?`,
      default: true,
    });
    if (keep) kept.set(stall.id, current);
    else needsTare = true;
  }
  const tareKg = needsTare ? await askTare(ctx) : defaultTare(ctx);
  return { kept, tareKg };
}

export function askOnline(message: string): Promise<'online' | 'offline'> {
  return select({
    message,
    choices: [
      { name: 'Online', value: 'online' as const },
      { name: 'Offline', value: 'offline' as const },
    ],
  });
}
