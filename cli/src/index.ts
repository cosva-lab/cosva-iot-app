#!/usr/bin/env tsx
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import {
  commandStall,
  leaveAnimal,
  milkFromSpec,
  milkInteractive,
  printAnimals,
  scanAnimal,
  setRfid,
  setScale,
  setWeight,
  showStatus,
} from './actions.js';
import { loadContext } from './context.js';
import { menu } from './menu.js';
import { withMqtt } from './mqtt.js';
import { equipAll } from './topics.js';

function isUserExit(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'ExitPromptError' || error.name === 'CancelError')
  );
}

const stallOption = {
  type: 'string' as const,
  demandOption: true as const,
  describe: 'Stall number or id',
};

async function main(): Promise<void> {
  await yargs(hideBin(process.argv))
    .scriptName('cosva-sim')
    .command(
      '$0',
      'Interactive sensor menu',
      () => undefined,
      async () => {
        await menu(loadContext());
      }
    )
    .command(
      'status',
      'Parlor, equipment, and live milk',
      () => undefined,
      async () => {
        await showStatus(loadContext());
      }
    )
    .command(
      'animals',
      'List animals. The id column is the Cosva id',
      y =>
        y.option('search', {
          type: 'string',
          describe: 'Filter by plaque, name, RFID, or Cosva id',
        }),
      async argv => {
        await printAnimals(loadContext(), argv.search);
      }
    )
    .command(
      'equip',
      'Publish online for every stall (retained status and link)',
      () => undefined,
      async () => {
        const ctx = loadContext();
        await withMqtt(ctx, client => equipAll(client, ctx, true));
        console.log(
          'Equipment online. You can open the parlor on the dashboard.'
        );
      }
    )
    .command(
      'weight',
      'Publish a scale weight',
      y =>
        y.option('stall', stallOption).option('kg', {
          type: 'number',
          demandOption: true,
          describe: 'Kilograms on the scale',
        }),
      async argv => {
        const ctx = loadContext();
        await withMqtt(ctx, client =>
          setWeight(ctx, client, argv.kg, argv.stall)
        );
      }
    )
    .command(
      'rfid',
      'RFID reader online or offline',
      y =>
        y.option('stall', stallOption).option('state', {
          type: 'string',
          choices: ['online', 'offline'] as const,
          demandOption: true,
        }),
      async argv => {
        const ctx = loadContext();
        await withMqtt(ctx, client =>
          setRfid(ctx, client, { stall: argv.stall, state: argv.state })
        );
      }
    )
    .command(
      'scale',
      'Scale online or offline, or the radio link',
      y =>
        y
          .command(
            'link',
            'Scale radio link up or down',
            child =>
              child
                .option('stall', stallOption)
                .option('state', {
                  type: 'string',
                  choices: ['up', 'down'] as const,
                  demandOption: true,
                  describe: 'up or down',
                }),
            async argv => {
              const ctx = loadContext();
              await withMqtt(ctx, client =>
                setScale(ctx, client, {
                  stall: argv.stall,
                  link: argv.state,
                })
              );
            }
          )
          .option('stall', {
            type: 'string',
            describe: 'Stall number or id',
          })
          .option('state', {
            type: 'string',
            describe: 'online or offline',
          })
          .check(argv => {
            if (argv._.includes('link')) return true;
            if (argv.state !== 'online' && argv.state !== 'offline') {
              throw new Error('--state must be online or offline');
            }
            return true;
          }),
      async argv => {
        if (String(argv._[argv._.length - 1]) === 'link') return;
        const stall = argv.stall;
        const state = argv.state;
        if (!stall || !state) {
          throw new Error(
            'Pass --stall and --state online|offline, or: scale link --stall 1 --state up'
          );
        }
        const ctx = loadContext();
        await withMqtt(ctx, client =>
          setScale(ctx, client, { stall, state })
        );
      }
    )
    .command(
      'scan',
      'Publish an animal scan (tag + present)',
      y =>
        y.option('stall', stallOption).option('animal', {
          type: 'string',
          describe: 'Cosva animal id',
        }),
      async argv => {
        const ctx = loadContext();
        if (!argv.animal && !process.stdin.isTTY) {
          throw new Error('Pass --animal with the Cosva id.');
        }
        await withMqtt(ctx, client =>
          scanAnimal(ctx, client, argv.stall, argv.animal)
        );
      }
    )
    .command(
      'gone',
      'Animal leaves the reader (gone + present none)',
      y =>
        y.option('stall', stallOption).option('animal', {
          type: 'string',
          describe: 'Cosva animal id, when you want gone to name it',
        }),
      async argv => {
        const ctx = loadContext();
        await withMqtt(ctx, client =>
          leaveAnimal(ctx, client, argv.stall, { animalId: argv.animal })
        );
      }
    )
    .command(
      'start',
      'Send milking/cmd start',
      y => y.option('stall', stallOption),
      async argv => {
        const ctx = loadContext();
        await withMqtt(ctx, client =>
          commandStall(ctx, client, 'start', argv.stall)
        );
      }
    )
    .command(
      'finish',
      'Send milking/cmd finish',
      y => y.option('stall', stallOption),
      async argv => {
        const ctx = loadContext();
        await withMqtt(ctx, client =>
          commandStall(ctx, client, 'finish', argv.stall)
        );
      }
    )
    .command(
      'milk',
      'Milk a queue. Without --queue, build it interactively',
      y =>
        y
          .option('queue', {
            type: 'string',
            describe:
              'stall:cosvaId:liters,...  Example: 1:123:1.3,1:456:0.670',
          })
          .option('tare', {
            type: 'number',
            default: 3.5,
            describe: 'Empty can weight in kg',
          })
          .option('auto-start', {
            type: 'boolean',
            default: true,
            describe:
              'Send Start and Finish. Use --no-auto-start to pause for the dashboard.',
          }),
      async argv => {
        const ctx = loadContext();
        await withMqtt(ctx, async client => {
          if (argv.queue) {
            await milkFromSpec(ctx, client, {
              queue: argv.queue,
              tare: argv.tare,
              autoStart: argv.autoStart,
            });
            return;
          }
          if (!process.stdin.isTTY) {
            throw new Error('Pass --queue, or run this in a terminal.');
          }
          await milkInteractive(ctx, client, new Map());
        });
      }
    )
    .strict()
    .demandCommand(0)
    .help()
    .alias('help', 'h')
    .epilogue(
      [
        'Examples:',
        '  npm run sim',
        '  npm run sim -- weight --stall 1 --kg 4.2',
        '  npm run sim -- rfid --stall 1 --state online',
        '  npm run sim -- scale link --stall 1 --state up',
        '  npm run sim -- scan --stall 1 --animal COSVA_ID',
        '  npm run sim -- milk --queue 1:COSV_ID:1.3,1:COSV_ID:0.670,2:COSV_ID:0.9',
        '',
        '--animal is the Cosva id. A plaque is not an identity.',
      ].join('\n')
    )
    .exitProcess(false)
    .fail((message, error) => {
      if (isUserExit(error)) {
        console.log('\nDone.');
        return;
      }
      const text = error instanceof Error ? error.message : message;
      console.error(text);
      process.exitCode = 1;
    })
    .parseAsync();
}

main().catch(error => {
  if (isUserExit(error)) {
    console.log('\nDone.');
    return;
  }
  const text = error instanceof Error ? error.message : String(error);
  console.error(text);
  process.exitCode = 1;
});
