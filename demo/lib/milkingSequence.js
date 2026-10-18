// @ts-check
'use strict';

const { publishRaw, publishJson } = require('./mqttClient');

/**
 * @typedef {object} StallRef
 * @property {string} id
 * @property {number} number
 * @property {string} rfidId
 * @property {string} scaleId
 */

/**
 * @typedef {object} DemoAnimal
 * @property {string} id
 * @property {string} label
 * @property {string} rfidTag
 */

/**
 * @typedef {object} QueueItem
 * @property {StallRef} stall
 * @property {DemoAnimal} animal
 * @property {number} milkKg
 * @property {number} milkLiters
 * @property {number} tareKg
 */

/**
 * @typedef {object} SequenceOptions
 * @property {import('mqtt').MqttClient} client
 * @property {QueueItem} item
 * @property {number} speed  // 1 = realtime-ish, 2 = 2x faster
 * @property {'auto'|'step'} mode
 * @property {boolean} autoStart
 * @property {number} [noiseKg]  // must match milking.noise_kg (default 0.05)
 * @property {(msg: string) => void} [log]
 * @property {() => Promise<void>} [waitStep]
 */

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * @param {SequenceOptions} opts
 * @param {number} ms
 */
async function pause(opts, ms) {
  const wait = Math.max(50, Math.round(ms / Math.max(0.25, opts.speed)));
  if (opts.mode === 'step' && opts.waitStep) {
    await opts.waitStep();
    return;
  }
  await sleep(wait);
}

/**
 * @param {SequenceOptions} opts
 * @param {string} msg
 */
function log(opts, msg) {
  (opts.log || console.log)(msg);
}

/**
 * Bring RFID + scale online (retained status/link) for demo equipment badges.
 * @param {import('mqtt').MqttClient} client
 * @param {StallRef[]} stalls
 */
async function bringEquipmentOnline(client, stalls) {
  for (const stall of stalls) {
    await publishRaw(client, `cosva/rfid/${stall.rfidId}/status`, 'online', {
      retain: true,
    });
    await publishRaw(client, `cosva/scale/${stall.scaleId}/status`, 'online', {
      retain: true,
    });
    await publishRaw(client, `cosva/scale/${stall.scaleId}/link`, 'up', {
      retain: true,
    });
  }
}

/**
 * @param {import('mqtt').MqttClient} client
 * @param {StallRef[]} stalls
 */
async function bringEquipmentOffline(client, stalls) {
  for (const stall of stalls) {
    await publishRaw(client, `cosva/scale/${stall.scaleId}/link`, 'down', {
      retain: true,
    });
    await publishRaw(client, `cosva/scale/${stall.scaleId}/status`, 'offline', {
      retain: true,
    });
    await publishRaw(client, `cosva/rfid/${stall.rfidId}/status`, 'offline', {
      retain: true,
    });
  }
}

/**
 * Publish a weight sample (kg as decimal string, like firmware).
 * @param {import('mqtt').MqttClient} client
 * @param {string} scaleId
 * @param {number} kg
 */
async function publishWeight(client, scaleId, kg) {
  await publishRaw(
    client,
    `cosva/scale/${scaleId}/weight`,
    kg.toFixed(3),
    { retain: false }
  );
}

/**
 * Steps large enough for MilkingSessionEngine.trackMilk (Δ > noise_kg).
 * @param {number} tareKg
 * @param {number} milkKg
 * @param {number} noiseKg
 * @returns {number[]}
 */
function buildMilkWeights(tareKg, milkKg, noiseKg) {
  const minStep = Math.max(noiseKg * 1.2, 0.06);
  const target = tareKg + milkKg;
  /** @type {number[]} */
  const weights = [];
  let current = tareKg;
  while (current + minStep < target) {
    current = Math.min(target, current + minStep);
    weights.push(current);
  }
  if (weights.length === 0 || weights[weights.length - 1] < target - 0.001) {
    weights.push(target);
  }
  return weights;
}

