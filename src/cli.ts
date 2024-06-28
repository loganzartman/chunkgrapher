import fs from 'fs';
import process from 'process';
import {graphChunks, isStatsData} from './graph';
import arg from 'arg';

const helpString = `
Usage: pnpm graph path/to/stats.json

Options:
  --help, -h            Show this message
  --chunkId, -c  id     Filter to a specific chunk ID
  --filename, -f name   Filter to chunks including a specific (partial) filename
  --format, -F   format Output format for the graph file (e.g. 'png', 'svg')
  --output, -o   path   Output path for the graph file
`;

function main() {
  try {
    const args = arg({
      '--help': Boolean,
      '--chunkId': String,
      '--filename': String,
      '--format': String,
      '--output': String,
      '-h': '--help',
      '-c': '--chunkId',
      '-f': '--filename',
      '-F': '--format',
      '-o': '--output',
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

    const outputOptions = {
      format: args['--format'],
      path: args['--output'],
    };

    graphChunks({statsData, filter}, outputOptions);
  } catch (e) {
    console.error('Failed to generate graph:');
    console.error(e);
  }
}

main();
