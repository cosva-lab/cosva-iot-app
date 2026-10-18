#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * Demo interactiva de ordeño vía MQTT (firmware topics).
 *
 * Uso (desde cosva-iot-app):
 *   npm run demo:milking
 *
 * Requisitos:
 *   - Docker stack arriba (mosquitto + sensor + dashboard)
 *   - Animales sincronizados en la finca de config.yml
 *   - Ordeño abierto en la UI (Empezar a ordeñar / turno)
 *   - Recomendado: milking.data_source: simulated  (no sube a Cosva)
 */

const path = require('path');
const { ConfigLoader } = require('@cosva-lab/iot-shared');
const { DatabaseClient, ANIMAL_STATUS } = require('@cosva-lab/iot-db');
const { ask, confirm, choose, pressEnter } = require('../lib/prompt');
const { connectMqtt } = require('../lib/mqttClient');
const {
  bringEquipmentOnline,
  bringEquipmentOffline,
  runMilkingSequence,
} = require('../lib/milkingSequence');

// Load .env from app root if present
try {
  require('dotenv').config({
    path: path.join(__dirname, '../../.env'),
  });
} catch {
  /* optional */
}

const config = ConfigLoader.getInstance().loadConfig();
const density =
  Number(config.milking?.milk_density_kg_per_liter) > 0
    ? Number(config.milking.milk_density_kg_per_liter)
    : 1.032;

function stallRefs() {
  return (config.stalls || []).map(s => ({
    id: String(s.id),
    number: Number(s.number),
    rfidId: String(s.rfid_id || s.rfidId || ''),
    scaleId: String(s.scale_id || s.scaleId || ''),
  }));
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} farmToken
 */
async function loadAnimals(prisma, farmToken) {
  return prisma.animal.findMany({
    where: {
      farmToken: String(farmToken),
      status: ANIMAL_STATUS.active,
    },
    orderBy: [{ name: 'asc' }, { plaque: 'asc' }],
    select: {
      id: true,
      name: true,
      plaque: true,
      tagNumber: true,
      rfidUhf: true,
      rfidLf: true,
      animalKind: true,
    },
  });
}

/**
 * Prefer UHF → LF → plaque → tagNumber for MQTT RFID payload.
 * @param {{ rfidUhf?: string|null, rfidLf?: string|null, plaque?: string|null, tagNumber?: string|null, name?: string|null, id: string }} a
 */
function animalRfidTag(a) {
  return (
    (a.rfidUhf && String(a.rfidUhf).trim()) ||
    (a.rfidLf && String(a.rfidLf).trim()) ||
    (a.plaque && String(a.plaque).trim()) ||
    (a.tagNumber && String(a.tagNumber).trim()) ||
    `demo:${a.id}`
  );
}

/**
 * @param {{ name?: string|null, plaque?: string|null, tagNumber?: string|null, rfidUhf?: string|null, id: string }} a
 */
function animalLabel(a) {
  const name = a.name || 'Sin nombre';
  const plaque = a.plaque || a.tagNumber || '—';
  const tag = animalRfidTag(a);
  return `${name} · placa ${plaque} · RFID ${tag}`;
}

/**
 * @param {Awaited<ReturnType<typeof loadAnimals>>} animals
 * @param {string} query
 */
