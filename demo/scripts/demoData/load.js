// @ts-check
const { ConfigLoader } = require('@cosva-lab/iot-shared');
const { DatabaseClient } = require('@cosva-lab/iot-db');
const { demoCowsIds } = require('./constants');

const appConfig = ConfigLoader.getInstance().loadConfig();
const prisma = DatabaseClient.getInstance(appConfig.database).getPrismaClient();
const farmToken = appConfig.farm.id;

function demoCows() {
  return [
    prisma.cow.upsert({
      where: { id: demoCowsIds[0] },
      update: {},
      create: {
        id: demoCowsIds[0],
        farmToken: farmToken,
        name: 'Bella',
        tagNumber: 'RFID001',
        breed: 'Holstein',
        birthDate: new Date('2020-01-15'),
        status: 'active',
      },
    }),
    prisma.cow.upsert({
      where: { id: demoCowsIds[1] },
      update: {},
      create: {
        id: demoCowsIds[1],
        farmToken: farmToken,
        name: 'Luna',
        tagNumber: 'RFID002',
        breed: 'Holstein',
        birthDate: new Date('2019-08-22'),
        status: 'active',
      },
    }),
    prisma.cow.upsert({
      where: { id: demoCowsIds[2] },
      update: {},
      create: {
        id: demoCowsIds[2],
        farmToken: farmToken,
        name: 'Stella',
        tagNumber: 'RFID003',
        breed: 'Holstein',
        birthDate: new Date('2021-07-08'),
        status: 'active',
      },
    }),
    prisma.cow.upsert({
      where: { id: demoCowsIds[3] },
      update: {},
      create: {
        id: demoCowsIds[3],
        farmToken: farmToken,
        name: 'Daisy',
        tagNumber: 'RFID004',
        breed: 'Angus',
        birthDate: new Date('2020-12-03'),
        status: 'active',
      },
    }),
    prisma.cow.upsert({
      where: { id: demoCowsIds[4] },
      update: {},
      create: {
        id: demoCowsIds[4],
        farmToken: farmToken,
        name: 'Molly',
        tagNumber: 'RFID005',
        breed: 'Jersey',
        birthDate: new Date('2021-01-18'),
        status: 'active',
      },
    }),
    prisma.cow.upsert({
      where: { id: demoCowsIds[5] },
      update: {},
      create: {
        id: demoCowsIds[5],
        farmToken: farmToken,
        name: 'Ruby',
        tagNumber: 'RFID006',
        breed: 'Holstein',
        birthDate: new Date('2019-05-12'),
        status: 'active',
      },
    }),
  ];
}

const run = async () => {
  try {
    await prisma.$connect();
    await demoCows();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
};

run();
