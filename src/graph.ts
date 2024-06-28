import type {StatsChunk, StatsCompilation} from 'webpack';

export type Graph = {
  nodes: Map<string, StatsChunk>;
  edges: Map<string, Map<string, number>>;
};

export type BuildChunkGraphOptions = {
  statsData: StatsCompilation;
  filter?: {chunkId?: string; filename?: string};
};

export function isStatsData(statsData: object): statsData is StatsCompilation {
  return (statsData as StatsCompilation).chunks !== undefined;
}

function createNodeFilter(filter: BuildChunkGraphOptions['filter']) {
  return (chunk: StatsChunk) => {
    if (filter?.chunkId) {
      if (String(chunk.id) !== filter.chunkId) {
        return false;
      }
    }

    if (filter?.filename) {
      const filename = filter.filename;
      if (!chunk.files) {
        return false;
      }
      if (!chunk.files.some((file) => file.toLowerCase().includes(filename))) {
        return false;
      }
    }

    return true;
  };
}

export function buildChunkGraph({
  statsData,
  filter,
}: BuildChunkGraphOptions): Graph {
  if (!statsData.chunks) {
    throw new Error('No chunks found');
  }

  // allow filtering to a subgraph containing particular nodes
  let nodeFilter = createNodeFilter(filter);

  const allNodes = new Map<string, StatsChunk>();

  const nodes: Map<string, StatsChunk> = new Map();
  const edges: Map<string, Map<string, number>> = new Map();
  function addEdge(a: StatsChunk, b: StatsChunk) {
    const keyA = String(a.id);
    const keyB = String(b.id);

    nodes.set(keyA, a);
    nodes.set(keyB, b);

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
  statsData.chunks.forEach((chunk) => {
    if (!chunk.id) {
      throw new Error('Chunk has no ID');
    }
    allNodes.set(String(chunk.id), chunk);
  });

  // collect (filtered) edges and any involved nodes
  statsData.chunks.forEach((chunk) => {
    if (!chunk.id) {
      throw new Error('Chunk has no ID');
    }
    if (!chunk.parents) {
      throw new Error('Chunk has no parents');
    }
    chunk.parents.forEach((parent) => {
      const parentChunk = allNodes.get(String(parent));
      if (!parentChunk) {
        throw new Error('internal error: Parent chunk not found');
      }
      if (nodeFilter(parentChunk) || nodeFilter(chunk)) {
        addEdge(parentChunk, chunk);
      }
    });
  });

  return {nodes, edges};
}

export function graphChunks(options: BuildChunkGraphOptions) {
  // reference: https://webpack.js.org/api/stats/
  const graph = buildChunkGraph(options);
  console.log(graph);
}
