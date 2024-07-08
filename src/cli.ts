import fs from 'fs';
import process from 'process';
import {createChunkFilter, isStatsData} from './util';
import arg from 'arg';
import dedent from 'dedent';
import {graphChunks} from './graphChunks';
import {graphModules} from './graphRelatives';

function mainChunks(argv: string[]) {
  const args = arg(
    {
      '--help': Boolean,
      '--chunkId': String,
      '--chunkFilename': String,
      '--format': String,
      '--output': String,
      '-h': '--help',
      '-c': '--chunkId',
      '-n': '--chunkFilename',
      '-f': '--format',
      '-o': '--output',
    },
    {argv},
  );

  function printHelp() {
    console.error(dedent`
      Usage: pnpm graph chunks [OPTIONS] path/to/stats.json
    
      OPTIONS:
        --help, -h                   Show this message
        --chunkId, -c        id      Filter to a specific chunk ID
        --chunkFilename, -n  name    Filter to chunks including a specific (partial) filename
        --format, -f         format  Output format for the graph file (e.g. 'png', 'svg')
        --output, -o         path    Output path for the graph file
    `);
  }

  if (args['--help']) {
    printHelp();
    process.exit(0);
  }

  const statsPath = args._[0];

  if (!statsPath) {
    console.error('Missing stats file path');
    printHelp();
    process.exit(1);
  }

  const statsData = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  if (!isStatsData(statsData)) {
    throw new Error('Invalid stats data');
  }

  const filter = {
    chunkId: args['--chunkId'],
    chunkFilename: args['--chunkFilename'],
  };

  const outputOptions = {
    format: args['--format'],
    path: args['--output'],
  };

  graphChunks({statsData, filter}, outputOptions);
}

function mainModules(argv: string[]) {
  const args = arg(
    {
      '--help': Boolean,
      '--chunkId': String,
      '--chunkFilename': String,
      '--moduleName': String,
      '--format': String,
      '--output': String,
      '-h': '--help',
      '-c': '--chunkId',
      '-n': '--chunkFilename',
      '-m': '--moduleName',
      '-f': '--format',
      '-o': '--output',
    },
    {argv},
  );

  function printHelp() {
    console.error(dedent`
      Usage: pnpm graph modules [OPTIONS] path/to/stats.json
    
      OPTIONS:
        --help, -h                   Show this message
        --chunkId, -c        id      Filter to a specific chunk ID
        --chunkFilename, -n  name    Filter to chunks including a specific (partial) filename
        --moduleName, -m     name    Filter to modules including a specific (partial) name
        --format, -f         format  Output format for the graph file (e.g. 'png', 'svg')
        --output, -o         path    Output path for the graph file
    `);
  }

  if (args['--help']) {
    printHelp();
    process.exit(0);
  }

  const statsPath = args._[0];

  if (!statsPath) {
    console.error('Missing stats file path');
    printHelp();
    process.exit(1);
  }

  const statsData = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  if (!isStatsData(statsData)) {
    throw new Error('Invalid stats data');
  }

  graphModules({
    statsData,
    filter: {
      moduleName: args['--moduleName'],
    },
    format: args['--format'],
    path: args['--output'],
  });
}

function main() {
  try {
    const args = arg(
      {
        '--help': Boolean,
        '-h': '--help',
      },
      {permissive: true},
    );

    function printHelp() {
      console.error(dedent`
        Usage: pnpm graph MODE

        MODE:
          chunks:  Generate a graph of chunk dependencies
          modules: Generate a graph of module dependencies grouped by chunk
        
        Options:
          --help, -h: Show help message
      `);
    }

    if (args['--help']) {
      printHelp();
      process.exit(0);
    }

    const mode = args._[0];
    if (mode !== 'chunks' && mode !== 'modules') {
      printHelp();
      process.exit(1);
    }

    if (mode === 'chunks') {
      mainChunks(args._.slice(1));
    } else if (mode === 'modules') {
      mainModules(args._.slice(1));
    } else {
      throw new Error('Invalid mode');
    }
  } catch (e) {
    console.error('Failed to generate graph:');
    throw e;
  }
}

main();
