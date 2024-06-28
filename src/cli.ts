import fs from 'fs';
import process from 'process';
import {graphChunks, isStatsData} from './graph';
import arg from 'arg';

const helpString = `
Usage: pnpm graph path/to/stats.json [--chunkId id] [--filename name]

Options:
  --chunkId id    Filter to a specific chunk ID
  --filename name Filter to chunks including a specific filename
`;

function main() {
  try {
    const args = arg({
      '--help': Boolean,
      '--chunkId': String,
      '--filename': String,
      '-c': '--chunkId',
      '-f': '--filename',
    });

    if (args['--help']) {
      console.error(helpString);
      process.exit(-1);
    }

    const statsPath = args._[0];

    if (!statsPath) {
      console.error(helpString);
      process.exit(-1);
    }

    const statsData = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    if (!isStatsData(statsData)) {
      throw new Error('Invalid stats data');
    }

    const filter = {
      chunkId: args['--chunkId'],
      filename: args['--filename'],
    };

    graphChunks({statsData, filter});
  } catch (e) {
    console.error('Failed to generate graph:');
    console.error(e);
  }
}

main();
