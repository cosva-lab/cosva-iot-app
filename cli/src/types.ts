import type { MqttClient } from 'mqtt';

export type { MqttClient };

export interface StallRef {
  id: string;
  number: number;
  rfidId: string;
  scaleId: string;
  measurement: string;
  machineWeightKg: number;
}

export interface SimContext {
  root: string;
  configPath: string;
  farmName: string;
  farmId: string;
  animalKind: string;
  density: number;
  noiseKg: number;
  presenceStableSeconds: number;
  milkStableSeconds: number;
  minMilkKg: number;
  tareMinKg: number;
  tareMaxKg: number;
  stalls: StallRef[];
  apiBase: string;
  mqttUrl: string;
  mqttUser: string;
  mqttPassword: string;
}

/** Animal row from GET /api/v1/animals. Identity is the Cosva id. */
export interface EdgeAnimal {
  id: string;
  name?: string | null;
  plaque?: string | null;
  rfid_uhf?: string | null;
  rfid_lf?: string | null;
  has_rfid?: boolean;
}

export interface Herd {
  animals: EdgeAnimal[];
  counts: Map<string, number>;
  milkedIds: Set<string>;
  byId: Map<string, EdgeAnimal>;
}

export interface QueueItem {
  stall: StallRef;
  animalId: string;
  label: string;
  scan: string;
  liters: number;
  milkKg: number;
}

export interface QueueSpecEntry {
  stallKey: string;
  animalId: string;
  liters: number;
}

export interface DashboardAnimal {
  id?: string;
  plaque?: string | null;
  name?: string | null;
}

export interface DashboardSnapshot {
  parlor_session: { farm_date?: string | null } | null;
  equipment?: { blockers?: { message?: string }[] };
  roster?: { completed?: { animal?: DashboardAnimal | null }[] };
  stalls?: {
    number: number;
    equipment: {
      rfid_online: boolean;
      scale_online: boolean;
      scale_link_up: boolean;
    } | null;
    animal?: { animal?: DashboardAnimal | null } | null;
    session?: {
      status?: string;
      live_milk_liters?: number | null;
      weight_kg?: number | null;
    } | null;
  }[];
}

export interface PublishOptions {
  retain?: boolean;
  quiet?: boolean;
}