/**
 * Realistic milking for one animal at one stall.
 * Respects ADR-005 (tare on Start) + noise_kg peak updates.
 *
 * @param {SequenceOptions} opts
 */
async function runMilkingSequence(opts) {
  const { client, item, autoStart } = opts;
  const { stall, animal, milkKg, tareKg } = item;
  const noiseKg =
    opts.noiseKg && opts.noiseKg > 0 ? opts.noiseKg : 0.05;
  const rfid = stall.rfidId;
  const scale = stall.scaleId;

  log(
    opts,
    `\n── Puesto ${stall.number} · ${animal.label} · +${milkKg.toFixed(2)} kg ──`
  );

  // 1) Empty platform
  log(opts, '① Plataforma vacía');
  await publishWeight(client, scale, 0.12 + Math.random() * 0.08);
  await pause(opts, 800);

  // 2) Animal detected (tag + present)
  log(opts, `② RFID detecta ${animal.rfidTag}`);
  await publishRaw(client, `cosva/rfid/${rfid}/tag`, animal.rfidTag);
  await publishRaw(client, `cosva/rfid/${rfid}/present`, animal.rfidTag);
  await pause(opts, 1400);

  // 3) Place empty cantina (tare range ~1–9 kg) — DETECTED shows weight, not milk
  log(opts, `③ Coloca cantina vacía (~${tareKg.toFixed(2)} kg)`);
  const placeSteps = 5;
  for (let i = 1; i <= placeSteps; i++) {
    const kg = (tareKg * i) / placeSteps + (Math.random() - 0.5) * 0.01;
    await publishWeight(client, scale, Math.max(0.5, kg));
    await pause(opts, 350);
  }
  log(opts, '   estabilizando tare…');
  for (let i = 0; i < 4; i++) {
    await publishWeight(client, scale, tareKg);
    await pause(opts, 500);
  }

  // 4) Operator Start freezes baseline (ADR-005)
  if (autoStart) {
    log(opts, '④ Auto-Start (congela tare)');
    await publishWeight(client, scale, tareKg);
    await pause(opts, 400);
    await publishJson(client, 'milking/cmd', {
      action: 'start',
      stallId: stall.id,
    });
    await pause(opts, 1800);
  } else {
    log(
      opts,
      '④ Esperando Start en la UI (haz clic en Iniciar en el puesto)…'
    );
    if (opts.waitStep) {
      await opts.waitStep();
    } else {
      await pause(opts, 8000);
    }
  }

  // 5) Milk fill — each step must exceed noise_kg
  log(opts, `⑤ Ordeñando → +${milkKg.toFixed(2)} kg (pasos > noise ${noiseKg})`);
  const milkWeights = buildMilkWeights(tareKg, milkKg, noiseKg);
  for (const kg of milkWeights) {
    await publishWeight(client, scale, kg);
    await pause(opts, 450);
  }
  const target = tareKg + milkKg;
  await publishWeight(client, scale, target);
  await pause(opts, 1200);

  // 6) Finish FIRST (locks production), then animal leaves
  log(opts, '⑥ Finish (bloquea producción)');
  await publishJson(client, 'milking/cmd', {
    action: 'finish',
    stallId: stall.id,
  });
  await pause(opts, 1000);

  log(opts, '⑦ Animal sale (RFID gone)');
  await publishRaw(client, `cosva/rfid/${rfid}/gone`, animal.rfidTag);
  await publishRaw(client, `cosva/rfid/${rfid}/present`, 'none');
  await pause(opts, 600);

  log(opts, '⑧ Retira cantina');
  for (let i = 3; i >= 0; i--) {
    await publishWeight(client, scale, (target * i) / 3);
    await pause(opts, 250);
  }
  await publishWeight(client, scale, 0.1);

  log(opts, `✓ Listo puesto ${stall.number}`);
}

module.exports = {
  bringEquipmentOnline,
  bringEquipmentOffline,
  runMilkingSequence,
  publishWeight,
  buildMilkWeights,
};
