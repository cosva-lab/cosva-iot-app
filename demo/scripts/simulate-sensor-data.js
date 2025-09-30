#!/usr/bin/env node
// @ts-check

/**
 * Simulador de datos de sensores RFID para Cosva IoT
 * Este script simula detecciones de sensores y publica eventos MQTT
 */

const { ConfigLoader, Logger, LogLevel } = require('@cosva-lab/iot-shared');
const { DatabaseService, StallService } = require('@cosva-lab/iot-db');

const mqtt = require('mqtt');

const configLoader = ConfigLoader.getInstance();
const appConfig = configLoader.loadConfig();
const { mqtt: mqttConfig } = appConfig;

// Configuración de simulación
const simulationConfig = {
  SIMULATION_INTERVAL_MIN: parseInt(process.env.SIM_INTERVAL_MIN || '5') * 1000,
  SIMULATION_INTERVAL_MAX:
    parseInt(process.env.SIM_INTERVAL_MAX || '15') * 1000,
  DETECTION_PROBABILITY: parseFloat(process.env.DETECTION_PROB || '0.7'),
  EXIT_PROBABILITY: parseFloat(process.env.EXIT_PROB || '0.1'),
};

// Datos de las vacas (se cargarán desde la base de datos)
let databaseService = null;

// Estado de las vacas
const cowStates = new Map();

// Función para cargar vacas desde la base de datos
async function loadCowsFromDatabase() {
  let cows = [];
  try {
    console.log('🔄 Conectando a la base de datos...');
    databaseService = DatabaseService.getInstance(appConfig.database);
    await databaseService.connect();

    console.log('📊 Cargando vacas desde la base de datos...');
    const dbCows = await databaseService.cows.findByFarmToken(
      appConfig.farm.id
    );

    if (dbCows && dbCows.length > 0) {
      // Mapear datos de la base de datos al formato de simulación
      cows = dbCows.map((cow, index) => ({
        id: cow.id,
        name: cow.name || `Vaca ${index + 1}`,
        rfid: cow.tagNumber,
        sensor: `RFID${String(index + 1).padStart(2, '0')}`,
        stall: index + 1, // Los stalls se definen en config.yml
      }));

      console.log(`✅ Cargadas ${cows.length} vacas desde la base de datos`);
    } else {
      console.log(
        '⚠️ No se encontraron vacas en la base de datos, usando datos de fallback'
      );
    }
  } catch (error) {
    console.error(
      '❌ Error cargando vacas desde la base de datos:',
      error.message
    );
    console.log('🔄 Usando datos de fallback...');
  }

  // Inicializar estados de las vacas
  cows.forEach(cow => {
    cowStates.set(cow.id, {
      present: false,
      lastDetection: null,
      stall: null,
    });
  });
  return cows;
}

// Función para cerrar la conexión a la base de datos
async function closeDatabaseConnection() {
  if (databaseService) {
    try {
      await databaseService.close();
      console.log('🔌 Conexión a la base de datos cerrada');
    } catch (error) {
      console.error(
        '❌ Error cerrando conexión a la base de datos:',
        error.message
      );
    }
  }
}

// Conectar a MQTT
const client = mqtt.connect(mqttConfig.broker_url, {
  clientId: 'cosva-sensor-simulator',
  clean: true,
});

client.on('connect', async () => {
  console.log('🔌 Conectado al broker MQTT');
  const cows = await loadCowsFromDatabase();
  await new StallService(
    {
      database: appConfig.database,
      farmId: appConfig.farm.id,
      stalls: appConfig.stalls,
    },
    databaseService,
    new Logger('simulate-sensor-data', LogLevel.INFO)
  ).initialize();
  startSimulation(cows);
});

client.on('error', error => {
  console.error('❌ Error MQTT:', error);
});

