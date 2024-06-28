import type {StatsChunk, StatsCompilation} from 'webpack';
import graphviz from 'graphviz';
import {
  ChunkFilterOptions,
  OutputOptions,
  createChunkFilter,
  getChunkKey,
} from './util';

export type ChunkGraph = {
  chunks: Map<string, StatsChunk>;
  edges: Map<string, Map<string, number>>;
};

export type BuildChunkGraphOptions = {
  statsData: StatsCompilation;
  filter?: ChunkFilterOptions;
};

export function buildChunkGraph({
  statsData,
  filter,
}: BuildChunkGraphOptions): ChunkGraph {
  if (!statsData.chunks) {
    throw new Error('No chunks found');
  }

  // allow filtering to a subgraph containing particular nodes
  let chunkFilter = createChunkFilter(filter);

  const allNodes = new Map<string, StatsChunk>();

  const chunks: Map<string, StatsChunk> = new Map();
  const edges: Map<string, Map<string, number>> = new Map();
  function addEdge(a: StatsChunk, b: StatsChunk) {
    const keyA = getChunkKey(a);
    const keyB = getChunkKey(b);

    chunks.set(keyA, a);
    chunks.set(keyB, b);

    let aEdges = edges.get(keyA);
    if (aEdges === undefined) {
      aEdges = new Map();
      edges.set(keyA, aEdges);
    }
    let bCount = aEdges.get(keyB);
    if (bCount === undefined) {
      bCount = 0;
    }
    aEdges.set(keyB, bCount + 1);
  }

  // collect all nodes for ID -> node lookup
  for (const chunk of statsData.chunks) {
    if (!chunk.id) {
      throw new Error('Chunk has no ID');
    }
    allNodes.set(getChunkKey(chunk), chunk);
  }

  // collect (filtered) edges and any involved nodes
  for (const chunk of statsData.chunks) {
    if (!chunk.id) {
      throw new Error('Chunk has no ID');
    }
    if (!chunk.parents) {
      throw new Error('Chunk has no parents');
    }
    for (const parent of chunk.parents) {
      const parentChunk = allNodes.get(String(parent));
      if (!parentChunk) {
        throw new Error('internal error: Parent chunk not found');
      }
      if (chunkFilter(parentChunk) || chunkFilter(chunk)) {
        addEdge(parentChunk, chunk);
      }
    }
  }

  return {chunks, edges};
}

export function graphChunks(
  graphOptions: BuildChunkGraphOptions,
  {path, format = 'svg'}: OutputOptions,
) {
  const graph = buildChunkGraph(graphOptions);

  const g = graphviz.digraph('G');
  g.set('layout', 'dot');

  for (const chunk of graph.chunks.values()) {
    g.addNode(getChunkKey(chunk), {
      shape: 'box',
      label: chunk.names?.join(' ') ?? String(chunk.id),
    });
  }
  for (const [keyA, mapB] of graph.edges.entries()) {
    for (const [keyB, value] of mapB.entries()) {
      g.addEdge(keyA, keyB, {label: String(value)});
    }
  }

  path ??= `./graph.${format}`;
  console.log('Writing graph to', path);
  g.output(format, path);
}
