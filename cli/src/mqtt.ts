import mqtt from 'mqtt';
import type { MqttClient, PublishOptions, SimContext } from './types.js';

export function connectMqtt(ctx: SimContext): Promise<MqttClient> {
  const client = mqtt.connect(ctx.mqttUrl, {
    username: ctx.mqttUser || undefined,
    password: ctx.mqttPassword || undefined,
    clientId: `cosva-sim-${process.pid}`,
    reconnectPeriod: 2000,
    connectTimeout: 8000,
  });
  return new Promise<MqttClient>((resolve, reject) => {
    const timer = setTimeout(() => {
      client.end(true);
      reject(new Error(`Could not connect to the broker ${ctx.mqttUrl}`));
    }, 8000);
    client.once('connect', () => {
      clearTimeout(timer);
      resolve(client);
    });
    client.once('error', error => {
      clearTimeout(timer);
      client.end(true);
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

export function publishRaw(
  client: MqttClient,
  topic: string,
  payload: string,
  options: PublishOptions = {}
): Promise<void> {
  const body = String(payload);
  return new Promise<void>((resolve, reject) => {
    client.publish(
      topic,
      body,
      { qos: 1, retain: Boolean(options.retain) },
      error => {
        if (error) reject(error);
        else resolve();
      }
    );
  }).then(() => {
    if (options.quiet) return;
    const retain = options.retain ? '  retain' : '';
    console.log(`→ ${topic}  ${body}${retain}`);
  });
}

export function publishJson(
  client: MqttClient,
  topic: string,
  payload: unknown
): Promise<void> {
  return publishRaw(client, topic, JSON.stringify(payload));
}

export function endMqtt(client: MqttClient): Promise<void> {
  return new Promise<void>(resolve => {
    client.end(false, {}, () => resolve());
  });
}

export async function withMqtt<T>(
  ctx: SimContext,
  fn: (client: MqttClient) => Promise<T>
): Promise<T> {
  const client = await connectMqtt(ctx);
  console.log(`MQTT ${ctx.mqttUrl}`);
  try {
    return await fn(client);
  } finally {
    await endMqtt(client);
  }
}
