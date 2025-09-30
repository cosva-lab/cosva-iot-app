#!/usr/bin/env node

// @ts-check

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

    console.log('🕧 Without data to seed');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
