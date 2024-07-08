import type {StatsAsset, StatsChunk, StatsCompilation} from 'webpack';
import graphviz from 'graphviz';
import {
  ChunkFilterOptions,
  OutputOptions,
  createChunkFilter,
  getAssetKey,
  getChunkKey,
} from './util';

export type ChunkGraph = {
  assets: Map<string, StatsAsset>;
  chunks: Map<string, StatsChunk>;
  chunkAssets: Map<string, Set<string>>;
  chunkEdges: Map<string, Set<string>>;
};

export type BuildChunkGraphOptions = {
  statsData: StatsCompilation;
  filter?: ChunkFilterOptions;
};

export function buildChunkGraph({
  statsData,
  filter,
}: BuildChunkGraphOptions): ChunkGraph {
  if (!statsData.assets) {
    throw new Error('No assets found');
  }
  if (!statsData.chunks) {
    throw new Error('No chunks found');
  }

  // allow filtering to a subgraph containing particular nodes
  let chunkFilter = createChunkFilter(filter);

  const assets = new Map<string, StatsAsset>();
  const chunks = new Map<string, StatsChunk>();
  const chunkAssets = new Map<string, Set<string>>();
  const chunkEdges = new Map<string, Set<string>>();

  // collect all assets for lookup by name
  const allAssets = new Map<string, StatsAsset>();
  for (const asset of statsData.assets) {
    allAssets.set(getAssetKey(asset), asset);
  }

  // collect all chunks for lookup by ID
  const allChunks = new Map<string, StatsChunk>();
  for (const chunk of statsData.chunks) {
    allChunks.set(getChunkKey(chunk), chunk);
  }

  for (const chunk of statsData.chunks) {
    if (!chunkFilter(chunk)) {
      continue;
    }

    const chunkKey = getChunkKey(chunk);
    chunks.set(chunkKey, chunk);

    if (chunk.files) {
      for (const filename of chunk.files) {
        const assetKey = filename;
        const asset = allAssets.get(assetKey);
        if (asset) {
          assets.set(assetKey, asset);
          let assetsSet = chunkAssets.get(chunkKey);
          if (!assetsSet) {
            assetsSet = new Set();
            chunkAssets.set(chunkKey, assetsSet);
          }
          assetsSet.add(assetKey);
        }
      }
    }
  }

  return {assets, chunks, chunkAssets, chunkEdges};
}

export function graphChunks(
  graphOptions: BuildChunkGraphOptions,
  {path, format = 'svg'}: OutputOptions,
) {
  const graph = buildChunkGraph(graphOptions);
  console.log(graph);

  const g = graphviz.digraph('G');
  g.set('layout', 'fdp');

  for (const chunk of graph.chunks.values()) {
    const c = g.addCluster('cluster_' + getChunkKey(chunk));
    c.set('label', chunk.names?.join(', ') ?? getChunkKey(chunk));

    const assets = graph.chunkAssets.get(getChunkKey(chunk));
    if (assets) {
      for (const assetKey of assets) {
        const asset = graph.assets.get(assetKey);
        if (asset) {
          c.addNode(getAssetKey(asset), {label: asset.name});
        }
      }
    }
  }

  path ??= `./graph.${format}`;
  console.log('Writing graph to', path);
  g.output(format, path);
}
