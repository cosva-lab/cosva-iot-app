#!/usr/bin/env node

/**
 * Script para mostrar el estado actual del sistema Cosva IoT
 */

const { ConfigLoader } = require('@cosva-lab/iot-shared');
const { DatabaseClient } = require('@cosva-lab/iot-db');

const configLoader = ConfigLoader.getInstance();
const appConfig = configLoader.loadConfig();

async function showSystemStatus() {
  /**
   * @type {import('@prisma/client').PrismaClient}
   */
  let client;
  try {
    console.log('🔄 Conectando a la base de datos...');
    client = DatabaseClient.getInstance(appConfig).getPrismaClient();
    await client.$connect();

    console.log('🐄 Cosva IoT Smart Farm - Estado del Sistema');
    console.log('==============================================\n');

    // Mostrar vacas
    console.log('📋 VACAS REGISTRADAS:');
    const cows = await client.cow.findMany({
      where: {
        farmToken: appConfig.farm.id,
      },
      include: {
        presences: {
          where: {
            status: 'STILL_PRESENT',
          },
        },
      },
    });

    if (cows && cows.length > 0) {
      for (const cow of cows) {
        const isPresent = cow.presences && cow.presences.length > 0;
        const presenceInfo = isPresent ? '🟢 STILL_PRESENT' : '🔴 No presente';

        console.log(
          `  • ${cow.name} (${cow.tagNumber}) - ${cow.breed || 'N/A'}`
        );
        console.log(`    ${presenceInfo}`);
        if (cow.birthDate) {
          console.log(
            `    Nacimiento: ${new Date(cow.birthDate).toLocaleDateString()}`
          );
        }
        console.log('');
      }
    } else {
      console.log('  No hay vacas registradas');
    }

    // Mostrar puestos (desde config.yml)
    console.log('🏠 ESTADO DE PUESTOS:');
    console.log(
      '  NOTA: Los puestos se definen en config.yml, no en la base de datos'
    );

    if (appConfig.stalls && appConfig.stalls.length > 0) {
      appConfig.stalls.forEach(stall => {
        const status =
          stall.status === 'available' ? '🟢 Disponible' : '🔴 Ocupado';
        console.log(`  Puesto ${stall.number}: ${status} (${stall.sensor_id})`);
      });
    } else {
      // Fallback para mantener compatibilidad
      console.log('  Puesto 1: 🟢 Disponible (RFID01)');
      console.log('  Puesto 2: 🟢 Disponible (RFID02)');
      console.log('  Puesto 3: 🟢 Disponible (RFID03)');
      console.log('  Puesto 4: 🟢 Disponible (RFID04)');
      console.log('  Puesto 5: 🟢 Disponible (RFID05)');
      console.log('  Puesto 6: 🟢 Disponible (RFID06)');
    }
    console.log('');

    // Mostrar estadísticas
    console.log('📊 ESTADÍSTICAS:');

    // Obtener total de vacas
    const totalCows = cows.length;

    // Obtener vacas presentes
    const cowsPresent = await client.presence.count({
      where: {
        status: 'STILL_PRESENT',
      },
    });

    // Obtener detecciones recientes (1 hora)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentDetectionsCount = await client.detection.count({
      where: {
        timestamp: {
          gte: oneHourAgo,
        },
      },
    });

    console.log(`  • Total de vacas: ${totalCows}`);
    console.log(
      `  • Total de puestos: ${
        appConfig.stalls ? appConfig.stalls.length : 6
      } (definidos en config.yml)`
    );
    console.log(`  • Vacas presentes: ${cowsPresent}`);
    console.log(`  • Detecciones recientes (1h): ${recentDetectionsCount}`);
    console.log('');

    // Mostrar detecciones recientes
    console.log('📡 DETECCIONES RECIENTES:');
    const recentDetectionsList = await client.detection.findMany({
      take: 10,
      orderBy: {
        timestamp: 'desc',
      },
      include: {
        cow: true,
      },
    });

    if (recentDetectionsList && recentDetectionsList.length > 0) {
      for (const detection of recentDetectionsList) {
        const cowName = detection.cow?.name || 'Vaca desconocida';
        const tagNumber = detection.cow?.tagNumber || 'N/A';
        const sensorToken = detection.sensorToken || 'N/A';

        const time = new Date(detection.timestamp).toLocaleTimeString();
        
        // Manejar payload que puede ser string JSON u objeto
        let payload = {};
        try {
          if (typeof detection.payload === 'string') {
            payload = JSON.parse(detection.payload);
          } else if (typeof detection.payload === 'object' && detection.payload !== null) {
            payload = detection.payload;
          }
        } catch (error) {
          console.warn(`⚠️ Error parsing payload para detección ${detection.id}:`, error.message);
          payload = {};
        }
        
        const rssi = payload.rssi || 'N/A';
        console.log(
          `  • ${time} - ${cowName} (${tagNumber}) en ${sensorToken} (${rssi} dBm)`
        );
      }
    } else {
      console.log('  No hay detecciones recientes');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    try {
      await client?.$disconnect();
      console.log('🔌 Conexión a la base de datos cerrada');
    } catch (error) {
      console.error(
        '❌ Error cerrando conexión a la base de datos:',
        error.message
      );
    }
  }
}

// Ejecutar el script
showSystemStatus();
