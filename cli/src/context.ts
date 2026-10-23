import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import yaml from 'js-yaml';
import { milkDensityForAnimalKind } from '@cosva-lab/iot-shared';
import type { SimContext, StallRef } from './types.js';

interface YamlConfig {
  farm?: { id?: string; name?: string };
  stalls?: {
    id?: string;
    number?: number;
    rfid_id?: string;
    measurement?: {
      type?: string;
      id?: string;
      machine_weight_kg?: number;
    };
  }[];
  milking?: {
    animal_kind?: string;
    milk_density_kg_per_liter?: number;
    noise_kg?: number;
    presence_stable_seconds?: number;
    milk_stable_seconds?: number;
    min_milk_kg?: number;
    tare_min_kg?: number;
    tare_max_kg?: number;
  };
}

export function appRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

function num(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stallFromYaml(raw: NonNullable<YamlConfig['stalls']>[number]): StallRef {
  const measurement = raw.measurement ?? {};
  const type = String(measurement.type || 'scale');
  const machine = Number(measurement.machine_weight_kg);
  return {
    id: String(raw.id),
    number: Number(raw.number),
    rfidId: String(raw.rfid_id || '').trim(),
    scaleId: type === 'scale' ? String(measurement.id || '').trim() : '',
    measurement: type,
    machineWeightKg:
      Number.isFinite(machine) && machine > 0 ? Math.min(machine, 5) : 0,
  };
}

export function loadContext(): SimContext {
  const root = appRoot();
  dotenv.config({ path: path.join(root, '.env') });
  const configName = process.env.CONFIG_FILE || 'config.yml';
  const configPath = path.isAbsolute(configName)
    ? configName
    : path.join(root, configName);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Cannot find ${configPath}`);
  }
  const loaded = yaml.load(fs.readFileSync(configPath, 'utf8'));
  if (!loaded || typeof loaded !== 'object') {
    throw new Error(`Cannot read ${configPath}`);
  }
  const raw = loaded as YamlConfig;
  const milking = raw.milking ?? {};
  const animalKind = String(milking.animal_kind || 'CAPRINE').toUpperCase();
  const override = num(milking.milk_density_kg_per_liter, 0);
  const density =
    override > 0 ? override : milkDensityForAnimalKind(animalKind);
  const stalls = (Array.isArray(raw.stalls) ? raw.stalls : [])
    .map(stallFromYaml)
    .filter(stall => stall.id && stall.id !== 'undefined');
  if (stalls.length === 0) {
    throw new Error(`No stalls in ${configPath}`);
  }
  const port = String(process.env.DASHBOARD_SERVICE_PORT || '3500');
  const apiBase = (
    process.env.SIM_API_URL || `http://127.0.0.1:${port}/api/v1`
  ).replace(/\/+$/, '');
  const mqttPort = process.env.MQTT_PORT || '1883';
  return {
    root,
    configPath,
    farmName: raw.farm?.name || raw.farm?.id || 'farm',
    farmId: String(raw.farm?.id || ''),
    animalKind,
    density,
    noiseKg: Math.max(num(milking.noise_kg, 0.05), 0.001),
    presenceStableSeconds: num(milking.presence_stable_seconds, 1.5),
    milkStableSeconds: num(milking.milk_stable_seconds, 2.5),
    minMilkKg: num(milking.min_milk_kg, 0.05),
    tareMinKg: num(milking.tare_min_kg, 1),
    tareMaxKg: num(milking.tare_max_kg, 9),
    stalls,
    apiBase,
    mqttUrl: process.env.MQTT_BROKER_URL || `mqtt://127.0.0.1:${mqttPort}`,
    mqttUser: process.env.MQTT_USERNAME || '',
    mqttPassword: process.env.MQTT_PASSWORD || '',
  };
}

export function stallLine(stall: StallRef): string {
  const scale = stall.scaleId ? `scale ${stall.scaleId}` : stall.measurement;
  const rfid = stall.rfidId ? `RFID ${stall.rfidId}` : 'no reader';
  return `P${stall.number} · ${rfid} · ${scale}`;
}

export function header(ctx: SimContext): string {
  return [
    `Sensor simulator — ${ctx.farmName}`,
    `${ctx.mqttUrl} · ${ctx.apiBase}`,
    `${ctx.animalKind} · ${ctx.density} kg/L · noise ${ctx.noiseKg} kg`,
    ctx.stalls.map(stallLine).join('\n'),
  ].join('\n');
}

export function stallByKey(
  ctx: SimContext,
  key: string | number | undefined
): StallRef | null {
  const text = String(key ?? '').trim();
  if (!text) return null;
  return (
    ctx.stalls.find(
      stall => stall.id === text || String(stall.number) === text
    ) ?? null
  );
}

export function requireStall(
  ctx: SimContext,
  key: string | number | undefined
): StallRef {
  const stall = stallByKey(ctx, key);
  if (!stall) {
    const list = ctx.stalls.map(item => item.number).join(', ');
    throw new Error(`Unknown stall ${key}. Stalls: ${list}`);
  }
  return stall;
}

export function requireScale(stall: StallRef): StallRef {
  if (!stall.scaleId) {
    throw new Error(
      `Stall ${stall.number} has no scale (measurement.type: ${stall.measurement}).`
    );
  }
  return stall;
}

export function requireRfid(stall: StallRef): StallRef {
  if (!stall.rfidId) {
    throw new Error(`Stall ${stall.number} has no rfid_id in config.yml.`);
  }
  return stall;
}

export function defaultTare(ctx: SimContext): number {
  if (3.5 >= ctx.tareMinKg && 3.5 <= ctx.tareMaxKg) return 3.5;
  return ctx.tareMinKg;
}

export function assertTare(ctx: SimContext, tareKg: number): number {
  if (
    !Number.isFinite(tareKg) ||
    tareKg < ctx.tareMinKg ||
    tareKg > ctx.tareMaxKg
  ) {
    throw new Error(
      `The empty can must weigh between ${ctx.tareMinKg} and ${ctx.tareMaxKg} kg.`
    );
  }
  return tareKg;
}
