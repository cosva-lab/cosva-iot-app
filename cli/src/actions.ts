import { loadHerd, fetchDashboard } from './api.js';
import { animalLabel, scanPayload } from './animals.js';
import { assertTare, requireRfid, requireScale, requireStall } from './context.js';
import {
  askStartMode,
  pauseForFinish,
  pauseForStart,
  pickAnimal,
  resolveCans,
} from './prompt.js';
import { buildQueue, resolveQueueSpec } from './queue.js';
import { runMilkQueue } from './simulate.js';
import {
  animalLeaves,
  milkingCommand,
  publishScan,
  publishWeight,
  setRfidOnline,
  setScaleLink,
  setScaleOnline,
} from './topics.js';
import type {
  DashboardAnimal,
  MqttClient,
  QueueItem,
  SimContext,
} from './types.js';

function who(animal: DashboardAnimal | null | undefined): string {
  if (!animal) return 'empty';
  const plaque = String(animal.plaque || '').trim();
  const name = String(animal.name || '').trim();
  if (plaque && name) return `${plaque} — ${name}`;
  return plaque || name || '—';
}

export async function showStatus(ctx: SimContext): Promise<void> {
  const data = await fetchDashboard(ctx);
  if (data?.parlor_session) {
    console.log(`Parlor open · ${data.parlor_session.farm_date || ''}`);
  } else {
    console.log(
      'Parlor is closed. Bring equipment online, then open it on the dashboard.'
    );
  }
  const blockers = data?.equipment?.blockers ?? [];
  if (blockers.length === 0) console.log('Equipment ready.');
  for (const blocker of blockers) {
    if (blocker.message) console.log(`  ${blocker.message}`);
  }
  for (const stall of data?.stalls ?? []) {
    const equipment = stall.equipment;
    const session = stall.session;
    const bits = [
      `P${stall.number}`,
      equipment
        ? `RFID ${equipment.rfid_online ? 'online' : 'offline'}`
        : 'RFID ?',
      equipment
        ? `scale ${equipment.scale_online ? 'online' : 'offline'}/${equipment.scale_link_up ? 'up' : 'down'}`
        : '',
      who(stall.animal?.animal),
      session?.status || '',
      session?.live_milk_liters != null
        ? `${Number(session.live_milk_liters).toFixed(3)} L`
        : '',
      session?.weight_kg != null
        ? `${Number(session.weight_kg).toFixed(3)} kg`
        : '',
    ].filter(Boolean);
    console.log(bits.join('  '));
  }
}

export async function printAnimals(
  ctx: SimContext,
  search?: string
): Promise<void> {
  const herd = await loadHerd(ctx);
  const query = String(search || '').trim().toLowerCase();
  const rows = herd.animals.filter(animal => {
    if (!query) return true;
    const hay =
      `${animal.plaque || ''} ${animal.name || ''} ${animal.rfid_uhf || ''} ${animal.rfid_lf || ''} ${animal.id}`.toLowerCase();
    return hay.includes(query);
  });
  if (rows.length === 0) {
    console.log('No animals.');
    return;
  }
  console.log('Cosva id · animal');
  for (const animal of rows) {
    console.log(
      `${animal.id}  ${animalLabel(animal, herd.counts, herd.milkedIds)}`
    );
  }
}

export async function setRfid(
  ctx: SimContext,
  client: MqttClient,
  args: { stall: string | number; state: string }
): Promise<void> {
  const stall = requireRfid(requireStall(ctx, args.stall));
  await setRfidOnline(client, stall, args.state === 'online');
}

export async function setScale(
  ctx: SimContext,
  client: MqttClient,
  args: { stall: string | number; state?: string; link?: string }
): Promise<void> {
  const stall = requireScale(requireStall(ctx, args.stall));
  if (args.link) {
    await setScaleLink(client, stall, args.link === 'up');
    return;
  }
  await setScaleOnline(client, stall, args.state === 'online');
}

export async function setWeight(
  ctx: SimContext,
  client: MqttClient,
  kg: number,
  stallKey: string | number
): Promise<void> {
  const stall = requireScale(requireStall(ctx, stallKey));
  if (!Number.isFinite(kg) || kg < 0) {
    throw new Error('Pass a weight in kg, for example --kg 4.2');
  }
  await publishWeight(client, stall, kg);
}

export async function scanAnimal(
  ctx: SimContext,
  client: MqttClient,
  stallKey: string | number,
  animalId?: string
): Promise<{ stallId: string; scan: string }> {
  const stall = requireRfid(requireStall(ctx, stallKey));
  const herd = await loadHerd(ctx);
  const animal = animalId
    ? herd.byId.get(String(animalId))
    : await pickAnimal(herd);
  if (!animal) {
    throw new Error(
      `Animal ${animalId} is not on the edge. See: npm run sim -- animals`
    );
  }
  const scan = scanPayload(animal);
  if (!scan) throw new Error(`Animal ${animal.id} has no Cosva id.`);
  await publishScan(client, stall, scan);
  return { stallId: stall.id, scan };
}

export async function leaveAnimal(
  ctx: SimContext,
  client: MqttClient,
  stallKey: string | number,
  options: { animalId?: string; scan?: string } = {}
): Promise<void> {
  const stall = requireRfid(requireStall(ctx, stallKey));
  let scan = options.scan;
  if (options.animalId) {
    const herd = await loadHerd(ctx);
    const animal = herd.byId.get(String(options.animalId));
    if (!animal) {
      throw new Error(`Animal ${options.animalId} is not on the edge.`);
    }
    scan = scanPayload(animal);
  }
  await animalLeaves(client, stall, scan);
}

export async function commandStall(
  ctx: SimContext,
  client: MqttClient,
  action: 'start' | 'finish',
  stallKey: string | number
): Promise<void> {
  const stall = requireStall(ctx, stallKey);
  await milkingCommand(client, action, stall.id);
}

export async function runQueue(
  ctx: SimContext,
  client: MqttClient,
  items: QueueItem[],
  options: {
    tareKg: number;
    autoStart?: boolean;
    kept?: Map<string, number>;
  }
): Promise<Map<string, number>> {
  const kept = options.kept ?? new Map<string, number>();
  const placing = items.some(item => !kept.has(item.stall.id));
  const tareKg = placing ? assertTare(ctx, options.tareKg) : options.tareKg;
  const autoStart = options.autoStart !== false;
  if (!autoStart && !process.stdin.isTTY) {
    throw new Error('Without a terminal, use --auto-start.');
  }
  const filled = await runMilkQueue({
    ctx,
    client,
    items,
    tareKg,
    kept,
    autoStart,
    pauseForStart,
    pauseForFinish,
  });
  console.log('Done. Check the dashboard.');
  return filled;
}

export async function milkFromSpec(
  ctx: SimContext,
  client: MqttClient,
  args: { queue: string; tare: number; autoStart?: boolean }
): Promise<Map<string, number>> {
  const items = await resolveQueueSpec(ctx, args.queue);
  return runQueue(ctx, client, items, {
    tareKg: args.tare,
    autoStart: args.autoStart,
  });
}

export async function milkInteractive(
  ctx: SimContext,
  client: MqttClient,
  remembered: Map<string, number>
): Promise<Map<string, number>> {
  const items = await buildQueue(ctx);
  if (!items) return remembered;
  const autoStart = await askStartMode();
  const { kept, tareKg } = await resolveCans(ctx, items, remembered);
  const filled = await runQueue(ctx, client, items, {
    tareKg,
    autoStart,
    kept,
  });
  const next = new Map(remembered);
  for (const [stallId, kg] of filled) next.set(stallId, kg);
  return next;
}
