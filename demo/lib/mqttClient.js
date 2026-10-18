// @ts-check
'use strict';

const mqtt = require('mqtt');

/**
 * @param {{ broker_url: string, username?: string, password?: string, client_id?: string }} mqttConfig
 */
function connectMqtt(mqttConfig) {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(mqttConfig.broker_url, {
      clientId: `${mqttConfig.client_id || 'cosva'}-milking-demo-${Date.now()}`,
      username: mqttConfig.username,
      password: mqttConfig.password,
      clean: true,
      reconnectPeriod: 0,
    });
    const t = setTimeout(() => {
      client.end(true);
      reject(new Error(`Timeout conectando a ${mqttConfig.broker_url}`));
    }, 15000);
    client.once('connect', () => {
      clearTimeout(t);
      resolve(client);
    });
    client.once('error', err => {
      clearTimeout(t);
      reject(err);
    });
  });
}

/**
 * @param {import('mqtt').MqttClient} client
 * @param {string} topic
 * @param {string} payload
 * @param {{ retain?: boolean, qos?: 0|1|2 }} [opts]
 */
function publishRaw(client, topic, payload, opts = {}) {
  return new Promise((resolve, reject) => {
    client.publish(
      topic,
      payload,
      { qos: opts.qos ?? 1, retain: Boolean(opts.retain) },
      err => (err ? reject(err) : resolve(undefined))
    );
  });
}

/**
 * @param {import('mqtt').MqttClient} client
 * @param {string} topic
 * @param {unknown} payload
 */
function publishJson(client, topic, payload) {
  return publishRaw(client, topic, JSON.stringify(payload), { retain: false });
}

module.exports = { connectMqtt, publishRaw, publishJson };
