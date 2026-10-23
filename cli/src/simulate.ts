import {
  buildMilkWeights,
  engineHoldMs,
  hungHoldMs,
} from '@cosva-lab/iot-shared';
import {
  animalLeaves,
  equipStall,
  milkingCommand,
  publishScan,
  publishWeight,
  round3,
} from './topics.js';
import type { MqttClient, QueueItem, SimContext, StallRef } from './types.js';

export interface CancelHandle {
  requested: () => boolean;
  stop: () => void;
}

export function armCancel(): CancelHandle {
  const state = { requested: false };
  const onSigint = (): void => {
    state.requested = true;
    console.log('\nCancelling…');
  };
  process.on('SIGINT', onSigint);
  return {
    requested: () => state.requested,
    stop() {
      process.off('SIGINT', onSigint);
    },
  };
}

function cancelled(): Error {
  const error = new Error('Cancelled');
  error.name = 'CancelError';
  return error;
}

export async function sleep(
  ms: number,
  shouldCancel?: () => boolean
): Promise<void> {
  let left = ms;
  while (left > 0) {
    if (shouldCancel?.()) throw cancelled();
    const slice = Math.min(200, left);
    await new Promise<void>(resolve => setTimeout(resolve, slice));
    left -= slice;
  }
  if (shouldCancel?.()) throw cancelled();
}

async function placeEmptyCan(
  client: MqttClient,
  stall: StallRef,
  tareKg: number,
  shouldCancel?: () => boolean
): Promise<void> {
  await publishWeight(client, stall, 0.12);
  await sleep(800, shouldCancel);
  const steps = 5;
  for (let step = 1; step <= steps; step += 1) {
    const kg = Math.max(0.5, tareKg * (step / steps));
    await publishWeight(client, stall, kg);
    await sleep(350, shouldCancel);
  }
  await publishWeight(client, stall, tareKg);
  await sleep(400, shouldCancel);
}

async function sendStart(
  client: MqttClient,
  stall: StallRef,
  kg: number,
  shouldCancel?: () => boolean
): Promise<void> {
  await publishWeight(client, stall, kg);
  await milkingCommand(client, 'start', stall.id);
  await sleep(400, shouldCancel);
  await publishWeight(client, stall, kg);
  await milkingCommand(client, 'start', stall.id);
  await sleep(300, shouldCancel);
}

export interface RunOneInput {
  ctx: SimContext;
  client: MqttClient;
  item: QueueItem;
  canKg: number;
  placeCan: boolean;
  autoStart: boolean;
  quietRamp: boolean;
  shouldCancel?: () => boolean;
  pauseForStart: (item: QueueItem) => Promise<unknown>;
  pauseForFinish: (item: QueueItem) => Promise<unknown>;
}

/** One animal on one stall. Returns the kg left in the can after the cluster hangs. */
export async function runOneAnimal(input: RunOneInput): Promise<number> {
  const {
    ctx,
    client,
    item,
    placeCan,
    autoStart,
    quietRamp,
    shouldCancel,
    pauseForStart,
    pauseForFinish,
  } = input;
  const { stall, label, scan, milkKg, liters } = item;
  if (shouldCancel?.()) throw cancelled();
  console.log(
    `\nP${stall.number} · ${label} · ${liters.toFixed(3)} L (${milkKg.toFixed(3)} kg)`
  );
  let base = input.canKg;
  if (placeCan) {
    console.log(`P${stall.number} · empty can ${input.canKg.toFixed(3)} kg`);
    await placeEmptyCan(client, stall, input.canKg, shouldCancel);
    base = input.canKg;
  } else {
    await publishWeight(client, stall, base);
  }

  console.log(`P${stall.number} · scan ${scan}`);
  await publishScan(client, stall, scan);
  await publishWeight(client, stall, base);
  const presenceMs = engineHoldMs(ctx.presenceStableSeconds);
  console.log(
    `P${stall.number} · waiting for presence ${(presenceMs / 1000).toFixed(1)} s`
  );
  await sleep(presenceMs, shouldCancel);

  if (autoStart) {
    console.log(`P${stall.number} · Start`);
    await sendStart(client, stall, base, shouldCancel);
  } else {
    await pauseForStart(item);
  }

  let cursor = base;
  const machine = stall.machineWeightKg || 0;
  if (machine > 0) {
    cursor = round3(base + machine);
    console.log(`P${stall.number} · cluster +${machine.toFixed(3)} kg`);
    await publishWeight(client, stall, cursor);
    await sleep(400, shouldCancel);
  }

  const weights = buildMilkWeights(cursor, milkKg, ctx.noiseKg);
  for (const kg of weights) {
    await publishWeight(client, stall, kg, { quiet: true });
    if (quietRamp) console.log(`P${stall.number} · scale ${kg.toFixed(3)} kg`);
    else process.stdout.write(`\r  scale ${kg.toFixed(3)} kg`);
    await sleep(450, shouldCancel);
  }
  const withCluster = round3(base + machine + milkKg);
  await publishWeight(client, stall, withCluster, { quiet: true });
  if (quietRamp) {
    console.log(`P${stall.number} · scale ${withCluster.toFixed(3)} kg`);
  } else {
    process.stdout.write(`\r  scale ${withCluster.toFixed(3)} kg\n`);
  }
  const milkMs = engineHoldMs(ctx.milkStableSeconds);
  console.log(
    `P${stall.number} · holding ${withCluster.toFixed(3)} kg for ${(milkMs / 1000).toFixed(1)} s so the noise filter counts it`
  );
  await sleep(milkMs, shouldCancel);

  const filled = round3(base + milkKg);
  console.log(
    `P${stall.number} · hanging the cluster · can ${filled.toFixed(3)} kg`
  );
  await publishWeight(client, stall, filled);
  if (machine > 0) {
    const hangMs = hungHoldMs(ctx.milkStableSeconds);
    console.log(
      `P${stall.number} · holding the hung cluster ${(hangMs / 1000).toFixed(1)} s (quiet band within ${ctx.noiseKg} kg)`
    );
    await sleep(hangMs, shouldCancel);
  } else {
    await sleep(400, shouldCancel);
  }

  if (autoStart) {
    console.log(`P${stall.number} · Finish`);
    await milkingCommand(client, 'finish', stall.id);
    await sleep(600, shouldCancel);
  } else {
    await pauseForFinish(item);
  }

  console.log(`P${stall.number} · the animal leaves`);
  await animalLeaves(client, stall, scan);
  await publishWeight(client, stall, filled);
  return filled;
}

