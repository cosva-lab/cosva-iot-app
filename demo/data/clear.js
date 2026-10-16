// @ts-check
const { ConfigLoader } = require('@cosva-lab/iot-shared');
const { DatabaseClient } = require('@cosva-lab/iot-db');
const { demoCowsIds } = require('./constants');

const appConfig = ConfigLoader.getInstance().loadConfig();
const prisma = DatabaseClient.getInstance(appConfig.database).getPrismaClient();

const run = async () => {
  try {
    await prisma.$connect();
    await prisma.animal.deleteMany({
      where: { id: { in: demoCowsIds } },
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
};

run();