function filterAnimals(animals, query) {
  const q = query.trim().toLowerCase();
  if (!q) return animals;
  return animals.filter(a => {
    const hay = [a.name, a.plaque, a.tagNumber, a.rfidUhf, a.rfidLf, a.id]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

async function pickAnimal(animals) {
  for (;;) {
    const q = await ask(
      'Buscar animal (nombre/placa/RFID, vacío = listar primeros 30)',
      ''
    );
    let list = filterAnimals(animals, q);
    if (list.length === 0) {
      console.log('  No hay coincidencias. Intenta otra búsqueda.');
      continue;
    }
    if (list.length > 30) {
      console.log(`  ${list.length} resultados — mostrando 30. Afina la búsqueda.`);
      list = list.slice(0, 30);
    }
    const options = [
      ...list.map(a => ({
        label: animalLabel(a),
        value: a,
      })),
      { label: '↻ Otra búsqueda', value: null },
      { label: '✎ Ingresar RFID manual', value: 'manual' },
    ];
    const picked = await choose('Elige animal', options, 0);
    if (picked === null) continue;
    if (picked === 'manual') {
      const tag = await ask('RFID / placa a publicar en MQTT');
      if (!tag) continue;
      return {
        id: `manual:${tag}`,
        label: `Manual · RFID ${tag}`,
        rfidTag: tag,
      };
    }
    return {
      id: picked.id,
      label: animalLabel(picked),
      rfidTag: animalRfidTag(picked),
    };
  }
}

async function buildQueue(stalls, animals) {
  /** @type {import('../lib/milkingSequence').QueueItem[]} */
  const queue = [];
  let roundRobin = 0;

  console.log('\n📦 Armar cola de ordeño (uno o varios animales)');
  for (;;) {
    const stall =
      stalls.length === 1
        ? stalls[0]
        : await choose(
            'Puesto',
            stalls.map(s => ({
              label: `Puesto ${s.number} (${s.rfidId} / ${s.scaleId})`,
              value: s,
            })),
            roundRobin % stalls.length
          );
    roundRobin += 1;

    const animal = await pickAnimal(animals);

    const unit = await choose(
      'Unidad de la producción total',
      [
        { label: 'Litros (L) — se convierte a kg con densidad', value: 'L' },
        { label: 'Kilogramos (kg) — valor directo de báscula', value: 'kg' },
      ],
      0
    );

    const defaultAmt = unit === 'L' ? '1.20' : '1.24';
    const amtRaw = await ask(
      unit === 'L' ? 'Litros totales del ordeño' : 'Kg totales de leche',
      defaultAmt
    );
    const amount = Number(amtRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      console.log('  Valor inválido, saltando este animal.');
      continue;
    }

    const milkKg = unit === 'L' ? amount * density : amount;
    const milkLiters = unit === 'L' ? amount : amount / density;

    const tareRaw = await ask('Peso cantina vacía (kg, tare)', '3.50');
    let tareKg = Number(tareRaw);
    if (!Number.isFinite(tareKg) || tareKg < 1 || tareKg > 9) {
      console.log('  Tare fuera de rango 1–9; usando 3.50');
      tareKg = 3.5;
    }

    queue.push({ stall, animal, milkKg, milkLiters, tareKg });
    console.log(
      `  + Cola: puesto ${stall.number} · ${animal.label} · ${milkLiters.toFixed(2)} L (${milkKg.toFixed(2)} kg)`
    );

    if (!(await confirm('¿Agregar otro animal a la cola?', true))) break;
  }
  return queue;
}

async function main() {
  console.log('\n🎬 Cosva · Demo interactiva de ordeño (MQTT)');
  console.log('==========================================');
  console.log(`Finca: ${config.farm.name} (id ${config.farm.id})`);
  console.log(`Broker: ${config.mqtt.broker_url}`);
  console.log(
    `Densidad: ${density} kg/L · data_source: ${config.milking?.data_source || 'real'}`
  );
  if (config.milking?.data_source !== 'simulated') {
    console.log(
      '\n⚠  Tip: en config.yml pon  milking.data_source: simulated'
    );
    console.log(
      '   para no subir a Cosva y saltar el gate de equipos en Start.'
    );
  }

  const stalls = stallRefs().filter(s => s.rfidId && s.scaleId);
  if (stalls.length === 0) {
    console.error('No hay stalls con rfid_id/scale_id en config.yml');
    process.exit(1);
  }

  const prisma = DatabaseClient.getInstance(config.database).getPrismaClient();
  await prisma.$connect();

  let farmToken = String(config.farm.id);
  let animals = await loadAnimals(prisma, farmToken);
  if (animals.length === 0) {
    console.log(
      `\nNo hay animales active en farmToken=${farmToken}.`
    );
    const tokens = await prisma.animal.groupBy({
      by: ['farmToken'],
      _count: true,
      orderBy: { farmToken: 'asc' },
    });
    if (tokens.length) {
      console.log('Farm tokens con animales:');
      tokens.forEach(t =>
        console.log(`  · ${t.farmToken} (${t._count})`)
      );
      farmToken = await ask(
        '¿Qué farmToken usar para la demo?',
        tokens[0].farmToken
      );
      animals = await loadAnimals(prisma, farmToken);
    }
  }

  if (animals.length === 0) {
    console.log(
      '\nSin animales en BD. Puedes ingresar RFID manual en cada paso.'
    );
    // Placeholder so pickAnimal still offers manual
    animals = [];
  } else {
    console.log(`\n${animals.length} animales active (farmToken=${farmToken})`);
  }

  // Synthetic empty list still allows manual RFID via pickAnimal
  if (animals.length === 0) {
    animals = [
      {
        id: 'demo-placeholder',
        name: '(usa búsqueda → RFID manual)',
        plaque: null,
        tagNumber: null,
        rfidUhf: null,
        rfidLf: null,
        animalKind: null,
      },
    ];
  }

  const queue = await buildQueue(stalls, animals);
  if (queue.length === 0) {
    console.log('Cola vacía. Saliendo.');
    await prisma.$disconnect();
    process.exit(0);
  }

  const mode = await choose(
    'Modo de reproducción',
    [
      {
        label: 'Automático (tiempos realistas, acelerables)',
        value: 'auto',
      },
      {
        label: 'Paso a paso (Enter entre cada fase — ideal para narrar)',
        value: 'step',
      },
    ],
    0
  );

  const speed =
    mode === 'step'
      ? 1
      : Number(
          await choose(
            'Velocidad',
            [
              { label: '1× (lento / realista)', value: '1' },
              { label: '2×', value: '2' },
              { label: '4× (demo rápida)', value: '4' },
            ],
            1
          )
        );

  const autoStart = await confirm(
    '¿Auto-Start por MQTT? (No = tú haces clic en Iniciar en la UI)',
    true
  );

  const onlineEq = await confirm(
    '¿Publicar equipos RFID/báscula como online al inicio?',
    true
  );

  /** @type {Map<string, typeof queue>} */
  const byStall = new Map();
  for (const item of queue) {
    const key = item.stall.id;
    const list = byStall.get(key);
    if (list) list.push(item);
    else byStall.set(key, [item]);
  }

  console.log('\n📋 Plan de demo (secuencial por puesto, paralelo entre puestos):');
  for (const [, lane] of byStall) {
    const n = lane[0].stall.number;
    console.log(`  Puesto ${n} (${lane.length} animal${lane.length === 1 ? '' : 'es'}):`);
    lane.forEach((item, i) => {
      console.log(
        `    ${i + 1}. ${item.animal.label} → ${item.milkLiters.toFixed(2)} L (tare ${item.tareKg.toFixed(2)} kg)`
      );
    });
  }
  console.log(
    `  Modo: ${mode} · velocidad ${speed}× · autoStart: ${autoStart ? 'sí' : 'no'} · ${byStall.size} lane(s)`
  );

  if (!(await confirm('\n¿Ejecutar ahora?', true))) {
    console.log('Cancelado.');
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(
    '\n💡 Abre el parlor (http://localhost:3500 o :3001), con turno abierto.'
  );
  await pressEnter('Enter cuando la UI esté lista');

  const client = await connectMqtt(config.mqtt);
  console.log('✓ MQTT conectado');

  const usedStalls = [
    ...new Map(queue.map(q => [q.stall.id, q.stall])).values(),
  ];

  try {
    if (onlineEq) {
      console.log('📡 Equipos → online');
      await bringEquipmentOnline(client, usedStalls);
      await sleep(1500);
    }

    // Parallel lanes (one per stall); sequential animals within each lane.
    // Step mode stays global-sequential so Enter prompts do not interleave.
    if (mode === 'step') {
      for (const [, lane] of byStall) {
        for (let i = 0; i < lane.length; i++) {
          const item = lane[i];
          console.log(
            `\n═══ Puesto ${item.stall.number} · ${i + 1}/${lane.length} ═══`
          );
          await runMilkingSequence({
            client,
            item,
            speed,
            mode,
            autoStart,
            waitStep: () => pressEnter('Enter → siguiente fase'),
          });
          if (i < lane.length - 1) {
            await pressEnter('Enter → siguiente animal en este puesto');
          }
        }
      }
    } else {
      await Promise.all(
        [...byStall.values()].map(async lane => {
          for (let i = 0; i < lane.length; i++) {
            const item = lane[i];
            console.log(
              `\n═══ Puesto ${item.stall.number} · ${i + 1}/${lane.length} ═══`
            );
            await runMilkingSequence({
              client,
              item,
              speed,
              mode,
              autoStart,
            });
            if (i < lane.length - 1) await sleep(1500 / speed);
          }
        })
      );
    }

    if (
      onlineEq &&
      (await confirm('\n¿Dejar equipos offline al terminar?', false))
    ) {
      await bringEquipmentOffline(client, usedStalls);
    }

    console.log('\n✅ Demo terminada.');
  } finally {
    client.end(true);
    await prisma.$disconnect();
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(err => {
  console.error('\n❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
