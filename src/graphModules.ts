import type {StatsCompilation, StatsChunk, StatsModule} from 'webpack';
import graphviz from 'graphviz';
import {
  ChunkFilterOptions,
  ModuleFilterOptions,
  OutputOptions,
  createChunkFilter,
  createModuleFilter,
  getChunkKey,
  getModuleKey,
} from './util';

export type BuildChunkModuleGraphOptions = {
  statsData: StatsCompilation;
  filter?: ChunkFilterOptions & ModuleFilterOptions;
};

export type ChunkModuleGraph = {
  chunks: Map<string, StatsChunk>;
  modules: Map<string, StatsModule>;
  moduleEdges: Map<string, Set<string>>;
};

export function buildChunkModuleGraph({
  statsData,
  filter,
}: BuildChunkModuleGraphOptions): ChunkModuleGraph {
  if (!statsData.chunks) {
    throw new Error('No chunks found');
  }
  if (!statsData.modules) {
    throw new Error('No modules found');
  }

  const chunkFilter = createChunkFilter(filter);
  const moduleFilter = createModuleFilter(filter);

  const chunks = new Map<string, StatsChunk>();
  const modules = new Map<string, StatsModule>();
  const moduleEdges = new Map<string, Set<string>>();

  // collect all modules for lookup by ID
  const allModules = new Map<string, StatsModule>();
  for (const module of statsData.modules) {
    allModules.set(getModuleKey(module), module);
  }

  // collect all chunks for lookup by ID
  const allChunks = new Map<string, StatsChunk>();
  for (const chunk of statsData.chunks) {
    allChunks.set(getChunkKey(chunk), chunk);
  }

  function addChunks(mod: StatsModule) {
    if (mod.chunks) {
      for (const id of mod.chunks) {
        const key = getChunkKey({id});
        const chunk = allChunks.get(key);
        if (!chunk) {
          throw new Error(`internal error: Chunk not found: ${key}`);
        }
        chunks.set(key, chunk);
      }
    }
  }

  function addEdge(a: StatsModule, b: StatsModule) {
    const keyA = getModuleKey(a);
    const keyB = getModuleKey(b);

    modules.set(keyA, a);
    modules.set(keyB, b);
    addChunks(a);
    addChunks(b);

    let aEdges = moduleEdges.get(keyA);
    if (aEdges === undefined) {
      aEdges = new Set();
      moduleEdges.set(keyA, aEdges);
    }
    aEdges.add(keyB);
  }

  for (const mod of statsData.modules) {
    // don't include this module if none of its chunks match the chunk filter
    if (
      !mod.chunks
        ?.map((id) => allChunks.get(getChunkKey({id}))!)
        .some(chunkFilter)
    ) {
      continue;
    }

    if (mod.reasons === undefined) {
      console.warn(`Orphan module (no reasons): ${mod.name}`);
      continue;
    }

    // create edges from any module that caused this one to be included
    for (const includeReason of mod.reasons) {
      if (includeReason.module === undefined) {
        throw new Error('Module reason does not refer to a module');
      }

      const includerKey = getModuleKey({
        id: includeReason.moduleId,
        identifier: includeReason.moduleIdentifier,
      });

      const includerModule = allModules.get(includerKey);
      if (includerModule === undefined) {
        console.warn(`Module not found: ${includerKey}`);
        continue;
      }

      // don't include this module if neither it nor the includer match the module filter
      if (!moduleFilter(mod) && !moduleFilter(includerModule)) {
        continue;
      }

      addEdge(includerModule, mod);
    }
  }

  return {chunks, modules, moduleEdges};
}

export function graphModules(
  {statsData, filter}: BuildChunkModuleGraphOptions,
  {path, format = 'svg'}: OutputOptions,
) {
  const graph = buildChunkModuleGraph({statsData, filter});

  const g = graphviz.digraph('G');
  g.set('layout', 'dot');
  g.set('ranksep', '2.0');

  for (const chunk of graph.chunks.values()) {
    const c = g.addCluster('cluster_' + getChunkKey(chunk));
    c.set('label', chunk.names?.join(', ') ?? getChunkKey(chunk));

    for (const mod of graph.modules.values()) {
      c.addNode(getModuleKey(mod), {
        shape: 'box',
        label: mod.name,
      });
    }
  }

  for (const [moduleA, edges] of graph.moduleEdges) {
    for (const moduleB of edges) {
      g.addEdge(moduleA, moduleB);
    }
  }

  path ??= `./graph.${format}`;
  console.log('Writing graph to', path);
  g.output(format, path);
}
