#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

// Load environment variables
config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    await prisma.$connect();
    console.log('✅ Database connection established');

    // Create sample cows
    const cows = await Promise.all([
      prisma.cow.upsert({
        where: { id: 'cow-001' },
        update: {},
        create: {
          id: 'cow-001',
          farmToken: 'farm-001',
          name: 'Bella',
          tagNumber: 'RFID001',
          breed: 'Holstein',
          birthDate: new Date('2020-01-15'),
          status: 'active',
        },
      }),
      prisma.cow.upsert({
        where: { id: 'cow-002' },
        update: {},
        create: {
          id: 'cow-002',
          farmToken: 'farm-001',
          name: 'Luna',
          tagNumber: 'RFID002',
          breed: 'Holstein',
          birthDate: new Date('2019-08-22'),
          status: 'active',
        },
      }),
    ]);
    console.log(`✅ Created ${cows.length} sample cows`);

    // Create sample stalls
    const stalls = await Promise.all([
      prisma.stall.upsert({
        where: { id: 'stall-001' },
        update: {},
        create: {
          id: 'stall-001',
          farmToken: 'farm-001',
          number: 1,
          sensorId: 'sensor-001',
          status: 'available',
        },
      }),
      prisma.stall.upsert({
        where: { id: 'stall-002' },
        update: {},
        create: {
          id: 'stall-002',
          farmToken: 'farm-001',
          number: 2,
          sensorId: 'sensor-002',
          status: 'available',
        },
      }),
    ]);
    console.log(`✅ Created ${stalls.length} sample stalls`);

    console.log('✅ Database seeding completed successfully');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
