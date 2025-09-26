// @ts-check

const { run } = require('@cosva-lab/iot-sync');
const { ConfigLoader } = require('@cosva-lab/iot-shared');

const config = ConfigLoader.getInstance().loadConfig();

run({
  api: config.api,
  database: config.database,
  mqtt: config.mqtt,
  farm: config.farm,
});