function groupByStall(items: QueueItem[]): Map<string, QueueItem[]> {
  const groups = new Map<string, QueueItem[]>();
  for (const item of items) {
    const list = groups.get(item.stall.id);
    if (list) list.push(item);
    else groups.set(item.stall.id, [item]);
  }
  return groups;
}

export interface RunQueueInput {
  ctx: SimContext;
  client: MqttClient;
  items: QueueItem[];
  tareKg: number;
  kept?: Map<string, number>;
  autoStart: boolean;
  pauseForStart: (item: QueueItem) => Promise<unknown>;
  pauseForFinish: (item: QueueItem) => Promise<unknown>;
}

/**
 * Same stall in order. Different stalls at once when Start is automatic.
 * Manual dashboard Start runs stalls one after another so the prompts don't collide.
 * Returns the kg left in each can.
 */
export async function runMilkQueue(
  input: RunQueueInput
): Promise<Map<string, number>> {
  const { ctx, client, items, tareKg, kept, autoStart } = input;
  if (items.length === 0) throw new Error('The queue is empty.');
  const groups = groupByStall(items);
  const parallel = autoStart && groups.size > 1;
  if (!autoStart && groups.size > 1) {
    console.log('With Start on the dashboard, stalls run one after another.');
  } else if (parallel) {
    console.log(`${groups.size} stalls at once.`);
  }

  for (const lane of groups.values()) {
    const stall = lane[0]?.stall;
    if (stall) await equipStall(client, stall, true);
  }
  const cancel = armCancel();
  const filled = new Map<string, number>();
  try {
    const runLane = async (lane: QueueItem[]): Promise<void> => {
      const stall = lane[0]?.stall;
      if (!stall) return;
      const remembered = kept?.get(stall.id);
      let canKg = remembered ?? tareKg;
      let placeCan = remembered === undefined;
      for (let index = 0; index < lane.length; index += 1) {
        const item = lane[index];
        if (!item) continue;
        canKg = await runOneAnimal({
          ctx,
          client,
          item,
          canKg,
          placeCan,
          autoStart,
          quietRamp: parallel,
          shouldCancel: cancel.requested,
          pauseForStart: input.pauseForStart,
          pauseForFinish: input.pauseForFinish,
        });
        placeCan = false;
        if (index < lane.length - 1) await sleep(1500, cancel.requested);
      }
      filled.set(stall.id, canKg);
    };
    if (parallel) {
      const settled = await Promise.allSettled(
        [...groups.values()].map(lane => runLane(lane))
      );
      const rejected = settled.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );
      if (rejected) throw rejected.reason;
    } else {
      for (const lane of groups.values()) {
        await runLane(lane);
      }
    }
  } finally {
    cancel.stop();
  }
  return filled;
}
