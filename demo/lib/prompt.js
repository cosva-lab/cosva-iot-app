// @ts-check
'use strict';

const readline = require('readline');

/**
 * @param {string} question
 * @param {string} [fallback]
 */
function ask(question, fallback) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const hint =
    fallback !== undefined && fallback !== '' ? ` [${fallback}]` : '';
  return new Promise(resolve => {
    rl.question(`${question}${hint}: `, answer => {
      rl.close();
      const trimmed = String(answer || '').trim();
      if (!trimmed && fallback !== undefined) {
        resolve(fallback);
        return;
      }
      resolve(trimmed);
    });
  });
}

/**
 * @param {string} question
 * @param {boolean} [defaultYes]
 */
async function confirm(question, defaultYes = true) {
  const d = defaultYes ? 'S' : 'N';
  const a = (await ask(`${question} (S/n)`, d)).toLowerCase();
  if (!a) return defaultYes;
  return a === 's' || a === 'y' || a === 'si' || a === 'sí' || a === 'yes';
}

/**
 * @template T
 * @param {string} title
 * @param {Array<{ label: string, value: T }>} options
 * @param {number} [defaultIndex]
 */
async function choose(title, options, defaultIndex = 0) {
  if (options.length === 0) {
    throw new Error('No hay opciones para elegir');
  }
  console.log(`\n${title}`);
  options.forEach((opt, i) => {
    console.log(`  ${i + 1}. ${opt.label}`);
  });
  const raw = await ask('Número', String(defaultIndex + 1));
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > options.length) {
    console.log('Opción inválida, usando por defecto.');
    return options[defaultIndex].value;
  }
  return options[n - 1].value;
}

/**
 * Multi-select by comma-separated indices (1-based).
 * @template T
 * @param {string} title
 * @param {Array<{ label: string, value: T }>} options
 */
async function chooseMany(title, options) {
  if (options.length === 0) return [];
  console.log(`\n${title}`);
  options.forEach((opt, i) => {
    console.log(`  ${i + 1}. ${opt.label}`);
  });
  console.log('  (números separados por coma, ej: 1,3,5)');
  const raw = await ask('Selección', '1');
  const idxs = raw
    .split(/[,\s]+/)
    .map(s => Number(s.trim()))
    .filter(n => Number.isFinite(n) && n >= 1 && n <= options.length);
  const uniq = [...new Set(idxs)];
  if (uniq.length === 0) return [options[0].value];
  return uniq.map(i => options[i - 1].value);
}

async function pressEnter(message = 'Enter para continuar…') {
  await ask(`\n⏸  ${message}`, '');
}

module.exports = { ask, confirm, choose, chooseMany, pressEnter };
