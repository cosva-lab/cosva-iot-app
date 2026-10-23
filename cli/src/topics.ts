import { requireRfid, requireScale } from './context.js';
import { publishJson, publishRaw } from './mqtt.js';
import type {
  MqttClient,
  PublishOptions,
  SimContext,
  StallRef,
} from './types.js';

export function round3(kg: number): number {
  return Math.round(Number(kg) * 1000) / 1000;
}

export async function publishWeight(
  client: MqttClient,
  stall: StallRef,
  kg: number,
  options: PublishOptions = {}
): Promise<number> {
  requireScale(stall);
  const text = round3(kg).toFixed(3);
  await publishRaw(client, `cosva/scale/${stall.scaleId}/weight`, text, options);
  return round3(kg);
}

export async function setRfidOnline(
  client: MqttClient,
  stall: StallRef,
  online: boolean
): Promise<void> {
  requireRfid(stall);
  await publishRaw(
    client,
    `cosva/rfid/${stall.rfidId}/status`,
    online ? 'online' : 'offline',
    { retain: true }
  );
}

export async function setScaleOnline(
  client: MqttClient,
  stall: StallRef,
  online: boolean
): Promise<void> {
  requireScale(stall);
  await publishRaw(
    client,
    `cosva/scale/${stall.scaleId}/status`,
    online ? 'online' : 'offline',
    { retain: true }
  );
}

export async function setScaleLink(
  client: MqttClient,
  stall: StallRef,
  up: boolean
): Promise<void> {
  requireScale(stall);
  await publishRaw(
    client,
    `cosva/scale/${stall.scaleId}/link`,
    up ? 'up' : 'down',
    { retain: true }
  );
}

export async function equipStall(
  client: MqttClient,
  stall: StallRef,
  online: boolean
): Promise<void> {
  if (stall.rfidId) await setRfidOnline(client, stall, online);
  if (stall.scaleId) {
    await setScaleOnline(client, stall, online);
    await setScaleLink(client, stall, online);
  }
}

export async function equipAll(
  client: MqttClient,
  ctx: SimContext,
  online = true
): Promise<void> {
  for (const stall of ctx.stalls) {
    await equipStall(client, stall, online);
  }
}

export async function publishScan(
  client: MqttClient,
  stall: StallRef,
  scan: string
): Promise<void> {
  requireRfid(stall);
  await publishRaw(client, `cosva/rfid/${stall.rfidId}/tag`, scan);
  await publishRaw(client, `cosva/rfid/${stall.rfidId}/present`, scan);
}

export async function animalLeaves(
  client: MqttClient,
  stall: StallRef,
  scan?: string
): Promise<void> {
  requireRfid(stall);
  if (scan) {
    await publishRaw(client, `cosva/rfid/${stall.rfidId}/gone`, scan);
  }
  await publishRaw(client, `cosva/rfid/${stall.rfidId}/present`, 'none');
}

export async function milkingCommand(
  client: MqttClient,
  action: 'start' | 'finish',
  stallId: string
): Promise<void> {
  await publishJson(client, 'milking/cmd', { action, stallId });
}
