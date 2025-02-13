import type {StatsChunk, StatsCompilation, StatsModule} from 'webpack';

export type OutputOptions = {
  path?: string;
  format?: string;
};

export type ChunkFilterOptions = {
  chunkId?: string;
  chunkFilename?: string;
};

export type ModuleFilterOptions = {
  moduleName?: string;
};

export function isStatsData(statsData: object): statsData is StatsCompilation {
  return (statsData as StatsCompilation).chunks !== undefined;
}

export function getAssetKey(asset: {name: string}) {
  return asset.name;
}

export function getChunkKey(chunk: {id?: string | number}) {
  if (chunk.id !== undefined) {
    return String(chunk.id);
  }
  throw new Error('Chunk has no ID');
}

export function getModuleKey(mod: {identifier?: string}) {
  if (typeof mod.identifier !== 'string') {
    console.error(mod);
    throw new Error('Module has no identifier');
  }
  return `module:${mod.identifier}`;
}

export function getEntryKey(entry: {name?: string}) {
  if (!entry.name) {
    console.error(entry);
    throw new Error('Entry has no name');
  }
  return `entry:${entry.name}`;
}

export function formatModuleName(mod: StatsModule): string {
  const name = mod.name ?? mod.identifier;
  if (name === undefined) {
    return '<unnamed>';
  }
  return name.replace(/^.*!/, '');
}

export function createChunkFilter(filter?: ChunkFilterOptions) {
  return (chunk: StatsChunk) => {
    if (filter?.chunkId) {
      if (String(chunk.id) !== filter.chunkId) {
        return false;
      }
    }

    const filename = filter?.chunkFilename;
    if (filename) {
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

export function createModuleFilter(filter?: ModuleFilterOptions) {
  return (mod: StatsModule) => {
    const name = filter?.moduleName;
    if (name) {
      if (
        !mod.id?.toString().toLowerCase().includes(name) &&
        !mod.identifier?.toLowerCase().includes(name)
      ) {
        return false;
      }
    }

    return true;
  };
}

export function addEdge(edges: Map<string, Set<string>>, a: string, b: string) {
  const aEdges = edges.get(a) ?? new Set<string>();
  edges.set(a, aEdges);
  aEdges.add(b);
}
