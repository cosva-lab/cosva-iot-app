import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const packagePath = './node_modules/@cosva-lab/iot-db/prisma';

export default defineConfig({
  // Prisma configuration for Cosva IoT project
  // All database operations are centralized in the shared package
  schema: `${packagePath}/schema.prisma`,
  migrations: { path: `${packagePath}/migrations` },
});
