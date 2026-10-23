import { select } from '@inquirer/prompts';
import {
  commandStall,
  leaveAnimal,
  milkInteractive,
  scanAnimal,
  setRfid,
  setScale,
  setWeight,
  showStatus,
} from './actions.js';
import { header, requireScale } from './context.js';
import { connectMqtt, endMqtt } from './mqtt.js';
import { askKg, askOnline, pickStall } from './prompt.js';
import { equipAll } from './topics.js';
import type { SimContext } from './types.js';

const MENU = [
  { name: 'Dashboard status', value: 'status' as const },
  { name: 'Bring all equipment online', value: 'equip' as const },
  { name: 'RFID online or offline', value: 'rfid' as const },
  { name: 'Scale online, offline, or link', value: 'scale' as const },
  { name: 'Set a scale weight', value: 'weight' as const },
  { name: 'Scan an animal', value: 'scan' as const },
  { name: 'Animal leaves the stall', value: 'gone' as const },
  { name: 'Milk several animals', value: 'milk' as const },
  { name: 'Send Start', value: 'start' as const },
  { name: 'Send Finish', value: 'finish' as const },
  { name: 'Exit', value: 'exit' as const },
];

async function scaleMenu(
  ctx: SimContext,
  client: Awaited<ReturnType<typeof connectMqtt>>
): Promise<void> {
  const stall = requireScale(await pickStall(ctx, { scaleOnly: true }));
  const action = await select({
    message: `P${stall.number} scale`,
    choices: [
      { name: 'Online', value: 'online' as const },
      { name: 'Offline', value: 'offline' as const },
      { name: 'Link up', value: 'up' as const },
      { name: 'Link down', value: 'down' as const },
    ],
  });
  if (action === 'up' || action === 'down') {
    await setScale(ctx, client, { stall: stall.number, link: action });
    return;
  }
  await setScale(ctx, client, { stall: stall.number, state: action });
}

export async function menu(ctx: SimContext): Promise<void> {
  console.log(header(ctx));
  const client = await connectMqtt(ctx);
  console.log(`MQTT ${ctx.mqttUrl}\n`);
  let cans = new Map<string, number>();
  const lastScan = new Map<string, string>();
  try {
    while (true) {
      const action = await select({ message: 'Sensors', choices: MENU });
      if (action === 'exit') break;
      if (action === 'status') {
        await showStatus(ctx);
        continue;
      }
      if (action === 'equip') {
        await equipAll(client, ctx, true);
        console.log(
          'Equipment online. You can open the parlor on the dashboard.'
        );
        continue;
      }
      if (action === 'rfid') {
        const stall = await pickStall(ctx);
        const state = await askOnline(`P${stall.number} RFID`);
        await setRfid(ctx, client, { stall: stall.number, state });
        continue;
      }
      if (action === 'scale') {
        await scaleMenu(ctx, client);
        continue;
      }
      if (action === 'weight') {
        const stall = await pickStall(ctx, { scaleOnly: true });
        const kg = await askKg();
        await setWeight(ctx, client, kg, stall.number);
        continue;
      }
      if (action === 'scan') {
        const stall = await pickStall(ctx);
        const result = await scanAnimal(ctx, client, stall.number);
        lastScan.set(result.stallId, result.scan);
        continue;
      }
      if (action === 'gone') {
        const stall = await pickStall(ctx);
        await leaveAnimal(ctx, client, stall.number, {
          scan: lastScan.get(stall.id),
        });
        lastScan.delete(stall.id);
        continue;
      }
      if (action === 'milk') {
        cans = await milkInteractive(ctx, client, cans);
        for (const stallId of cans.keys()) lastScan.delete(stallId);
        continue;
      }
      const stall = await pickStall(ctx);
      await commandStall(ctx, client, action, stall.number);
    }
  } finally {
    await endMqtt(client);
  }
  console.log('Done.');
}
