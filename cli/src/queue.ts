import { select } from '@inquirer/prompts';
import { loadHerd } from './api.js';
import { animalLabel, scanPayload } from './animals.js';
import { requireScale, requireStall } from './context.js';
import { askLiters, pickAnimal, pickStall } from './prompt.js';
import { round3 } from './topics.js';
import type {
  EdgeAnimal,
  Herd,
  QueueItem,
  QueueSpecEntry,
  SimContext,
  StallRef,
} from './types.js';

const QUEUE_HINT = 'stall:cosvaId:liters. Example: 1:123:1.3,1:456:0.670';

export function parseQueueSpec(spec: string | undefined): QueueSpecEntry[] {
  const tokens = String(spec || '')
    .split(',')
    .map(token => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    throw new Error(`The queue is ${QUEUE_HINT}`);
  }
  return tokens.map(token => {
    const parts = token.split(':');
    if (parts.length < 3) {
      throw new Error(
        `"${token}" is not ${QUEUE_HINT}. Use a dot for decimals: 0.670`
      );
    }
    const stallKey = parts[0]?.trim() ?? '';
    const liters = Number(parts[parts.length - 1]);
    const animalId = parts.slice(1, -1).join(':').trim();
    if (!stallKey || !animalId || !Number.isFinite(liters) || liters <= 0) {
      throw new Error(
        `"${token}" is not ${QUEUE_HINT}. Use a dot for decimals: 0.670`
      );
    }
    return { stallKey, animalId, liters };
  });
}

export function formatQueue(items: QueueItem[]): string {
  if (items.length === 0) return 'Queue is empty.';
  return items
    .map(
      (item, index) =>
        `${index + 1}. P${item.stall.number} · ${item.label} · ${item.liters.toFixed(3)} L`
    )
    .join('\n');
}

export function toQueueItem(
  ctx: SimContext,
  herd: Herd,
  stall: StallRef,
  animal: EdgeAnimal,
  liters: number
): QueueItem {
  const scan = scanPayload(animal);
  if (!scan) {
    throw new Error(`Animal ${animal.id} has no Cosva id.`);
  }
  const milkKg = round3(liters * ctx.density);
  if (milkKg < ctx.minMilkKg) {
    throw new Error(
      `${liters} L is ${milkKg} kg, under the minimum (${ctx.minMilkKg} kg).`
    );
  }
  return {
    stall,
    animalId: String(animal.id),
    label: animalLabel(animal, herd.counts, herd.milkedIds),
    scan,
    liters,
    milkKg,
  };
}

export async function resolveQueueSpec(
  ctx: SimContext,
  spec: string
): Promise<QueueItem[]> {
  const herd = await loadHerd(ctx);
  return parseQueueSpec(spec).map(entry => {
    const stall = requireScale(requireStall(ctx, entry.stallKey));
    const animal = herd.byId.get(entry.animalId);
    if (!animal) {
      throw new Error(
        `Animal ${entry.animalId} is not on the edge. See: npm run sim -- animals`
      );
    }
    return toQueueItem(ctx, herd, stall, animal, entry.liters);
  });
}

/** null when the user goes back. */
export async function buildQueue(ctx: SimContext): Promise<QueueItem[] | null> {
  const herd = await loadHerd(ctx);
  if (herd.animals.length === 0) {
    throw new Error(
      'No animals on the edge. Sync the herd from the dashboard.'
    );
  }
  const items: QueueItem[] = [];
  while (true) {
    const taken = new Set(herd.milkedIds);
    for (const item of items) taken.add(item.animalId);
    const remaining = herd.animals.filter(
      animal => !taken.has(String(animal.id))
    ).length;
    console.log(`\n${formatQueue(items)}`);
    if (remaining === 0) {
      console.log('No animals left to add.');
    }
    const action = await select({
      message: 'Milking queue',
      choices: [
        {
          name: 'Add animal',
          value: 'add' as const,
          disabled: remaining === 0,
        },
        {
          name: 'Remove last',
          value: 'pop' as const,
          disabled: items.length === 0,
        },
        {
          name: 'Clear',
          value: 'clear' as const,
          disabled: items.length === 0,
        },
        {
          name: 'Run milking',
          value: 'run' as const,
          disabled: items.length === 0,
        },
        { name: 'Back', value: 'back' as const },
      ],
    });
    if (action === 'back') return null;
    if (action === 'run') return items;
    if (action === 'pop') {
      items.pop();
      continue;
    }
    if (action === 'clear') {
      items.length = 0;
      continue;
    }
    const stall = await pickStall(ctx, { scaleOnly: true });
    const animal = await pickAnimal(herd, taken);
    const liters = await askLiters(ctx);
    items.push(toQueueItem(ctx, herd, stall, animal, liters));
  }
}
