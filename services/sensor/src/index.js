// @ts-check

const { run } = require('@cosva-lab/iot-sensor');
const { ConfigLoader } = require('@cosva-lab/iot-shared');

const config = ConfigLoader.getInstance().loadConfig();

run({
  farm: config.farm,
  mqtt: config.mqtt,
  presence: config.presence,
  sensors: config.sensors,
});
