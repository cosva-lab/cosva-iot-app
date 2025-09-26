// @ts-check

const { run } = require('@cosva-lab/iot-dashboard');
const { ConfigLoader } = require('@cosva-lab/iot-shared');

const config = ConfigLoader.getInstance().loadConfig();

run({
  farm: config.farm,
  mqtt: config.mqtt,
  database: config.database,
  stalls: config.stalls,
  port: 3000,
});