// Función para simular detección
function simulateDetection(cow) {
  const now = new Date();
  const state = cowStates.get(cow.id);

  // Simular probabilidad de detección
  if (Math.random() < simulationConfig.DETECTION_PROBABILITY) {
    const detection = {
      id: `det-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sensor_id: cow.sensor,
      rfid_tag: cow.rfid,
      timestamp: now.toISOString(),
      signal_strength: Math.floor(Math.random() * 20) - 60, // -60 a -40 dBm
      raw_data: JSON.stringify({
        raw: cow.rfid,
        rssi: Math.floor(Math.random() * 20) - 60,
        timestamp: now.getTime(),
      }),
    };

    // Publicar evento de detección
    const detectionTopic = `sensors/rfid/${cow.sensor}/detections`;
    client.publish(detectionTopic, JSON.stringify(detection), { qos: 1 });

    console.log(
      `📡 Detección: ${cow.name} (${cow.rfid}) en sensor ${cow.sensor}`
    );

    // Actualizar estado de presencia
    if (!state.present) {
      state.present = true;
      state.stall = cow.stall;
      state.lastDetection = now;

      // Publicar evento de entrada
      const presence = {
        id: `pres-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sensor_id: cow.sensor,
        cow_id: cow.id,
        status: 'ENTERED',
        timestamp: now.toISOString(),
        duration: 0,
      };

      const presenceTopic = `sensors/rfid/${cow.sensor}/presence`;
      client.publish(presenceTopic, JSON.stringify(presence), { qos: 1 });

      console.log(`🚪 Entrada: ${cow.name} entró al puesto ${cow.stall}`);
    } else {
      // Actualizar duración de presencia
      const duration = Math.floor((+now - state.lastDetection) / 1000);

      const presence = {
        id: `pres-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sensor_id: cow.sensor,
        cow_id: cow.id,
        status: 'STILL_PRESENT',
        timestamp: now.toISOString(),
        duration: duration,
      };

      const presenceTopic = `sensors/rfid/${cow.sensor}/presence`;
      client.publish(presenceTopic, JSON.stringify(presence), { qos: 1 });
    }
  } else {
    // Simular salida ocasional
    if (state.present && Math.random() < simulationConfig.EXIT_PROBABILITY) {
      state.present = false;
      state.stall = null;

      const presence = {
        id: `pres-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sensor_id: cow.sensor,
        cow_id: cow.id,
        status: 'LEFT',
        timestamp: now.toISOString(),
        duration: Math.floor((+now - state.lastDetection) / 1000),
      };

      const presenceTopic = `sensors/rfid/${cow.sensor}/presence`;
      client.publish(presenceTopic, JSON.stringify(presence), { qos: 1 });

      console.log(`🚪 Salida: ${cow.name} salió del puesto ${cow.stall}`);
    }
  }
}

// Función para iniciar la simulación
function startSimulation(cows) {
  console.log('🎬 Iniciando simulación de sensores...');
  console.log('📊 Vacas configuradas:', cows.length);
  console.log(
    `⏰ Intervalo de simulación: ${
      simulationConfig.SIMULATION_INTERVAL_MIN / 1000
    }-${simulationConfig.SIMULATION_INTERVAL_MAX / 1000} segundos`
  );
  console.log(
    `🎯 Probabilidad de detección: ${(
      simulationConfig.DETECTION_PROBABILITY * 100
    ).toFixed(0)}%`
  );
  console.log('🛑 Presiona Ctrl+C para detener\n');

  // Simular detecciones con intervalo configurable
  setInterval(() => {
    cows.forEach(cow => {
      simulateDetection(cow);
    });
  }, Math.random() * (simulationConfig.SIMULATION_INTERVAL_MAX - simulationConfig.SIMULATION_INTERVAL_MIN) + simulationConfig.SIMULATION_INTERVAL_MIN);
}

// Manejar cierre del programa
process.on('SIGINT', async () => {
  console.log('\n🛑 Deteniendo simulación...');
  client.end();
  await closeDatabaseConnection();
  process.exit(0);
});

console.log('🚀 Simulador de sensores Cosva IoT');
console.log('=====================================');
